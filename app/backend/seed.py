"""Seed demo data for MANTIS — a company, two products, and their manuals ingested
into MOSS. Idempotent (safe to re-run). No server required.

Run from the backend dir:  python seed.py
"""
import asyncio
import os

from sqlmodel import Session, select

from app.auth import hash_password, new_token
from app.config import settings
from app.db import engine, init_db
from app.models import ChatSession, Company, Message, Product, Resource
from app.services.ingest import ingest_resource

HERE = os.path.dirname(__file__)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


def _serve_copy(product_id: int, src_rel: str) -> str:
    """Copy a manual into the uploads dir so customers can download it; return its URL path."""
    fname = os.path.basename(src_rel)
    served = f"seed_{product_id}_{fname}"
    with open(os.path.join(HERE, src_rel), "rb") as f:
        data = f.read()
    with open(os.path.join(settings.UPLOAD_DIR, served), "wb") as out:
        out.write(data)
    return f"/uploads/{served}"

DEMO = {"name": "MANTIS Demo Co", "email": "demo@mantis.app", "password": "demo12345"}
PRODUCTS = [
    {
        # Real, public manufacturer manual (Xiaomi). See real_manuals/README for source.
        "name": "Mi Electric Scooter Pro",
        "category": "vehicles",
        "description": "Xiaomi Mi Electric Scooter Pro — folding e-scooter with LCD speedometer and app support.",
        "manual": "real_manuals/mi-scooter-pro.pdf",
        "title": "Mi Electric Scooter Pro — User Manual (official)",
    },
    {
        # Synthetic manual crafted to showcase technician-style troubleshooting (horn -> fuse F3).
        "name": "Volt-S Electric Scooter",
        "category": "vehicles",
        "description": "48V foldable electric scooter with LCD dashboard, LED headlight, and regenerative braking.",
        "manual": "seed_assets/volt-s-scooter-manual.pdf",
        "title": "Volt-S Owner's & Service Manual",
    },
    {
        "name": "AquaPure RO Water Purifier",
        "category": "appliance",
        "description": "Under-sink reverse-osmosis water purifier with 3-stage filtration and filter-life indicators.",
        "manual": "seed_assets/aquapure-ro-manual.pdf",
        "title": "AquaPure User & Service Guide",
    },
]


def get_or_create_company(s: Session) -> Company:
    c = s.exec(select(Company).where(Company.email == DEMO["email"])).first()
    if c:
        return c
    c = Company(
        name=DEMO["name"],
        email=DEMO["email"],
        password_hash=hash_password(DEMO["password"]),
        token=new_token(),
    )
    s.add(c)
    s.commit()
    s.refresh(c)
    return c


def get_or_create_product(s: Session, company: Company, spec: dict) -> Product:
    p = s.exec(
        select(Product).where(Product.company_id == company.id).where(Product.name == spec["name"])
    ).first()
    if p:
        return p
    p = Product(
        company_id=company.id,
        name=spec["name"],
        category=spec["category"],
        description=spec["description"],
    )
    s.add(p)
    s.commit()
    s.refresh(p)
    return p


def main():
    init_db()
    with Session(engine) as s:
        company = get_or_create_company(s)
        print(f"Company: {company.name} <{company.email}>  (id={company.id})")

        for spec in PRODUCTS:
            product = get_or_create_product(s, company, spec)
            existing = s.exec(
                select(Resource)
                .where(Resource.product_id == product.id)
                .where(Resource.title == spec["title"])
            ).first()
            served_path = _serve_copy(product.id, spec["manual"])

            if existing:
                # Backfill the downloadable file on already-seeded products.
                if not existing.file_path:
                    existing.file_path = served_path
                    s.add(existing)
                    s.commit()
                    print(f"  - {product.name} (id={product.id}) - backfilled downloadable manual")
                else:
                    print(f"  - {product.name} (id={product.id}) - already seeded "
                          f"({existing.chunk_count} chunks)")
                continue

            fname = os.path.basename(spec["manual"])
            with open(os.path.join(HERE, spec["manual"]), "rb") as f:
                data = f.read()
            chunk_count = asyncio.run(
                ingest_resource(product.id, data, fname, "application/pdf")
            )
            r = Resource(
                product_id=product.id,
                type="pdf",
                title=spec["title"],
                file_path=served_path,
                indexed=chunk_count > 0,
                chunk_count=chunk_count,
            )
            s.add(r)
            s.commit()
            print(f"  - {product.name} (id={product.id}) - ingested {chunk_count} chunks, downloadable")

        # Demo chat sessions (so Analytics shows real, populated data). Repeated
        # first messages → "this product is most often facing X" with counts.
        demo_sessions = {
            "Mi Electric Scooter Pro": [
                ("How do I charge the scooter?", True),
                ("How do I charge the scooter?", True),
                ("How do I charge the scooter?", True),
                ("What does error code E2 mean?", True),
                ("What does error code E2 mean?", False),
                ("The brakes feel weak", True),
            ],
            "Volt-S Electric Scooter": [
                ("My scooter horn is not working", True),
                ("My scooter horn is not working", True),
                ("My scooter horn is not working", True),
                ("The headlight is not working", True),
                ("The headlight is not working", False),
                ("Battery not charging", True),
            ],
            "AquaPure RO Water Purifier": [
                ("No water is coming out", True),
                ("No water is coming out", True),
                ("Water tastes bad", True),
                ("Red filter light is on", True),
            ],
        }
        for spec in PRODUCTS:
            product = get_or_create_product(s, company, spec)
            existing_sessions = s.exec(
                select(ChatSession).where(ChatSession.product_id == product.id)
            ).first()
            if existing_sessions:
                continue
            for question, resolved in demo_sessions.get(spec["name"], []):
                cs = ChatSession(product_id=product.id)
                s.add(cs)
                s.commit()
                s.refresh(cs)
                s.add(Message(session_id=cs.id, role="user", content=question))
                s.add(
                    Message(
                        session_id=cs.id,
                        role="assistant",
                        content="Here is the guidance based on the manual.",
                        citations_json='[{"source": "manual.pdf", "page": "4"}]' if resolved else "[]",
                    )
                )
                s.commit()
        print("  - demo chat sessions seeded for analytics")

    print("\nDemo login ->  email: demo@mantis.app   password: demo12345")
    print("Start the app, open http://localhost:3000, and try:")
    print('  "My scooter horn is not working" on the Volt-S Electric Scooter')


if __name__ == "__main__":
    main()
