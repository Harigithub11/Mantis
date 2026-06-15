"""End-user accounts: auth, owned-product inventory, and a personalized
notifications feed (warranty/recall/safety/service alerts + maintenance reminders
for the products the user owns)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.auth import get_current_user, hash_password, new_token, verify_password
from app.db import get_session
from app.models import Company, MaintenanceSchedule, Product, ProductAlert, User, UserProduct
from app.schemas import ProductRead, UserAuthResponse, UserCreate, UserLogin, UserRead

router = APIRouter(prefix="/users", tags=["users"])


def _auth(u: User) -> UserAuthResponse:
    return UserAuthResponse(token=u.token, user=UserRead(id=u.id, name=u.name, email=u.email))


@router.post("/register", response_model=UserAuthResponse, status_code=201)
def register(body: UserCreate, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.email == body.email)).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    u = User(name=body.name, email=body.email, password_hash=hash_password(body.password), token=new_token())
    session.add(u)
    session.commit()
    session.refresh(u)
    return _auth(u)


@router.post("/login", response_model=UserAuthResponse)
def login(body: UserLogin, session: Session = Depends(get_session)):
    u = session.exec(select(User).where(User.email == body.email)).first()
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not u.token:
        u.token = new_token()
        session.add(u)
        session.commit()
        session.refresh(u)
    return _auth(u)


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(get_current_user)):
    return UserRead(id=user.id, name=user.name, email=user.email)


# ── Inventory (products the user owns) ────────────────────────────────────────
@router.post("/me/inventory/{product_id}", status_code=201)
def add_to_inventory(product_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not session.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    exists = session.exec(
        select(UserProduct).where(UserProduct.user_id == user.id).where(UserProduct.product_id == product_id)
    ).first()
    if not exists:
        session.add(UserProduct(user_id=user.id, product_id=product_id))
        session.commit()
    return {"ok": True}


@router.delete("/me/inventory/{product_id}", status_code=204)
def remove_from_inventory(product_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    row = session.exec(
        select(UserProduct).where(UserProduct.user_id == user.id).where(UserProduct.product_id == product_id)
    ).first()
    if row:
        session.delete(row)
        session.commit()


@router.get("/me/inventory", response_model=List[ProductRead])
def list_inventory(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    pids = [r.product_id for r in session.exec(select(UserProduct).where(UserProduct.user_id == user.id)).all()]
    if not pids:
        return []
    products = session.exec(select(Product).where(Product.id.in_(pids))).all()
    companies = {c.id: c.name for c in session.exec(select(Company)).all()}
    return [
        ProductRead(
            id=p.id, company_id=p.company_id, name=p.name, category=p.category,
            description=p.description, image_path=p.image_path, company_name=companies.get(p.company_id),
        )
        for p in products
    ]


@router.get("/me/notifications")
def notifications(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    pids = [r.product_id for r in session.exec(select(UserProduct).where(UserProduct.user_id == user.id)).all()]
    if not pids:
        return []
    products = {p.id: p for p in session.exec(select(Product).where(Product.id.in_(pids))).all()}
    alerts = session.exec(select(ProductAlert).where(ProductAlert.product_id.in_(pids))).all()
    schedules = session.exec(
        select(MaintenanceSchedule)
        .where(MaintenanceSchedule.product_id.in_(pids))
        .where(MaintenanceSchedule.status == "approved")
    ).all()

    items = []
    for a in alerts:
        pname = products[a.product_id].name if a.product_id in products else ""
        items.append({
            "id": f"alert-{a.id}",
            "type": a.type,
            "title": f"{a.type.capitalize()}: {a.title}",
            "body": f"{pname} — {a.body}" + (f" ({a.date})" if a.date else ""),
            "timestamp": a.created_at.strftime("%b %d"),
            "unread": a.type in ("recall", "safety"),
            "_ts": a.created_at.isoformat(),
        })
    for s in schedules:
        pname = products[s.product_id].name if s.product_id in products else ""
        items.append({
            "id": f"sched-{s.id}",
            "type": "maintenance",
            "title": "Maintenance reminder",
            "body": f"{pname}: {s.task}" + (f" — every {s.interval}" if s.interval else ""),
            "timestamp": s.created_at.strftime("%b %d"),
            "unread": True,
            "_ts": s.created_at.isoformat(),
        })
    items.sort(key=lambda x: x["_ts"], reverse=True)
    for it in items:
        it.pop("_ts", None)
    return items
