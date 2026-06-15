"""MANTIS FastAPI application entrypoint."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.routers import alerts, analytics, chat, companies, products, resources, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    init_db()
    # Warm the MOSS index into memory so the first user query isn't a cold load.
    try:
        from app.services.ingest import SHARED_INDEX
        from app.services.moss_service import moss_service

        await moss_service.ensure_loaded(SHARED_INDEX)
        print("[startup] MOSS index preloaded.")
    except Exception as e:
        print(f"[startup] MOSS preload skipped: {e}")
    yield


app = FastAPI(title="MANTIS", version="0.1.0", lifespan=lifespan)

# Dev CORS — tighten before any public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve uploaded files (manuals, images) statically.
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(companies.router)
app.include_router(products.router)
app.include_router(resources.router)
app.include_router(chat.router)
app.include_router(analytics.router)
app.include_router(users.router)
app.include_router(alerts.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
