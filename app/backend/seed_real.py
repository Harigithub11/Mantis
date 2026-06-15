"""Add 7 REAL products to the marketplace — real manufacturer manuals (ingested into
MOSS) + real product images, under distinct brand companies, spanning categories so
the category filter is meaningful. Idempotent.

Run from the backend dir (server stopped):  python seed_real.py
Then restart the backend so MOSS reloads the shared index with the new chunks.
"""
import asyncio
import os
import shutil

from sqlmodel import Session, select

from app.auth import hash_password, new_token
from app.config import settings
from app.db import engine, init_db
from app.models import ChatSession, Company, Message, Product, Resource
from app.services.ingest import ingest_resource

HERE = os.path.dirname(__file__)
ASSETS = os.path.join(HERE, "real_assets")
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Each: brand company + real image + real manual (path relative to backend) + a few
# diagnostic sessions whose first messages PARAPHRASE one main issue (to exercise the
# LLM "Common Issues" grouping) plus a couple of distinct issues.
SPECS = [
    {
        "brand": "Sony", "email": "support@sony.example",
        "name": "Sony WH-1000XM4 Headphones", "category": "electronics",
        "description": "Wireless over-ear noise-cancelling Bluetooth headphones with up to 30 hours battery and touch controls.",
        "image": "real_assets/sony-wh1000xm4.jpg", "manual": "real_assets/sony-wh1000xm4.pdf",
        "title": "Sony WH-1000XM4 — Help Guide",
        "sessions": ["No sound from the left ear cup", "Left side has no audio", "The left ear is silent",
                     "Left earcup stopped working", "Won't pair with my phone", "Battery drains very fast"],
    },
    {
        "brand": "Instant Pot", "email": "care@instantpot.example",
        "name": "Instant Pot Duo 7-in-1", "category": "kitchen",
        "description": "7-in-1 multi-function electric pressure cooker — pressure cook, slow cook, rice, steam, sauté, yogurt and warmer.",
        "image": "real_assets/instant-pot-duo.jpg", "manual": "real_assets/instant-pot-duo.pdf",
        "title": "Instant Pot Duo — User Manual",
        "sessions": ["It won't come to pressure", "Not building any pressure", "Steam leaking and it won't pressurize",
                     "Won't reach pressure", "It shows the Burn message", "The lid won't open after cooking"],
    },
    {
        "brand": "Xiaomi", "email": "support@xiaomi.example",
        "name": "Xiaomi Mi Electric Scooter M365", "category": "vehicles",
        "description": "Foldable electric kick scooter with a 30 km range, regenerative braking and a companion app.",
        "image": "real_assets/xiaomi-m365.jpg", "manual": "real_manuals/m365-pro.pdf",
        "title": "Mi Electric Scooter M365 — User Manual (official)",
        "sessions": ["The scooter won't turn on", "It won't power on", "Scooter is dead, no power",
                     "Won't switch on at all", "Battery is not charging", "The brakes feel weak"],
    },
    {
        "brand": "iRobot", "email": "service@irobot.example",
        "name": "iRobot Roomba 690", "category": "appliance",
        "description": "Wi-Fi connected robot vacuum with a 3-stage cleaning system, dirt-detect sensors and app/voice control.",
        "image": "real_assets/roomba.png", "manual": "real_assets/roomba.pdf",
        "title": "Roomba 600 Series — Owner's Guide",
        "sessions": ["Roomba won't charge", "It's not charging on the dock", "Won't dock to recharge",
                     "The battery is not charging", "It won't return to the home base", "The brushes are not spinning"],
    },
    {
        "brand": "Google Nest", "email": "support@nest.example",
        "name": "Google Nest Learning Thermostat", "category": "smart home",
        "description": "Programmable smart thermostat that learns your schedule and controls home heating and cooling from the app.",
        "image": "real_assets/nest-thermostat.jpg", "manual": "real_assets/nest-thermostat.pdf",
        "title": "Nest Learning Thermostat — Installation & Configuration Guide",
        "sessions": ["The thermostat screen is off", "No power, display is blank", "Screen is dead, won't turn on",
                     "It has no power at all", "Won't connect to Wi-Fi", "Heating is not turning on"],
    },
    {
        "brand": "TP-Link", "email": "support@tplink.example",
        "name": "TP-Link Archer A6 Wi-Fi Router", "category": "networking",
        "description": "Dual-band AC1200 Wi-Fi router with MU-MIMO and four gigabit Ethernet ports for home networking.",
        "image": "real_assets/tplink-archer.jpg", "manual": "real_assets/tplink-archer.pdf",
        "title": "TP-Link Archer A6/C6 — User Guide",
        "sessions": ["No internet connection", "I can't get online", "Internet is not working",
                     "There's no internet at all", "Can't open tplinkwifi.net", "I forgot the router admin password"],
    },
    {
        "brand": "Samsung", "email": "support@samsung.example",
        "name": "Samsung Q9FN QLED 4K TV", "category": "electronics",
        "description": "QLED 4K UHD smart TV running the Tizen platform with HDR and built-in streaming apps.",
        "image": "real_assets/samsung-tv.jpg", "manual": "real_assets/samsung-tv.pdf",
        "title": "Samsung Q9FN QLED TV — User Manual",
        "sessions": ["No picture but I have sound", "The screen is black", "Black screen, audio works",
                     "Picture is gone, only sound", "The remote isn't working", "Wi-Fi keeps disconnecting"],
    },
]


