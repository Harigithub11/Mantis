"""Request/response schemas (non-table SQLModel classes)."""
from typing import Optional

from sqlmodel import SQLModel


# ── Company / auth ────────────────────────────────────────────────────────────
class CompanyCreate(SQLModel):
    name: str
    email: str
    password: str


class CompanyLogin(SQLModel):
    email: str
    password: str


class CompanyRead(SQLModel):
    id: int
    name: str
    email: str


class AuthResponse(SQLModel):
    token: str
    company: CompanyRead


# ── Product ───────────────────────────────────────────────────────────────────
class ProductCreate(SQLModel):
    name: str
    category: str = ""
    description: str = ""


class ProductUpdate(SQLModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class ProductRead(SQLModel):
    id: int
    company_id: int
    name: str
    category: str
    description: str
    image_path: Optional[str] = None
    company_name: Optional[str] = None


# ── Resource ──────────────────────────────────────────────────────────────────
class ResourceRead(SQLModel):
    id: int
    product_id: int
    type: str
    title: str
    file_path: Optional[str] = None
    url: Optional[str] = None
    indexed: bool
    chunk_count: int


class ResourceLinkCreate(SQLModel):
    title: str
    url: str
    type: Optional[str] = "link"


# ── Chat ──────────────────────────────────────────────────────────────────────
class ChatRequest(SQLModel):
    question: str


# ── Users / ownership ─────────────────────────────────────────────────────────
class UserCreate(SQLModel):
    name: str
    email: str
    password: str


class UserLogin(SQLModel):
    email: str
    password: str


class UserRead(SQLModel):
    id: int
    name: str
    email: str


class UserAuthResponse(SQLModel):
    token: str
    user: UserRead


# ── Alerts & maintenance ──────────────────────────────────────────────────────
class AlertCreate(SQLModel):
    type: str  # warranty | recall | safety | service
    title: str
    body: str = ""
    date: Optional[str] = None


class AlertRead(SQLModel):
    id: int
    product_id: int
    type: str
    title: str
    body: str
    date: Optional[str] = None


class ScheduleRead(SQLModel):
    id: int
    product_id: int
    task: str
    interval: str
    status: str
