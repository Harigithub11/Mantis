"""Diagnostic assistant — SSE chat. The heart of MANTIS.

Per turn: persist user msg → MOSS retrieve (top_k) → Gemini technician reasoning →
stream the reply as SSE → persist assistant msg + updated diagnostic state.

SSE event types:
  meta   {moss_time_ms, chunks:[{id,text,score,source,page}]}   — emitted first
  delta  {text}                                                  — streamed reply segments
  final  {reply, asked_followup, citations:[{source,page,quote}]}
  done   {}
"""
import asyncio
import json
import logging
import os
import re
import uuid
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session as DBSession
from sqlmodel import select

from app.config import settings
from app.db import engine, get_session
from app.models import ChatSession, Message, Product
from app.services.gemini_service import describe_image, stream_diagnose, suggest_replies
from app.services.ingest import SHARED_INDEX, product_filter
from app.services.moss_service import moss_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

HISTORY_LIMIT = 10

# Matches inline citations the model writes, e.g. "(mi-scooter-pro.pdf p.6)" or
# "(mi-scooter-pro.pdf, page 6)". Group 1 = filename, group 2 = page number.
_CITE_RE = re.compile(
    r"\(\s*([^()]+?\.(?:pdf|docx?|txt|png|jpe?g))\s*,?\s*p(?:age|\.)?\s*(\d+)\s*\)",
    re.IGNORECASE,
)


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}\n\n"


def _format_if_json(text: str) -> str:
    """If the model emitted a JSON object instead of prose, render it as readable
    markdown. Otherwise return the text unchanged."""
    s = text.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s[:4].lower() == "json":
            s = s[4:]
        s = s.strip()
    if not s.startswith("{"):
        return text
    try:
        data = json.loads(s)
    except Exception:
        return text
    if not isinstance(data, dict):
        return text
    if isinstance(data.get("reply"), str):
        return data["reply"]

    parts = []

    def add(label, val):
        if not val:
            return
        if isinstance(val, list):
            body = "\n".join(f"{i + 1}. {x}" for i, x in enumerate(val))
            parts.append(f"**{label}**\n{body}")
        else:
            parts.append(f"**{label}**\n{val}")

    add("Probable cause", data.get("probable_cause") or data.get("cause"))
    add("Safe checks", data.get("safe_checks_tests") or data.get("safe_checks") or data.get("checks"))
    add("Recommended fix", data.get("recommended_fix") or data.get("fix") or data.get("recommendation"))
    if not parts:  # unknown shape — render every field generically
        for k, v in data.items():
            add(str(k).replace("_", " ").capitalize(), v)
    return "\n\n".join(parts) if parts else text


def _segments(text: str, words_per: int = 8):
    words = text.split(" ")
    for i in range(0, len(words), words_per):
        seg = " ".join(words[i : i + words_per])
        yield seg + (" " if i + words_per < len(words) else "")


@router.post("/products/{product_id}/chat/sessions")
def create_session(product_id: int, session: DBSession = Depends(get_session)):
    if not session.get(Product, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    cs = ChatSession(product_id=product_id)
    session.add(cs)
    session.commit()
    session.refresh(cs)
    return {"session_id": cs.id, "product_id": product_id}


@router.get("/chat/{session_id}/messages")
def get_messages(session_id: int, session: DBSession = Depends(get_session)):
    if not session.get(ChatSession, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    rows = session.exec(
        select(Message).where(Message.session_id == session_id).order_by(Message.id)
    ).all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "citations": json.loads(m.citations_json or "[]"),
            "image_path": m.image_path,
            "feedback": m.feedback,
        }
        for m in rows
    ]


@router.post("/chat/messages/{message_id}/feedback")
def set_feedback(message_id: int, body: dict, session: DBSession = Depends(get_session)):
    """Record 👍/👎 on an assistant answer. rating ∈ {good, bad, null}; null clears it.
    This is what drives the real resolution rate (good ÷ rated)."""
    m = session.get(Message, message_id)
    if not m or m.role != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")
    rating = body.get("rating")
    if rating not in ("good", "bad", None):
        raise HTTPException(status_code=400, detail="rating must be 'good', 'bad' or null")
    m.feedback = rating
    session.add(m)
    session.commit()
    return {"id": message_id, "feedback": rating}


