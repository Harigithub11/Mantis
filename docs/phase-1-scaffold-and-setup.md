# Phase 1 — Scaffold & Setup

**Goal:** A runnable, empty-but-wired skeleton — FastAPI backend + Next.js frontend + SQLite —
with **MOSS and Gemini connectivity proven** before any feature work begins.

**Prerequisites:** Python 3.11+, Node.js 20+, MOSS credentials (`MOSS_PROJECT_ID`/`KEY`),
Gemini API key. Tesseract installed (for later OCR — can defer to Phase 3).

---

## Task 1.1 — Repository & folder structure
**Sub-tasks**
- Create project root `C:\Hari\Hackathon\MANTIS\app\` with `backend/` and `frontend/`.
- Backend layout: `app/{main.py,config.py,db.py,models.py,auth.py}`, `app/services/`, `app/routers/`, `uploads/`.
- Add `.gitignore` (`.env`, `__pycache__`, `node_modules`, `*.db`, `uploads/*`).

**Verification**
- `tree`/`ls` shows the structure; no files missing.

---

## Task 1.2 — Backend dependencies & config
**Sub-tasks**
- `requirements.txt`: `fastapi`, `uvicorn[standard]`, `sqlmodel`, `python-multipart`,
  `python-dotenv`, `moss`, `google-generativeai`, `pdfplumber`, `PyPDF2`, `pytesseract`, `pillow`, `passlib[bcrypt]`.
- `config.py`: load `.env` (MOSS keys, GEMINI_API_KEY, DATABASE_URL, UPLOAD_DIR) via pydantic settings.
- Create `.env` from a committed `.env.example`.

**Verification**
- `pip install -r requirements.txt` succeeds in a fresh venv.
- `python -c "from app.config import settings; print(settings.MOSS_PROJECT_ID[:4])"` prints a value (not empty).

---

## Task 1.3 — FastAPI app + health route
**Sub-tasks**
- `main.py`: create `FastAPI()`, add CORS (`allow_origins=["*"]` for dev), include routers (empty for now).
- Add `GET /health` → `{"status":"ok"}`.
- Add `if __name__=="__main__": uvicorn.run("app.main:app", port=8000, reload=True)`.

**Verification**
- `uvicorn app.main:app --reload` starts; `curl http://localhost:8000/health` → `{"status":"ok"}`.

---

## Task 1.4 — Database bootstrap (SQLModel + SQLite)
**Sub-tasks**
- `db.py`: create engine from `DATABASE_URL`, `get_session()` dependency, `init_db()` calling `SQLModel.metadata.create_all`.
- Define a throwaway/minimal model (or stub) to confirm table creation; call `init_db()` on startup.

**Verification**
- Starting the app creates `mantis.db`; `sqlite3 mantis.db ".tables"` lists the table(s) with no errors.

---

## Task 1.5 — MOSS connectivity smoke test
**Sub-tasks**
- `services/moss_service.py`: wrapper class `MossService` holding a `MossClient(id, key)`; async
  `ingest(index, docs)` (create + load) and `query(index, text, top_k, alpha)`.
- Write `scripts/smoke_moss.py`: create a tiny index of 3 docs, `load_index`, `query`, print results.

**Verification**
- `python scripts/smoke_moss.py` prints ≥1 result with a score and sub-second `time_taken_ms`.
- `client.list_indexes()` shows the test index.

---

## Task 1.6 — Gemini connectivity smoke test
**Sub-tasks**
- `services/gemini_service.py`: configure `google.generativeai` with `GEMINI_API_KEY`; helper
  `generate(prompt, images=None)` using a multimodal model (e.g. `gemini-2.0-flash`).
- Write `scripts/smoke_gemini.py`: send a text prompt; print the response. Optionally send a test image.

**Verification**
- `python scripts/smoke_gemini.py` prints a coherent text completion (no auth error).
- (Optional) image input returns a description → confirms vision works for Phase 5.

---

## Task 1.7 — Next.js frontend skeleton
**Sub-tasks**
- Scaffold Next.js (TS + Tailwind) in `frontend/` (or copy & strip `moss/apps/moss-llamaindex/frontend`).
- Add `lib/api.ts` with `API_BASE=http://localhost:8000` and a `fetchJson` helper.
- Home page renders a placeholder "MANTIS" header.

**Verification**
- `npm run dev` serves on `:3000`/`:3001`; home page loads; a test fetch to `/health` succeeds (CORS OK).

---

## Phase 1 completion checklist
- [ ] Backend starts; `/health` OK.
- [ ] SQLite DB + tables created.
- [ ] MOSS smoke test returns results.
- [ ] Gemini smoke test returns a completion.
- [ ] Frontend loads and can call the backend (CORS verified).
- [ ] `.env.example` documents all required keys.
