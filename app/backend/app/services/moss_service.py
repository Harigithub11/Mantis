"""Thin wrapper around the MOSS retrieval runtime.

MOSS is the mandatory retrieval layer (the "R" in RAG): hybrid semantic + keyword
search with built-in embeddings. One index per product, named ``product-{id}``.

Indexes must be loaded into this process's memory before fast (<10ms) queries; we
track which are loaded and reload lazily. ``mark_stale`` forces a reload after new
docs are ingested (ingest runs with a separate client/loop).
"""
from typing import List, Optional

from moss import DocumentInfo, MossClient, QueryOptions

from app.config import settings


class MossService:
    def __init__(self) -> None:
        self.client = MossClient(settings.MOSS_PROJECT_ID, settings.MOSS_PROJECT_KEY)
        self._loaded: set[str] = set()

    async def ensure_loaded(self, index_name: str) -> None:
        if index_name not in self._loaded:
            await self.client.load_index(index_name)
            self._loaded.add(index_name)

    def mark_stale(self, index_name: str) -> None:
        """Drop the loaded flag so the next query reloads fresh docs."""
        self._loaded.discard(index_name)

    async def query(
        self,
        index_name: str,
        text: str,
        top_k: int = 6,
        alpha: float = 0.6,
        filter: Optional[dict] = None,
    ):
        # Metadata filtering only works on a locally-loaded index.
        await self.ensure_loaded(index_name)
        return await self.client.query(
            index_name, text, QueryOptions(top_k=top_k, alpha=alpha, filter=filter)
        )

    async def create_or_add(self, index_name: str, docs: List[DocumentInfo]) -> None:
        """Create the index if missing, else upsert docs; then load into memory."""
        existing = {ix.name for ix in await self.client.list_indexes()}
        if index_name in existing:
            await self.client.add_docs(index_name, docs)
        else:
            await self.client.create_index(index_name, docs)
        await self.client.load_index(index_name)
        self._loaded.add(index_name)


moss_service = MossService()
