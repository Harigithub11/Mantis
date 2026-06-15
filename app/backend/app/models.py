"""Database models (SQLModel).

Phase 2 introduces Company and Product. Resource / ChatSession / Message arrive
in Phases 3-4.
"""
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Company(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    # Simple opaque bearer token (regenerated on each login). Good enough for the hackathon.
    token: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id", index=True)
    name: str = Field(index=True)
    category: str = Field(default="", index=True)
    description: str = Field(default="")
    image_path: Optional[str] = None  # served at /uploads/<file>
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Resource(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    type: str  # pdf | doc | image | video | link
    title: str
    file_path: Optional[str] = None  # served at /uploads/<file>
    url: Optional[str] = None  # for external links
    indexed: bool = False  # whether its text is in the product's MOSS index
    chunk_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    # JSON: {"confirmed_symptoms": [...], "ruled_out": [...], "likely_causes": [...]}
    state_json: str = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="chatsession.id", index=True)
    role: str  # user | assistant
    content: str
    citations_json: str = Field(default="[]")  # list of {source, page, quote}
    image_path: Optional[str] = None  # Phase 5: attached problem photo
    # User feedback on an assistant answer: drives the real resolution rate.
    feedback: Optional[str] = Field(default=None, index=True)  # good | bad | None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    token: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserProduct(SQLModel, table=True):
    """A product a user owns (personal inventory)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProductAlert(SQLModel, table=True):
    """Company-set warranty / recall / safety / service-campaign notice for a product."""

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    type: str  # warranty | recall | safety | service
    title: str
    body: str = ""
    date: Optional[str] = None  # e.g. warranty expiry / campaign date (free text)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceSchedule(SQLModel, table=True):
    """A maintenance task — auto-extracted from manuals, approved by the company."""

    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    task: str
    interval: str = ""  # e.g. "12 months"
    status: str = "suggested"  # suggested | approved
    created_at: datetime = Field(default_factory=datetime.utcnow)
