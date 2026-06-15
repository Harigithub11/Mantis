"""Product routes: CRUD (ownership-checked), public browse/search, image upload."""
import io
import os
import re
import uuid
import zipfile
from collections import Counter, defaultdict
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlmodel import Session, select

from app.auth import get_current_company
from app.config import settings
from app.db import get_session
from app.models import ChatSession, Company, Message, Product, Resource
from app.schemas import ProductCreate, ProductRead, ProductUpdate


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "product"

router = APIRouter(tags=["products"])


def _to_read(p: Product, company_name: Optional[str] = None) -> ProductRead:
    return ProductRead(
        id=p.id,
        company_id=p.company_id,
        name=p.name,
        category=p.category,
        description=p.description,
        image_path=p.image_path,
        company_name=company_name,
    )


def _owned_or_404(product_id: int, company: Company, session: Session) -> Product:
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if p.company_id != company.id:
        raise HTTPException(status_code=403, detail="Not your product")
    return p


@router.post("/products", response_model=ProductRead, status_code=201)
def create_product(
    body: ProductCreate,
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    p = Product(
        company_id=company.id,
        name=body.name,
        category=body.category,
        description=body.description,
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return _to_read(p, company.name)


@router.get("/products", response_model=List[ProductRead])
def list_products(
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Product, Company).join(Company, Company.id == Product.company_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Product.name.ilike(like) | Product.description.ilike(like))
    if category:
        stmt = stmt.where(Product.category == category)
    rows = session.exec(stmt).all()
    return [_to_read(p, c.name) for p, c in rows]


@router.get("/companies/me/products", response_model=List[ProductRead])
def my_products(
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    rows = session.exec(select(Product).where(Product.company_id == company.id)).all()
    return [_to_read(p, company.name) for p in rows]


@router.get("/products/{product_id}/documents")
def download_documents(product_id: int, session: Session = Depends(get_session)):
    """Customer download: the product's actual document file(s).
    One file → that file; multiple → a zip. 404 if none are downloadable."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    resources = session.exec(select(Resource).where(Resource.product_id == product_id)).all()
    files = []
    for r in resources:
        if r.file_path:
            fp = os.path.join(settings.UPLOAD_DIR, os.path.basename(r.file_path))
            if os.path.exists(fp):
                files.append((r, fp))

    if not files:
        raise HTTPException(status_code=404, detail="No downloadable documents for this product")

    if len(files) == 1:
        r, fp = files[0]
        ext = os.path.splitext(fp)[1] or ".pdf"
        return FileResponse(fp, filename=f"{_slug(product.name)}-manual{ext}")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for r, fp in files:
            ext = os.path.splitext(fp)[1]
            z.write(fp, arcname=f"{_slug(r.title)}{ext}")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{_slug(product.name)}-documents.zip"'},
    )


def _normalize_issue(t: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", (t or "").lower()).strip()


# Cache clustered issues per product so repeated page views don't re-call Gemini.
# Keyed by product_id -> (report_count_signature, clustered_list).
_ISSUE_CACHE: Dict[int, tuple] = {}


def _top_issues_cached(product_id: int, product_name: str, reports: List[str], top: int = 3):
    """Group differently-worded reports of the same problem into canonical issues
    (LLM, cached), falling back to exact-text grouping. Returns top N by count."""
    sig = len(reports)
    hit = _ISSUE_CACHE.get(product_id)
    if hit and hit[0] == sig:
        return hit[1][:top]

    from app.services.gemini_service import cluster_issues

    clustered = cluster_issues(product_name, reports, top=max(top, 5))
    if not clustered:  # Gemini unavailable → exact-normalized grouping
        cnt: Counter = Counter()
        lbl: Dict[str, str] = {}
        for r in reports:
            k = _normalize_issue(r)
            if k:
                cnt[k] += 1
                lbl.setdefault(k, r.strip())
        clustered = [{"label": lbl[k], "count": c} for k, c in cnt.most_common(max(top, 5))]
    _ISSUE_CACHE[product_id] = (sig, clustered)
    return clustered[:top]


@router.get("/products/{product_id}/insights")
def product_insights(product_id: int, session: Session = Depends(get_session)):
    """PUBLIC product insights: knowledge-base size, resolution rate, and the
    most-reported real issues (each session's first symptom, grouped). Powers the
    product page's stat boxes + Common Issues — all derived from stored chat data."""
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    resources = session.exec(select(Resource).where(Resource.product_id == product_id)).all()
    sessions = session.exec(select(ChatSession).where(ChatSession.product_id == product_id)).all()
    sids = [s.id for s in sessions]
    messages = (
        session.exec(select(Message).where(Message.session_id.in_(sids))).all() if sids else []
    )

    msgs_by_session: Dict[int, List[Message]] = defaultdict(list)
    for m in messages:
        msgs_by_session[m.session_id].append(m)
    for k in msgs_by_session:
        msgs_by_session[k].sort(key=lambda x: x.id or 0)

    # Resolution rate = real user feedback: 👍 ÷ (👍 + 👎) over rated answers.
    good = sum(1 for m in messages if m.feedback == "good")
    bad = sum(1 for m in messages if m.feedback == "bad")
    rated = good + bad

    reports = []
    for s in sessions:
        first_user = next((m for m in msgs_by_session.get(s.id, []) if m.role == "user"), None)
        if first_user and first_user.content.strip():
            reports.append(first_user.content.strip())

    return {
        "session_count": len(sessions),
        "indexed_docs": sum(1 for r in resources if r.indexed),
        "indexed_chunks": sum(r.chunk_count for r in resources),
        "resolution_rate": round(good / rated, 2) if rated else None,
        "feedback_count": rated,
        "top_issues": _top_issues_cached(product_id, p.name, reports, top=3),
    }


@router.get("/products/{product_id}/ai-insights")
def product_ai_insights(
    product_id: int,
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    """Company-only: Gemini-generated behaviour trend + growth suggestion derived from
    this product's most-reported real issues. Powers the dashboard Insights page."""
    from app.services.gemini_service import generate_product_insights

    p = _owned_or_404(product_id, company, session)

    sessions = session.exec(select(ChatSession).where(ChatSession.product_id == product_id)).all()
    sids = [s.id for s in sessions]
    messages = (
        session.exec(select(Message).where(Message.session_id.in_(sids))).all() if sids else []
    )
    msgs_by_session: Dict[int, List[Message]] = defaultdict(list)
    for m in messages:
        msgs_by_session[m.session_id].append(m)
    for k in msgs_by_session:
        msgs_by_session[k].sort(key=lambda x: x.id or 0)

    reports = []
    for s in sessions:
        first_user = next((m for m in msgs_by_session.get(s.id, []) if m.role == "user"), None)
        if first_user and first_user.content.strip():
            reports.append(first_user.content.strip())
    top_issues = _top_issues_cached(product_id, p.name, reports, top=5)

    ai = generate_product_insights(p.name, top_issues)
    return {"product_id": product_id, "name": p.name, **ai}


@router.get("/products/{product_id}", response_model=ProductRead)
def get_product(product_id: int, session: Session = Depends(get_session)):
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    c = session.get(Company, p.company_id)
    return _to_read(p, c.name if c else None)


@router.put("/products/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    body: ProductUpdate,
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    p = _owned_or_404(product_id, company, session)
    for field in ("name", "category", "description"):
        val = getattr(body, field)
        if val is not None:
            setattr(p, field, val)
    session.add(p)
    session.commit()
    session.refresh(p)
    return _to_read(p, company.name)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    p = _owned_or_404(product_id, company, session)
    session.delete(p)
    session.commit()


@router.post("/products/{product_id}/image", response_model=ProductRead)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    p = _owned_or_404(product_id, company, session)
    ext = os.path.splitext(file.filename or "")[1] or ".bin"
    fname = f"product_{product_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = os.path.join(settings.UPLOAD_DIR, fname)
    with open(dest, "wb") as f:
        f.write(await file.read())
    p.image_path = f"/uploads/{fname}"
    session.add(p)
    session.commit()
    session.refresh(p)
    return _to_read(p, company.name)
