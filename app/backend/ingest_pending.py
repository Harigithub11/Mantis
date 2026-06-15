"""Re-ingest any resources that have a file but were never indexed in MOSS
(e.g. because the MOSS monthly write quota was exhausted at seed time). Run this
once MOSS write quota is available again or a fresh MOSS key is in .env:

    python ingest_pending.py
"""
import asyncio
import os

from sqlmodel import Session, select

from app.config import settings
from app.db import engine
from app.models import Resource
from app.services.ingest import SHARED_INDEX, ingest_resource
from app.services.moss_service import moss_service


def main():
    with Session(engine) as s:
        pending = s.exec(
            select(Resource).where(Resource.indexed == False).where(Resource.file_path != None)  # noqa: E712
        ).all()
        if not pending:
            print("Nothing pending — all resources are indexed.")
            return
        print(f"{len(pending)} unindexed resource(s) to ingest…")
        for r in pending:
            fp = os.path.join(settings.UPLOAD_DIR, os.path.basename(r.file_path))
            if not os.path.exists(fp):
                print(f"  - {r.title}: file missing, skipping")
                continue
            with open(fp, "rb") as f:
                data = f.read()
            try:
                chunks = asyncio.run(ingest_resource(r.product_id, data, os.path.basename(fp), "application/pdf"))
                r.indexed = chunks > 0
                r.chunk_count = chunks
                s.add(r)
                s.commit()
                print(f"  + {r.title}: {chunks} chunks")
            except Exception as e:
                print(f"  ! {r.title}: failed ({str(e)[:100]})")
        moss_service.mark_stale(SHARED_INDEX)
    print("Done. Restart the backend so MOSS reloads the index.")


if __name__ == "__main__":
    main()
