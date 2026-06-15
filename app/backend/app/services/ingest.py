"""Ingest pipeline: parse → chunk → MOSS (single shared index).

The MOSS free tier caps total indexes at 3, so instead of one index per product we
use ONE shared index (``mantis``) and tag every chunk with its ``product_id`` in
metadata. Per-product retrieval uses a metadata filter at query time (supported on
locally-loaded indexes). This scales to unlimited products within the index cap.

Heavy MOSS work (embedding during create/add + load) runs in a worker thread with
its own event loop so it never blocks the FastAPI event loop.
"""
import asyncio
import logging
from typing import Dict, List, Optional

from moss import DocumentInfo, MossClient

from app.config import settings
from app.services.chunking import chunk_text
from app.services.parsing import extract_pages

logger = logging.getLogger(__name__)

SHARED_INDEX = "mantis"
INDEXABLE_TYPES = {"pdf", "image", "doc"}


def product_filter(product_id: int) -> Dict:
    """MOSS metadata filter selecting a single product's chunks."""
    return {"$and": [{"field": "product_id", "condition": {"$eq": str(product_id)}}]}


def infer_type(filename: str) -> str:
    n = (filename or "").lower()
    if n.endswith(".pdf"):
        return "pdf"
    if n.endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp")):
        return "image"
    if n.endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
        return "video"
    return "doc"


def _build_docs(product_id: int, pages, filename) -> List[DocumentInfo]:
    docs: List[DocumentInfo] = []
    for p in pages:
        for idx, chunk in enumerate(chunk_text(p["text"])):
            docs.append(
                DocumentInfo(
                    id=f"p{product_id}-{filename}-pg{p['page']}-c{idx}",
                    text=chunk,
                    metadata={
                        "product_id": str(product_id),
                        "source": filename or "unknown",
                        "page": str(p["page"]),
                    },
                )
            )
    return docs


def _ingest_sync(product_id: int, file_bytes: bytes, filename: str, mime: Optional[str]) -> int:
    pages = extract_pages(file_bytes, filename, mime)
    docs = _build_docs(product_id, pages, filename)
    if not docs:
        return 0

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        client = MossClient(settings.MOSS_PROJECT_ID, settings.MOSS_PROJECT_KEY)
        try:
            existing = {ix.name for ix in loop.run_until_complete(client.list_indexes())}
        except Exception as e:
            logger.warning(f"list_indexes failed ({e}); assuming new index")
            existing = set()
        if SHARED_INDEX in existing:
            loop.run_until_complete(client.add_docs(SHARED_INDEX, docs))
        else:
            loop.run_until_complete(client.create_index(SHARED_INDEX, docs))
        loop.run_until_complete(client.load_index(SHARED_INDEX))
        return len(docs)
    finally:
        loop.close()


async def ingest_resource(
    product_id: int, file_bytes: bytes, filename: str, mime: Optional[str] = None
) -> int:
    """Parse + chunk + index a resource into the shared index. Returns chunk_count."""
    return await asyncio.to_thread(_ingest_sync, product_id, file_bytes, filename, mime)