def get_or_create_company(s: Session, name: str, email: str) -> Company:
    c = s.exec(select(Company).where(Company.email == email)).first()
    if c:
        return c
    c = Company(name=name, email=email, password_hash=hash_password("brand-demo-12345"), token=new_token())
    s.add(c)
    s.commit()
    s.refresh(c)
    return c


def main():
    init_db()
    with Session(engine) as s:
        for spec in SPECS:
            company = get_or_create_company(s, spec["brand"], spec["email"])
            if s.exec(select(Product).where(Product.company_id == company.id).where(Product.name == spec["name"])).first():
                print(f"  - {spec['name']} already exists; skipping")
                continue

            # image
            img_src = os.path.join(HERE, spec["image"])
            ext = os.path.splitext(img_src)[1] or ".jpg"
            img_name = f"real_{company.id}_{os.path.basename(spec['image'])}"
            shutil.copyfile(img_src, os.path.join(settings.UPLOAD_DIR, img_name))

            product = Product(
                company_id=company.id, name=spec["name"], category=spec["category"],
                description=spec["description"], image_path=f"/uploads/{img_name}",
            )
            s.add(product)
            s.commit()
            s.refresh(product)

            # manual: copy for download + ingest into MOSS
            man_src = os.path.join(HERE, spec["manual"])
            man_name = os.path.basename(spec["manual"])
            served = f"real_{product.id}_{man_name}"
            shutil.copyfile(man_src, os.path.join(settings.UPLOAD_DIR, served))
            with open(man_src, "rb") as f:
                data = f.read()
            print(f"  … ingesting {spec['name']} manual ({len(data)//1024} KB) …")
            try:
                chunks = asyncio.run(ingest_resource(product.id, data, man_name, "application/pdf"))
            except Exception as e:
                chunks = 0
                print(f"  ! MOSS ingest failed ({str(e)[:90]}); manual stays downloadable but unindexed")
            s.add(Resource(
                product_id=product.id, type="pdf", title=spec["title"],
                file_path=f"/uploads/{served}", indexed=chunks > 0, chunk_count=chunks,
            ))
            s.commit()

            for q in spec["sessions"]:
                cs = ChatSession(product_id=product.id)
                s.add(cs)
                s.commit()
                s.refresh(cs)
                s.add(Message(session_id=cs.id, role="user", content=q))
                s.add(Message(session_id=cs.id, role="assistant",
                              content="Here is the guidance based on the manual.",
                              citations_json='[{"source": "manual.pdf", "page": "3"}]'))
                s.commit()
            print(f"  + {spec['name']} (id={product.id}) — {chunks} chunks, image, {len(spec['sessions'])} sessions")

    print("\nDone. Restart the backend so MOSS reloads the shared index.")


if __name__ == "__main__":
    main()
