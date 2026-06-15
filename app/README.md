# MANTIS — Intelligent Product Diagnostic Assistant

Companies upload product manuals and support docs; users get a **technician-grade
troubleshooting assistant** that asks follow-up questions, eliminates causes, suggests
safe checks, and recommends fixes **with citations to the official manual**.

**Powered by MOSS** for retrieval (the mandatory piece) + **Gemini** for reasoning & vision.

```
Manuals → parse → chunk → MOSS index            (ingest)
User symptom → MOSS retrieve → Gemini technician → answer + citations   (diagnose)
```

## How MOSS is used
MOSS is the retrieval engine ("R" in RAG): sub‑10 ms hybrid semantic + keyword search with
built‑in embeddings. We use **one shared index** (`mantis`) and tag every chunk with its
`product_id`; per‑product retrieval uses a MOSS metadata filter. Every assistant answer shows a
**"⚡ Powered by MOSS · N ms"** badge and the exact source chunks it used.

## Architecture
- **Backend** — Python / FastAPI, SQLite (SQLModel), files in `uploads/`.
  - `app/services/parsing.py` — PDF/image/text extraction (pdfplumber → PyPDF2 → Tesseract OCR), per‑page.
  - `app/services/chunking.py` — sentence‑aware ~400‑word chunks.
  - `app/services/ingest.py` — parse → chunk → MOSS (shared index + `product_id` metadata).
  - `app/services/moss_service.py` — MOSS client wrapper (load caching + metadata filter).
  - `app/services/gemini_service.py` — technician reasoning (`diagnose`) + image vision (`describe_image`).
  - `app/routers/` — `companies`, `products`, `resources`, `chat` (SSE).
- **Frontend** — Next.js (React/TS/Tailwind). Chat centerpiece: `components/ChatPanel.tsx`.
  All API access via `lib/api.ts`. (Styling is a baseline; a Figma design slots in as a restyle.)

## Prerequisites
- Python 3.10+, Node.js 20+, Tesseract OCR (for scanned docs / image troubleshooting).
- A **MOSS** project (`MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY`, free at moss.dev).
- A **Gemini** API key.

## Setup
```bash
# Backend
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
# (macOS/Linux: source .venv/bin/activate && pip install -r requirements.txt)
cp .env.example .env        # then fill in MOSS_PROJECT_ID, MOSS_PROJECT_KEY, GEMINI_API_KEY
python -c "import nltk; nltk.download('punkt_tab'); nltk.download('punkt')"

# Frontend
cd ../frontend
npm install
```

`.env` (backend):
```
MOSS_PROJECT_ID=...
MOSS_PROJECT_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
DATABASE_URL=sqlite:///./mantis.db
UPLOAD_DIR=./uploads
```

## Seed demo data (optional but recommended)
Preloads a demo company + 3 products with manuals already indexed (incl. a **real** Xiaomi
scooter manual):
```bash
cd backend
.venv/Scripts/python seed.py
# Demo login →  demo@mantis.app / demo12345
```

## Run
Two terminals:
```bash
# Terminal 1 — backend (http://localhost:8000)
cd backend && .venv/Scripts/python -m uvicorn app.main:app --port 8000

# Terminal 2 — frontend (http://localhost:3000)
cd frontend && npm run dev
```
Open **http://localhost:3000**.

## Demo script
1. Browse → open **Volt-S Electric Scooter** → ask *"My scooter horn is not working."*
   → assistant asks *"Does the headlight work?"* → answer it → it identifies the **horn fuse (F3)**,
   gives safety‑first checks, and cites the manual pages.
2. Open **Mi Electric Scooter Pro** (real manual) → ask *"How do I charge it / what do error codes mean?"*
3. In any chat, **attach a photo** of a fault (e.g. an error display) → it interprets the image and folds it in.
4. Log in (`demo@mantis.app` / `demo12345`) → **Dashboard** → add a product → upload a manual → watch it index.

## Tests
- Backend API/flow: `backend/smoke_api.py`, `smoke_ingest.py`, `smoke_chat.py`, `smoke_vision.py`
  (start the server, then run each with the venv Python).
- Browser end‑to‑end: `frontend/e2e.mjs` (Playwright; backend + frontend running).
