"""Authentication helpers — bcrypt password hashing + opaque bearer tokens.

We use the `bcrypt` library directly (avoids passlib's version-detection issues
with bcrypt 5.x). Tokens are random, stored on the Company row, and sent as
``Authorization: Bearer <token>``.
"""
import secrets

import bcrypt
from fastapi import Depends, Header, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Company, User

# bcrypt rejects inputs longer than 72 bytes; truncate defensively.
_MAX = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:_MAX], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:_MAX], password_hash.encode("utf-8"))
    except Exception:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def get_current_company(
    authorization: str = Header(default=None),
    session: Session = Depends(get_session),
) -> Company:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    company = session.exec(select(Company).where(Company.token == token)).first()
    if not company:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return company


def get_current_user(
    authorization: str = Header(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    user = session.exec(select(User).where(User.token == token)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user
