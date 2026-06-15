"""Gemini wrapper — the reasoning/generation layer on top of MOSS retrieval.

Multimodal: technician text reasoning + image understanding (Phase 5).
- ``describe_image()`` turns a user's problem photo into a short visual observation
  (used to enrich the MOSS query and the reasoning context).
- ``diagnose()`` produces the structured technician response; if an image is given
  it is passed into the model so the technician can reason over the photo directly.
"""
import asyncio
import io
import json
import logging
import threading
from typing import AsyncGenerator, Dict, List, Optional

import google.generativeai as genai
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)
genai.configure(api_key=settings.GEMINI_API_KEY)


TECHNICIAN_SYSTEM_STREAM = """You are MANTIS, an expert product support technician. You diagnose \
problems methodically, like a seasoned repair technician — NOT a generic chatbot.

- Use ONLY the provided manual excerpts, the conversation, and any photo. Never invent facts, \
part numbers, figures, or pages not supported by the excerpts.
- If you do NOT have enough information to pinpoint the cause, ask EXACTLY ONE specific \
follow-up question and stop there.
- Otherwise answer with: Probable cause; then Safe checks/tests (numbered, safety first); then \
Recommended fix.
- Cite the manual inline right after each specific claim, in the EXACT format (FILENAME p.PAGE) — \
use the exact source filename and page number from the excerpt labels, e.g. (mi-scooter-pro.pdf p.6). \
Only cite pages that appear in the excerpts.
- If NO manual excerpts are provided, say you don't have this product's documentation yet and \
give only general safe guidance.
- SPARE PARTS: when a fix involves replacing or servicing a component, suggest the specific spare \
part, consumable, or accessory by name (and part number if the manual gives one). Only suggest \
parts supported by the excerpts or clearly standard for this product.
- LANGUAGE: reply in the SAME language as the user's most recent message (translate the guidance \
as needed). Default to English if the language is unclear. Keep citations in their original form.
- FORMAT: write a natural, friendly reply in plain text / light markdown — a short sentence for the \
probable cause, a numbered list for the safe checks, then the recommended fix. You may use **bold** \
for section words. DO NOT output JSON, curly braces, quoted keys, or key:value objects. Write \
human-readable prose, as if speaking to the customer.
- FLOWCHART: when your answer is a multi-step diagnostic or repair PROCEDURE, end your reply with \
ONE Mermaid flowchart inside a ```mermaid code block, using `flowchart TD`. Keep it to ~4-8 nodes; \
label decision edges with the condition (e.g. |Yes| / |No|). Put it LAST, after all the prose. \
This is the ONLY code fence you may use — no other code blocks."""


