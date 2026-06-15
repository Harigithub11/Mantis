"""Company auth routes: register / login / me."""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.auth import (
    get_current_company,
    hash_password,
    new_token,
    verify_password,
)
from app.db import get_session
from app.models import Company
from app.schemas import AuthResponse, CompanyCreate, CompanyLogin, CompanyRead

router = APIRouter(prefix="/companies", tags=["companies"])


def _auth_response(company: Company) -> AuthResponse:
    return AuthResponse(
        token=company.token,
        company=CompanyRead(id=company.id, name=company.name, email=company.email),
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: CompanyCreate, session: Session = Depends(get_session)):
    if session.exec(select(Company).where(Company.email == body.email)).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    company = Company(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        token=new_token(),
    )
    session.add(company)
    session.commit()
    session.refresh(company)
    return _auth_response(company)


@router.post("/login", response_model=AuthResponse)
def login(body: CompanyLogin, session: Session = Depends(get_session)):
    company = session.exec(select(Company).where(Company.email == body.email)).first()
    if not company or not verify_password(body.password, company.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Reuse the existing token so logging in elsewhere doesn't invalidate other
    # active sessions; only mint one if the company has none yet.
    if not company.token:
        company.token = new_token()
        session.add(company)
        session.commit()
        session.refresh(company)
    return _auth_response(company)


@router.get("/me", response_model=CompanyRead)
def me(company: Company = Depends(get_current_company)):
    return CompanyRead(id=company.id, name=company.name, email=company.email)
