"""Populate realistic resolution-rate data by rating assistant answers ~90% good /
~10% bad via the real feedback endpoint. Backend must be running.

    python gen_feedback.py
"""
import requests
from sqlmodel import Session, select

from app.db import engine
from app.models import Message

BASE = "http://localhost:8000"


def main():
    with Session(engine) as s:
        ids = [m.id for m in s.exec(
            select(Message).where(Message.role == "assistant").order_by(Message.id)
        ).all()]
    good = bad = 0
    for i, mid in enumerate(ids):
        rating = "bad" if i % 10 == 9 else "good"  # ~10% bad
        r = requests.post(f"{BASE}/chat/messages/{mid}/feedback", json={"rating": rating})
        if r.status_code == 200:
            good += rating == "good"
            bad += rating == "bad"
    total = good + bad
    print(f"Rated {total} answers via the endpoint: {good} good, {bad} bad "
          f"({round(100*good/total) if total else 0}% resolution).")


if __name__ == "__main__":
    main()