@router.post("/products/{product_id}/chat/{session_id}")
async def chat(
    product_id: int,
    session_id: int,
    question: str = Form(...),
    image: Optional[UploadFile] = File(None),
):
    # Validate session ↔ product and load context up front.
    with DBSession(engine) as db:
        cs = db.get(ChatSession, session_id)
        if not cs or cs.product_id != product_id:
            raise HTTPException(status_code=404, detail="Session not found for this product")
        product = db.get(Product, product_id)
        product_name = product.name if product else f"Product {product_id}"

    # Read + persist any attached image up front (UploadFile isn't safe to read
    # inside the streaming generator once the request scope advances).
    image_bytes: Optional[bytes] = None
    image_path: Optional[str] = None
    if image is not None:
        image_bytes = await image.read()
        ext = os.path.splitext(image.filename or "")[1] or ".png"
        fname = f"chat_{session_id}_{uuid.uuid4().hex[:8]}{ext}"
        with open(os.path.join(settings.UPLOAD_DIR, fname), "wb") as f:
            f.write(image_bytes)
        image_path = f"/uploads/{fname}"

    async def generate() -> AsyncGenerator[str, None]:
        # 1. Load history + state, persist the user's message (with image if any).
        with DBSession(engine) as db:
            cs = db.get(ChatSession, session_id)
            state = json.loads(cs.state_json or "{}")
            prior = db.exec(
                select(Message).where(Message.session_id == session_id).order_by(Message.id)
            ).all()
            history = [{"role": m.role, "content": m.content} for m in prior][-HISTORY_LIMIT:]
            db.add(Message(session_id=session_id, role="user", content=question, image_path=image_path))
            db.commit()

        # 2. If a photo is attached, derive a visual observation (enriches retrieval + reasoning).
        observation = None
        if image_bytes is not None:
            observation = await asyncio.to_thread(describe_image, image_bytes, question)

        retrieval_query = question if not observation else f"{question}\n{observation}"

        # 3. Retrieve from MOSS (graceful if the product has no index yet).
        chunks = []
        moss_ms = None
        try:
            res = await moss_service.query(
                SHARED_INDEX, retrieval_query, top_k=6, alpha=0.6,
                filter=product_filter(product_id),
            )
            moss_ms = getattr(res, "time_taken_ms", None)
            chunks = [
                {
                    "id": d.id,
                    "text": d.text[:240],  # snippet for the Sources panel (keeps the event small)
                    "score": round(d.score, 3),
                    "source": (d.metadata or {}).get("source", "?"),
                    "page": (d.metadata or {}).get("page", "?"),
                }
                for d in res.docs
            ]
        except Exception as e:
            logger.warning(f"MOSS query failed: {e}")

        yield _sse(
            {"type": "meta", "moss_time_ms": moss_ms, "chunks": chunks, "observation": observation}
        )

        # 4. Stream the technician reply token-by-token as Gemini generates it.
        #    Peek the first content: if the model wrongly starts a JSON object, switch
        #    to buffer mode and reformat it to clean text instead of streaming braces.
        history_for_llm = history + [{"role": "user", "content": question}]
        parts = []
        live = None  # None=undecided, True=stream live, False=buffer & reformat
        async for piece in stream_diagnose(
            product_name, chunks, history_for_llm, image_bytes, observation
        ):
            parts.append(piece)
            if live is None:
                head = "".join(parts).lstrip()
                if not head:
                    continue
                if head[0] == "{" or head.startswith("```"):
                    live = False  # looks like JSON → don't stream raw braces
                else:
                    live = True
                    yield _sse({"type": "delta", "text": "".join(parts)})
                    continue
            if live:
                yield _sse({"type": "delta", "text": piece})

        reply = "".join(parts)
        if live is False:
            reply = _format_if_json(reply)
            yield _sse({"type": "delta", "text": reply})

        # Citations = the pages the model actually cited inline, validated against the
        # chunks MOSS retrieved this turn (LLM-curated + grounded). Falls back to the
        # top retrieved sources if the model didn't cite in the expected format.
        valid = {(c.get("source"), str(c.get("page"))) for c in chunks}
        cited = _CITE_RE.findall(reply)
        citations, seen = [], set()
        for src, pg in cited:
            key = (src.strip(), pg)
            if key in valid and key not in seen:
                seen.add(key)
                citations.append({"source": key[0], "page": key[1]})
        if not citations:
            for c in chunks[:3]:
                key = (c.get("source"), str(c.get("page")))
                if key not in seen:
                    seen.add(key)
                    citations.append({"source": key[0], "page": key[1]})

        # 5. Persist assistant message first so we can hand its id to the client
        #    (the 👍/👎 feedback buttons need it to record a rating).
        with DBSession(engine) as db:
            msg = Message(
                session_id=session_id,
                role="assistant",
                content=reply,
                citations_json=json.dumps(citations),
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)
            message_id = msg.id

        # Dynamic quick-replies: only when the assistant is asking a follow-up
        # question (not on a final solution). Tailored to the exact question.
        suggestions = []
        if reply.rstrip().endswith("?"):
            suggestions = await asyncio.to_thread(suggest_replies, product_name, question, reply)

        yield _sse(
            {
                "type": "final",
                "message_id": message_id,
                "reply": reply,
                "asked_followup": bool(suggestions),
                "suggestions": suggestions,
                "citations": citations,
            }
        )
        yield _sse({"type": "done", "message_id": message_id})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