async def stream_diagnose(
    product_name: str,
    chunks: List[Dict],
    history: List[Dict],
    image: Optional[bytes] = None,
    visual_observation: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Yield the technician reply token-by-token as Gemini generates it."""
    prompt = _build_prompt(product_name, chunks, history, {}, visual_observation)
    model = genai.GenerativeModel(settings.GEMINI_MODEL, system_instruction=TECHNICIAN_SYSTEM_STREAM)
    parts: List = [prompt]
    if image is not None:
        img = _open_image(image)
        if img is not None:
            parts.append(img)

    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue()

    def worker():
        try:
            for ch in model.generate_content(parts, stream=True):
                # ch.text can raise (e.g. a chunk with no text part); never let it abort the stream.
                try:
                    txt = ch.text
                except Exception:
                    txt = None
                if txt:
                    loop.call_soon_threadsafe(q.put_nowait, txt)
        except Exception as e:
            logger.error(f"Gemini stream failed: {e}")
            err = str(e)
            if "429" in err or "quota" in err.lower() or "exhausted" in err.lower():
                msg = ("\n\n_(The AI is rate-limited right now — the Gemini API key has hit its "
                       "free-tier quota. Try again shortly, or use a key with billing enabled.)_")
            else:
                msg = "\n\n_(The assistant hit an error — please try again.)_"
            loop.call_soon_threadsafe(q.put_nowait, msg)
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)

    threading.Thread(target=worker, daemon=True).start()
    while True:
        piece = await q.get()
        if piece is None:
            break
        yield piece


TECHNICIAN_SYSTEM = """You are MANTIS, an expert product support technician. You diagnose \
problems methodically, like a seasoned repair technician — NOT like a generic chatbot.

Rules:
- Work ONLY from the provided manual excerpts, the conversation, and any photo/visual observation. \
Never invent facts, part numbers, figures, or page references that are not supported by the excerpts.
- If you do not yet have enough information to identify the cause, ask EXACTLY ONE clear, \
specific follow-up question that best narrows down the cause. Set asked_followup=true.
- When you have enough information, set asked_followup=false and write "reply" with this \
structure: (1) Probable cause, (2) Safe checks/tests to confirm — numbered, safety first, \
(3) Recommended fix.
- If a photo is provided, use what you see (and the visual observation) as evidence and refer to \
it in your reasoning.
- Cite the manual for any specific claim, check, or fix. Put citations in the "citations" array \
as {source, page, quote}, where quote is a short supporting snippet copied from an excerpt.
- If NO manual excerpts are provided, say you don't have this product's documentation yet, give \
only general safe guidance, and return citations=[].
- Always surface any safety warnings. Be concise and friendly.
- Maintain "state": confirmed_symptoms (list), ruled_out (list of excluded causes), \
likely_causes (list).

Return ONLY a valid JSON object with keys: reply (string), asked_followup (boolean), \
citations (array of {source, page, quote}), state (object with confirmed_symptoms, ruled_out, \
likely_causes arrays)."""


def _open_image(image: bytes) -> Optional[Image.Image]:
    try:
        return Image.open(io.BytesIO(image))
    except Exception as e:
        logger.warning(f"could not open image: {e}")
        return None


def describe_image(image: bytes, user_text: str = "") -> str:
    """Return a short, concrete visual observation of a problem photo."""
    img = _open_image(image)
    if img is None:
        return ""
    prompt = (
        "You are a product repair technician looking at a photo a user sent of their problem. "
        "In 1-3 sentences, describe ONLY what is concretely visible and relevant to diagnosing a "
        "fault: visible damage, error codes or text on a display, part condition, indicator lights, "
        "leaks, corrosion, disconnected parts, etc. Do not speculate beyond what is visible. "
        f"For context, the user said: {user_text!r}."
    )
    try:
        return genai.GenerativeModel(settings.GEMINI_MODEL).generate_content([prompt, img]).text.strip()
    except Exception as e:
        logger.warning(f"vision describe failed: {e}")
        return ""


def _parse(text: str, fallback_state: Dict) -> Dict:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw[:4].lower() == "json":
            raw = raw[4:]
        raw = raw.strip()
    try:
        data = json.loads(raw)
    except Exception:
        logger.warning("Gemini output was not valid JSON; wrapping as plain reply")
        return {
            "reply": text or "Sorry, I had trouble processing that. Could you rephrase?",
            "asked_followup": False,
            "citations": [],
            "state": fallback_state,
        }
    data.setdefault("reply", "")
    data.setdefault("asked_followup", False)
    data.setdefault("citations", [])
    data.setdefault("state", fallback_state)
    return data


def _build_prompt(
    product_name: str,
    chunks: List[Dict],
    history: List[Dict],
    state: Dict,
    visual_observation: Optional[str] = None,
) -> str:
    excerpts = "\n\n".join(
        f"[source: {c.get('source', '?')} | page: {c.get('page', '?')}]\n{c.get('text', '')}"
        for c in chunks
    ) or "(no manual excerpts available)"
    convo = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history) or "(start of conversation)"
    vis = (
        f"\nVISUAL OBSERVATION (from the user's uploaded photo):\n{visual_observation}\n"
        if visual_observation
        else ""
    )
    return (
        f"PRODUCT: {product_name}\n\n"
        f"CURRENT DIAGNOSTIC STATE (what you already know):\n"
        f"{json.dumps(state, ensure_ascii=False)}\n\n"
        f"MANUAL EXCERPTS (retrieved for this turn):\n{excerpts}\n{vis}\n"
        f"CONVERSATION:\n{convo}\n\n"
        f"Respond now as the technician. Return ONLY the JSON object."
    )


def diagnose(
    product_name: str,
    chunks: List[Dict],
    history: List[Dict],
    state: Optional[Dict] = None,
    image: Optional[bytes] = None,
    visual_observation: Optional[str] = None,
) -> Dict:
    """Synchronous (call via asyncio.to_thread). Returns the parsed technician response."""
    state = state or {}
    prompt = _build_prompt(product_name, chunks, history, state, visual_observation)
    model = genai.GenerativeModel(settings.GEMINI_MODEL, system_instruction=TECHNICIAN_SYSTEM)

    parts: List = [prompt]
    if image is not None:
        img = _open_image(image)
        if img is not None:
            parts.append(img)

    try:
        resp = model.generate_content(parts, generation_config={"response_mime_type": "application/json"})
        return _parse(resp.text, state)
    except Exception as e:
        logger.error(f"Gemini diagnose failed: {e}")
        return {
            "reply": "The assistant is temporarily unavailable. Please try again in a moment.",
            "asked_followup": False,
            "citations": [],
            "state": state,
        }


def generate_text(prompt: str, model_name: Optional[str] = None) -> str:
    model = genai.GenerativeModel(model_name or settings.GEMINI_MODEL)
    return model.generate_content(prompt).text


def suggest_replies(product_name: str, question: str, reply: str) -> List[str]:
    """When the assistant asks the user a follow-up question, generate up to 3 SHORT
    answer options the user could tap — tailored to that exact question. Returns []
    if the reply isn't a follow-up question."""
    prompt = (
        f"A support assistant for the {product_name} just told the user:\n\"{reply}\"\n\n"
        "If (and ONLY if) this is asking the user a follow-up question to narrow down the "
        "problem, return 3 SHORT (2-5 word) answer options the user could tap to respond, "
        "tailored to that exact question. If it is NOT a question (it's a final answer/fix), "
        'return an empty array. Return ONLY a JSON array of strings.'
    )
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    try:
        resp = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        raw = (resp.text or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw[:4].lower() == "json":
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x).strip() for x in data if str(x).strip()][:3]
    except Exception as e:
        logger.error(f"suggest_replies failed: {e}")
    return []


