# MANTIS — Master Plan

> **Project:** MANTIS — Intelligent Diagnostic Assistant for Products
> **Event:** 24-Hour Hackathon
> **Mandate:** MOSS must visibly power the assistant. Judging favors a clean, polished,
> working product with smart MOSS use — *fewer features done well*.

---

## 1. Product summary

A platform where **companies** register, list products, and upload support materials
(PDF manuals, docs, images, videos, external links), and **users** browse products and get
a **technician-like diagnostic assistant** that:

1. Understands symptoms
2. Asks follow-up questions
3. Eliminates possible causes
4. Suggests safe checks/tests
5. Identifies probable issues
6. Recommends solutions **with references to the official documents** (source + page)

**Wow feature:** *Image-based troubleshooting* — the user can upload a photo of the problem,
and the assistant interprets it (via Gemini Vision) and folds it into the diagnosis.

---

## 2. The role of MOSS (critical to understand)

MOSS is a **pure retrieval runtime** — sub-10ms hybrid (semantic + keyword) search with
built-in embeddings, cloud-backed (free `MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY` at moss.dev).

MOSS **does NOT**: parse PDFs, chunk text, or generate answers (no LLM).

So the system is a classic RAG split:
- **MOSS = the "R" (Retrieval).** Mandatory and judged — kept visible in the UI.
- **Gemini = the "G" (Generation/Reasoning).** The technician brain on top of MOSS.
- **Parsing + chunking** = our ingest pre-step (MOSS needs clean text chunks).

---

## 3. Architecture

```
            ┌────────────────────────┐
            │   Next.js Frontend     │  marketplace · product page · chat · uploads
            └───────────┬────────────┘
                        │ HTTP + SSE
            ┌───────────▼────────────┐
            │     FastAPI Backend    │
            │  auth · CRUD · ingest  │
            │  · diagnostic loop     │
            └───┬───────┬────────┬───┘
                │       │        │
   SQLite ◄─────┘       │        └─────► uploads/ (files)
  (metadata)            │
                        ▼
        ┌───────────────────────────────┐
        │  Ingest:  DocumentProcessor →  │
        │  chunk_text → MOSS create/load │
        │  Query:   MOSS query(top_k) →  │
        │           Gemini technician →  │
        │           answer + citations   │
        └───────────────────────────────┘
   MOSS Cloud: one index per product → "product-{id}"
```

---

## 4. Tech stack & key reuse

| Concern | Choice / Source |
|---|---|
| Backend | **Python + FastAPI** |
| Frontend | **Next.js** (React, TS, Tailwind) — adapt `moss/apps/moss-llamaindex/frontend` |
| Database | **SQLite** via **SQLModel** |
| File storage | local `uploads/` |
| Retrieval | **MOSS** Python SDK (`pip install moss`) |
| Parsing + OCR | **Lift** `C:\Users\enguv\hari\projects\PII_Deidentification\document_processor.py` (drop Presidio) |
| Chunking | **Reuse** `chunk_text()` from `moss/apps/moss-llamaindex/backend/main.py` |
| LLM (reasoning + vision) | **Gemini** (`google-generativeai`), multimodal |
| Reference patterns | Bajaj (citation prompting), `moss-llamaindex` (SSE chat) |

**Not used (deliberately):** Qdrant, Neo4j, Airflow, Celery, Redis — would bloat the build and
undercut "MOSS powers the assistant."

---

## 5. Data model (SQLModel)

| Model | Fields |
|---|---|
| `Company` | id, name, email (unique), password_hash, created_at |
| `Product` | id, company_id (FK), name, category, description, image_path, created_at |
| `Resource` | id, product_id (FK), type (pdf\|doc\|image\|video\|link), title, file_path \| url, indexed (bool), chunk_count |
| `ChatSession` | id, product_id (FK), created_at |
| `Message` | id, session_id (FK), role (user\|assistant), content, citations_json, image_path (nullable), created_at |

**MOSS index convention:** `product-{product_id}`; chunk metadata `{ "source": filename, "page": "n" }`.

---

## 6. Phases overview

| # | Phase | Goal | Doc |
|---|---|---|---|
| 1 | Scaffold & Setup | Runnable FastAPI + Next.js skeleton; MOSS & Gemini connectivity proven | [phase-1](phase-1-scaffold-and-setup.md) |
| 2 | Marketplace & Auth | Companies register/login; product CRUD; browse/search; product page | [phase-2](phase-2-marketplace-and-auth.md) |
| 3 | Knowledge Repo & Ingest | Upload resources → parse → chunk → MOSS index per product | [phase-3](phase-3-knowledge-repo-and-ingest.md) |
| 4 | Diagnostic Assistant | MOSS retrieval + Gemini technician loop + citations (the heart) | [phase-4](phase-4-diagnostic-assistant.md) |
| 5 | Image Troubleshooting | Photo upload → Gemini Vision → into the diagnostic loop | [phase-5](phase-5-image-troubleshooting.md) |
| 6 | Polish, Seed & Demo | Seed data, UI polish, error handling, demo script, README | [phase-6](phase-6-polish-seed-and-demo.md) |

**Build order rationale:** each phase is independently demoable and builds on the prior. If time
runs short, phases 1–4 alone are a complete, judge-worthy submission; 5–6 are upside.

---

## 7. Phase-level verification criteria

| Phase | "Done" means |
|---|---|
| 1 | `uvicorn` serves `/health`; Next.js dev server loads; a script proves MOSS `create_index`+`query` and a Gemini call both succeed with the configured keys. |
| 2 | Company can register/login; create/edit/delete a product; users can browse + search; product detail page renders. |
| 3 | Uploading a real PDF creates a MOSS index `product-{id}` with chunk_count > 0; resource list shows the file; re-querying MOSS returns relevant chunks with `source`+`page` metadata. |
| 4 | Asking a symptom on a product page triggers a MOSS query, Gemini asks a follow-up when evidence is thin, then returns cause → safe checks → fix with citations; answer streams via SSE; UI shows a "Powered by MOSS ({ms})" badge + source snippets. |
| 5 | Uploading a fault photo in chat yields a Gemini-Vision interpretation that is merged into the diagnosis and cites the manual; scanned/image PDFs are searchable via the OCR path. |
| 6 | App is seeded with ≥1 real product + manual; flows work end-to-end with graceful empty/error states; README + demo script exist. |

---

## 8. Environment / secrets

`.env` (backend):
```
MOSS_PROJECT_ID=...        # free at moss.dev
MOSS_PROJECT_KEY=...
GEMINI_API_KEY=...         # user has this
DATABASE_URL=sqlite:///./mantis.db
UPLOAD_DIR=./uploads
```

**Setup blocker to resolve first:** obtain MOSS credentials (Gemini key already available).

---

## 9. End-to-end demo storyline (target)

1. Company "ScootCo" logs in → adds product "Volt-S Scooter" → uploads the service manual PDF.
2. User opens the Volt-S page → "My horn isn't working."
3. Assistant: "Does the headlight work normally? Is the horn silent or weak?" (follow-up)
4. User answers → Assistant: "Likely a blown horn fuse (F3). Safe check: ... See Fig 4.2, p.23."
   with a MOSS-sourced citation chip + latency badge.
5. User uploads a photo of the fuse box → Assistant confirms which fuse and next step.
