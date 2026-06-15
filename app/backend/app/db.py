"""SQLite + SQLModel engine and session helpers."""
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import text

from app.config import settings

# check_same_thread=False so the connection can be shared across FastAPI threads.
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create all tables. Import models so they register with SQLModel.metadata."""
    import app.models  # noqa: F401  (ensures models are registered)

    SQLModel.metadata.create_all(engine)
    _migrate()


def _migrate() -> None:
    """Tiny idempotent migrations for columns added after a table already exists
    (SQLModel.create_all only creates missing tables, never new columns)."""
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(message)"))}
        if "feedback" in cols:
            return
        conn.execute(text("ALTER TABLE message ADD COLUMN feedback VARCHAR"))


def get_session():
    """FastAPI dependency yielding a DB session."""
    with Session(engine) as session:
        yield session