def cluster_issues(product_name: str, reports: List[str], top: int = 3) -> List[Dict]:
    """Group raw customer problem reports into distinct underlying issues, merging
    differently-worded reports of the SAME problem. Returns the top N as
    [{"label": str, "count": int}] sorted by count desc. Falls back to None on
    failure so the caller can use exact-text grouping instead."""
    if not reports:
        return []
    listing = "\n".join(f"- {r}" for r in reports)
    prompt = (
        f"These are {len(reports)} customer problem reports for the {product_name}. "
        "Group reports that describe the SAME underlying problem even if worded differently "
        "(e.g. 'won't turn on', 'no power', 'it's dead' are one issue). For each group give a "
        'short canonical label (3-6 words) and count = number of reports in it. Return ONLY a '
        'JSON array of {"label": string, "count": number}, sorted by count descending.\n\n'
        f"REPORTS:\n{listing}"
    )
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    try:
        resp = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        raw = (resp.text or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw[:4].lower() == "json":
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        out = []
        if isinstance(data, list):
            for it in data:
                if isinstance(it, dict) and it.get("label"):
                    out.append({"label": str(it["label"]).strip(), "count": int(it.get("count", 1))})
        out.sort(key=lambda x: x["count"], reverse=True)
        return out[:top] if out else None
    except Exception as e:
        logger.error(f"cluster_issues failed: {e}")
        return None


def generate_product_insights(product_name: str, top_issues: List[Dict]) -> Dict:
    """From the most-reported issues, produce two short company-facing insights:
    a behaviour-trend observation and a product growth/improvement suggestion.
    Returns {"behaviour_trends": str, "growth_suggestion": str}."""
    if not top_issues:
        return {"behaviour_trends": "", "growth_suggestion": ""}
    issues_text = "\n".join(f"- {i.get('label', '')} ({i.get('count', 0)} reports)" for i in top_issues)
    prompt = (
        f"You are a product strategy analyst for the {product_name}. Based ONLY on these "
        f"real most-reported customer issues from diagnostic sessions:\n{issues_text}\n\n"
        "Return ONLY a JSON object with two keys:\n"
        '- "behaviour_trends": 1-2 sentences describing the pattern/trend you see in what '
        "customers are struggling with.\n"
        '- "growth_suggestion": 1-2 sentences recommending a concrete product or feature '
        "improvement to reduce these issues.\n"
        "Be specific to the issues above. No preamble, no markdown."
    )
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    try:
        resp = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        raw = (resp.text or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw[:4].lower() == "json":
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        return {
            "behaviour_trends": str(data.get("behaviour_trends", "")).strip(),
            "growth_suggestion": str(data.get("growth_suggestion", "")).strip(),
        }
    except Exception as e:
        logger.error(f"generate_product_insights failed: {e}")
        return {"behaviour_trends": "", "growth_suggestion": ""}


def extract_maintenance(product_name: str, text: str) -> List[Dict]:
    """Extract maintenance tasks from manual text. Returns [{task, interval}]."""
    prompt = (
        f"From the following {product_name} manual text, extract recurring MAINTENANCE tasks and "
        f"their intervals (e.g. 'Replace filter' / 'every 12 months'). Only include real scheduled "
        f"maintenance, not troubleshooting. Return ONLY a JSON array of objects with keys "
        f'"task" and "interval". If none, return [].\n\nMANUAL TEXT:\n{text[:8000]}'
    )
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    try:
        resp = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        raw = (resp.text or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw[:4].lower() == "json":
                raw = raw[4:]
            raw = raw.strip()
        data = json.loads(raw)
        out = []
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("task"):
                    out.append({"task": str(item["task"]), "interval": str(item.get("interval", ""))})
        return out[:20]
    except Exception as e:
        logger.error(f"extract_maintenance failed: {e}")
        return []
