"""Resource routes: upload (file → parse → chunk → MOSS), add link, list, delete."""
import io
import os
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from sqlmodel import Session, select

from app.auth import get_current_company
from app.config import settings
from app.db import get_session
from app.models import Company, Product, Resource
from app.schemas import ResourceLinkCreate, ResourceRead
from app.services.ingest import INDEXABLE_TYPES, infer_type, ingest_resource

router = APIRouter(tags=["resources"])


def _to_read(r: Resource) -> ResourceRead:
    return ResourceRead(
        id=r.id,
        product_id=r.product_id,
        type=r.type,
        title=r.title,
        file_path=r.file_path,
        url=r.url,
        indexed=r.indexed,
        chunk_count=r.chunk_count,
    )


def _product_owned(product_id: int, company: Company, session: Session) -> Product:
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if p.company_id != company.id:
        raise HTTPException(status_code=403, detail="Not your product")
    return p


@router.get("/products/{product_id}/resources", response_model=List[ResourceRead])
def list_resources(product_id: int, session: Session = Depends(get_session)):
    if not session.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    rows = session.exec(select(Resource).where(Resource.product_id == product_id)).all()
    return [_to_read(r) for r in rows]


@router.get("/resources/{resource_id}/download")
def download_resource(resource_id: int, session: Session = Depends(get_session)):
    """Stream a single resource's file as an attachment (forces download)."""
    r = session.get(Resource, resource_id)
    if not r or not r.file_path:
        raise HTTPException(status_code=404, detail="No downloadable file for this resource")
    fp = os.path.join(settings.UPLOAD_DIR, os.path.basename(r.file_path))
    if not os.path.exists(fp):
        raise HTTPException(status_code=404, detail="File not found")
    ext = os.path.splitext(fp)[1] or ""
    name = (re.sub(r"[^a-zA-Z0-9]+", "-", r.title).strip("-") or "document") + ext
    return FileResponse(fp, filename=name)


def _find_pdf_resource(product_id: int, source: str, session: Session) -> Optional[Resource]:
    """Resolve a citation's source filename to its stored PDF resource."""
    src = (source or "").strip()
    rows = session.exec(select(Resource).where(Resource.product_id == product_id)).all()
    for r in rows:
        if not r.file_path:
            continue
        base = os.path.basename(r.file_path)
        if base == src or base.endswith(f"_{src}") or r.title == src:
            return r
    return None


@router.get("/products/{product_id}/manual-page")
def manual_page_image(
    product_id: int,
    source: str = Query(..., description="cited file name"),
    page: int = Query(..., ge=1),
    scale: float = Query(2.0, ge=1.0, le=4.0),
    session: Session = Depends(get_session),
):
    """Render a cited manual page to PNG so the chat can show the actual figure/diagram
    the answer is grounded in. Looks the resource up by the citation's source filename."""
    r = _find_pdf_resource(product_id, source, session)
    if not r or not r.file_path:
        raise HTTPException(status_code=404, detail="Source document not found")
    fp = os.path.join(settings.UPLOAD_DIR, os.path.basename(r.file_path))
    if not os.path.exists(fp) or not fp.lower().endswith(".pdf"):
        raise HTTPException(status_code=404, detail="Not a renderable PDF")
    try:
        import pypdfium2 as pdfium
    except ImportError:
        raise HTTPException(status_code=501, detail="PDF rendering unavailable")

    pdf = pdfium.PdfDocument(fp)
    try:
        if page < 1 or page > len(pdf):
            raise HTTPException(status_code=404, detail="Page out of range")
        bitmap = pdf[page - 1].render(scale=scale)
        pil = bitmap.to_pil()
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
    finally:
        pdf.close()
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/products/{product_id}/resources/upload", response_model=ResourceRead, status_code=201)
async def upload_resource(
    product_id: int,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    _product_owned(product_id, company, session)
    data = await file.read()
    filename = file.filename or "file"
    rtype = infer_type(filename)

    safe = f"res_{product_id}_{uuid.uuid4().hex[:8]}_{filename}"
    dest = os.path.join(settings.UPLOAD_DIR, safe)
    with open(dest, "wb") as f:
        f.write(data)

    chunk_count = 0
    if rtype in INDEXABLE_TYPES:
        chunk_count = await ingest_resource(product_id, data, filename, file.content_type)
        if chunk_count > 0:
            # Force the query client to reload so it sees the new docs.
            from app.services.ingest import SHARED_INDEX
            from app.services.moss_service import moss_service

            moss_service.mark_stale(SHARED_INDEX)

    r = Resource(
        product_id=product_id,
        type=rtype,
        title=title or filename,
        file_path=f"/uploads/{safe}",
        indexed=chunk_count > 0,
        chunk_count=chunk_count,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return _to_read(r)


@router.post("/products/{product_id}/resources/link", response_model=ResourceRead, status_code=201)
def add_link_resource(
    product_id: int,
    body: ResourceLinkCreate,
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    _product_owned(product_id, company, session)
    r = Resource(product_id=product_id, type=body.type or "link", title=body.title, url=body.url)
    session.add(r)
    session.commit()
    session.refresh(r)
    return _to_read(r)


@router.delete("/resources/{resource_id}", status_code=204)
def delete_resource(
    resource_id: int,
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    r = session.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    p = session.get(Product, r.product_id)
    if not p or p.company_id != company.id:
        raise HTTPException(status_code=403, detail="Not your resource")
    if r.file_path:
        try:
            os.remove(os.path.join(settings.UPLOAD_DIR, os.path.basename(r.file_path)))
        except OSError:
            pass
    # Note: chunks remain in the product's MOSS index (best-effort cleanup deferred).
    session.delete(r)
    session.commit()
