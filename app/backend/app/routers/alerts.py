"""Company-side product alerts (warranty/recall/safety/service) and auto-extracted
maintenance schedules (Gemini reads the manual; company approves before publish)."""
import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.auth import get_current_company
from app.db import get_session
from app.models import Company, MaintenanceSchedule, Product, ProductAlert
from app.schemas import AlertCreate, AlertRead, ScheduleRead
from app.services.gemini_service import extract_maintenance
from app.services.ingest import SHARED_INDEX, product_filter
from app.services.moss_service import moss_service

router = APIRouter(tags=["alerts"])


def _owned(product_id: int, company: Company, session: Session) -> Product:
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if p.company_id != company.id:
        raise HTTPException(status_code=403, detail="Not your product")
    return p


# ── Alerts ────────────────────────────────────────────────────────────────────
@router.post("/products/{product_id}/alerts", response_model=AlertRead, status_code=201)
def create_alert(product_id: int, body: AlertCreate, company: Company = Depends(get_current_company), session: Session = Depends(get_session)):
    _owned(product_id, company, session)
    a = ProductAlert(product_id=product_id, type=body.type, title=body.title, body=body.body, date=body.date)
    session.add(a)
    session.commit()
    session.refresh(a)
    return AlertRead(id=a.id, product_id=a.product_id, type=a.type, title=a.title, body=a.body, date=a.date)


@router.get("/products/{product_id}/alerts", response_model=List[AlertRead])
def list_alerts(product_id: int, session: Session = Depends(get_session)):
    rows = session.exec(select(ProductAlert).where(ProductAlert.product_id == product_id)).all()
    return [AlertRead(id=a.id, product_id=a.product_id, type=a.type, title=a.title, body=a.body, date=a.date) for a in rows]


@router.delete("/alerts/{alert_id}", status_code=204)
def delete_alert(alert_id: int, company: Company = Depends(get_current_company), session: Session = Depends(get_session)):
    a = session.get(ProductAlert, alert_id)
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    _owned(a.product_id, company, session)
    session.delete(a)
    session.commit()


# ── Maintenance schedules ─────────────────────────────────────────────────────
@router.post("/products/{product_id}/maintenance/extract", response_model=List[ScheduleRead])
async def extract_schedules(product_id: int, company: Company = Depends(get_current_company), session: Session = Depends(get_session)):
    product = _owned(product_id, company, session)
    # Pull maintenance-relevant text from the product's MOSS chunks.
    text = ""
    try:
        res = await moss_service.query(
            SHARED_INDEX,
            "maintenance schedule replace clean inspect lubricate service every months interval",
            top_k=10, alpha=0.6, filter=product_filter(product_id),
        )
        text = "\n\n".join(d.text for d in res.docs)
    except Exception:
        text = ""
    if not text.strip():
        raise HTTPException(status_code=422, detail="No indexed manual text to extract from.")

    tasks = await asyncio.to_thread(extract_maintenance, product.name, text)
    created: List[MaintenanceSchedule] = []
    existing = {
        (s.task.strip().lower())
        for s in session.exec(select(MaintenanceSchedule).where(MaintenanceSchedule.product_id == product_id)).all()
    }
    for t in tasks:
        if t["task"].strip().lower() in existing:
            continue
        s = MaintenanceSchedule(product_id=product_id, task=t["task"], interval=t.get("interval", ""), status="suggested")
        session.add(s)
        created.append(s)
    session.commit()
    for s in created:
        session.refresh(s)
    return [ScheduleRead(id=s.id, product_id=s.product_id, task=s.task, interval=s.interval, status=s.status) for s in created]


@router.get("/products/{product_id}/maintenance", response_model=List[ScheduleRead])
def list_schedules(product_id: int, session: Session = Depends(get_session)):
    rows = session.exec(select(MaintenanceSchedule).where(MaintenanceSchedule.product_id == product_id)).all()
    return [ScheduleRead(id=s.id, product_id=s.product_id, task=s.task, interval=s.interval, status=s.status) for s in rows]


@router.post("/maintenance/{sched_id}/approve", response_model=ScheduleRead)
def approve_schedule(sched_id: int, company: Company = Depends(get_current_company), session: Session = Depends(get_session)):
    s = session.get(MaintenanceSchedule, sched_id)
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    _owned(s.product_id, company, session)
    s.status = "approved"
    session.add(s)
    session.commit()
    session.refresh(s)
    return ScheduleRead(id=s.id, product_id=s.product_id, task=s.task, interval=s.interval, status=s.status)


@router.delete("/maintenance/{sched_id}", status_code=204)
def delete_schedule(sched_id: int, company: Company = Depends(get_current_company), session: Session = Depends(get_session)):
    s = session.get(MaintenanceSchedule, sched_id)
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    _owned(s.product_id, company, session)
    session.delete(s)
    session.commit()
