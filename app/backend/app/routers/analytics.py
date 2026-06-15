"""Company analytics — product health & most-reported problems.

Computed from real stored data: products, resources (indexed chunks), chat sessions
and their messages. "Resolution rate" is real user feedback: 👍 ÷ (👍 + 👎) over the
assistant answers users rated. "Top issues" groups each session's first user message
(the reported symptom) by its normalized text and counts repeats.
"""
import re
from collections import Counter, defaultdict
from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.auth import get_current_company
from app.db import get_session
from app.models import ChatSession, Company, Message, Product, Resource

router = APIRouter(prefix="/companies", tags=["analytics"])


def _normalize(t: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", (t or "").lower()).strip()


def _rate(msgs: List[Message]):
    """(👍 ÷ rated) over assistant answers that received feedback; None if unrated."""
    good = sum(1 for m in msgs if m.feedback == "good")
    bad = sum(1 for m in msgs if m.feedback == "bad")
    rated = good + bad
    return round(good / rated, 2) if rated else None


@router.get("/me/analytics")
def company_analytics(
    company: Company = Depends(get_current_company),
    session: Session = Depends(get_session),
):
    products = session.exec(select(Product).where(Product.company_id == company.id)).all()
    pids = [p.id for p in products]

    resources = (
        session.exec(select(Resource).where(Resource.product_id.in_(pids))).all() if pids else []
    )
    sessions = (
        session.exec(select(ChatSession).where(ChatSession.product_id.in_(pids))).all() if pids else []
    )
    sids = [s.id for s in sessions]
    messages = (
        session.exec(select(Message).where(Message.session_id.in_(sids))).all() if sids else []
    )

    msgs_by_session: Dict[int, List[Message]] = defaultdict(list)
    for m in messages:
        msgs_by_session[m.session_id].append(m)
    for k in msgs_by_session:
        msgs_by_session[k].sort(key=lambda x: x.id or 0)

    indexed_chunks = sum(r.chunk_count for r in resources)
    overall_rate = _rate(messages)

    product_rows = []
    for p in products:
        psessions = [s for s in sessions if s.product_id == p.id]
        doc_count = sum(1 for r in resources if r.product_id == p.id)
        pmsgs: List[Message] = []
        issue_counts: Counter = Counter()
        issue_label: Dict[str, str] = {}
        for s in psessions:
            ms = msgs_by_session.get(s.id, [])
            pmsgs.extend(ms)
            first_user = next((m for m in ms if m.role == "user"), None)
            if first_user:
                key = _normalize(first_user.content)
                if key:
                    issue_counts[key] += 1
                    issue_label.setdefault(key, first_user.content.strip())
        product_rows.append(
            {
                "id": p.id,
                "name": p.name,
                "image_path": p.image_path,
                "doc_count": doc_count,
                "session_count": len(psessions),
                "resolution_rate": _rate(pmsgs),
                "top_issues": [
                    {"label": issue_label[k], "count": c} for k, c in issue_counts.most_common(3)
                ],
            }
        )

    # Most diagnosed first.
    product_rows.sort(key=lambda r: r["session_count"], reverse=True)

    # Real, data-derived sublabels for the dashboard cards.
    feedback_count = sum(1 for m in messages if m.feedback in ("good", "bad"))
    docs_total = len(resources)
    active_products = sum(1 for r in product_rows if r["session_count"] > 0)
    concern: Counter = Counter()
    concern_label: Dict[str, str] = {}
    for m in messages:
        if m.role == "user":
            k = _normalize(m.content)
            if k:
                concern[k] += 1
                concern_label.setdefault(k, m.content.strip())
    top_concern = concern_label[concern.most_common(1)[0][0]] if concern else None

    return {
        "products_count": len(products),
        "total_sessions": len(sessions),
        "indexed_chunks": indexed_chunks,
        "resolution_rate": overall_rate,
        "feedback_count": feedback_count,
        "docs_total": docs_total,
        "active_products": active_products,
        "top_concern": top_concern,
        "products": product_rows,
    }
