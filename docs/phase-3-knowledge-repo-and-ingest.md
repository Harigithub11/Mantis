# Phase 3 — Knowledge Repository & Ingest Pipeline

**Goal:** Companies upload support materials (PDF/doc/image/video/link); files are parsed,
chunked, and indexed into **MOSS per product**; users can browse/download resources.
(Core Feature #2 + the ingest half of the MOSS integration.)

**Prerequisites:** Phase 2 (products exist, auth works), Phase 1 MOSS smoke test passing.

---

## Task 3.1 — Resource data model
**Sub-tasks**
- `Resource(id, product_id FK, type[pdf|doc|image|video|link], title, file_path|url, indexed bool, chunk_count int, created_at)`.
- `init_db()` creates the table.

**Verification**
- `resource` table exists with FK to product; columns match.

---

## Task 3.2 — Lift the document parser (from PII project)
**Sub-tasks**
- Copy `C:\Users\enguv\hari\projects\PII_Deidentification\document_processor.py` → `app/services/parsing.py`.
- **Strip Presidio**: remove `presidio_analyzer`/`presidio_anonymizer` imports and the
  `anonymize_text` method (not needed). Keep `_process_pdf`, `_process_pdf_with_ocr`,
  `_process_text`, `_process_image`, `process_document`, and `process_document_file`.
- Expose `extract_text(file_bytes, filename, mime) -> {text, pages:[{page,text}]}` adapting the
  existing return shape; ensure it returns per-page text when available (for citations).

**Verification**
- `python -c "from app.services.parsing import process_document_file; print(...)"` on a sample PDF
  returns non-empty text and page info; no Presidio import errors.
- A scanned/image PDF returns text via the OCR path (Tesseract available).

---

## Task 3.3 — Chunking utility (from MOSS ref app)
**Sub-tasks**
- Copy `chunk_text(text, chunk_size_words=400, overlap_sentences=2)` from
  `moss/apps/moss-llamaindex/backend/main.py` into `app/services/chunking.py`.
- Ensure NLTK punkt is available: `python -c "import nltk; nltk.download('punkt_tab')"`.

**Verification**
- `chunk_text(long_text)` returns a list of chunks, each ≤ ~400 words, with sentence overlap.

---

## Task 3.4 — Ingest service (parse → chunk → MOSS)
**Sub-tasks**
- `services/ingest.py`: `async def ingest_resource(product_id, file_bytes, filename, mime)`:
  1. `extract_text` → per-page text.
  2. For each page, `chunk_text` → build `DocumentInfo(id=f"{filename}-p{page}-c{i}", text, metadata={source,page})`.
  3. `MossService.ingest(f"product-{product_id}", docs)` — `create_index` if new else `add_docs`; then `load_index`.
  4. Return `chunk_count`.
- Handle the "index already exists" case (use `add_docs`/upsert for additional resources on the same product).

**Verification**
- Ingesting a real manual returns `chunk_count > 0`; `list_indexes()` shows `product-{id}`.
- Adding a 2nd document to the same product increases the index's doc count (no overwrite).

---

## Task 3.5 — Resource upload endpoints
**Sub-tasks**
- `routers/resources.py`:
  - `POST /products/{id}/resources` (auth + ownership): accepts file uploads (pdf/doc/image/video)
    OR an external link/url + title + type. Saves file to `uploads/`, creates `Resource`, and for
    text-bearing types runs `ingest_resource`, then sets `indexed=true`, `chunk_count`.
  - `GET /products/{id}/resources` (public): list resources (title, type, download/url, indexed).
  - `DELETE /resources/{id}` (auth + ownership): remove file + DB row (best-effort `delete_docs` from MOSS).

**Verification**
- Upload a PDF as the owner → resource created, `indexed=true`, `chunk_count>0`.
- Upload a video / add a link → stored, listed, not indexed (no text), no error.
- `GET .../resources` lists everything; non-owner upload/delete → 403.

---

## Task 3.6 — Retrieval sanity check (MOSS query on real data)
**Sub-tasks**
- `scripts/smoke_query.py`: given a product id and a question, run `MossService.query("product-{id}", q, top_k=6, alpha=0.6)` and print chunks with score + source + page.

**Verification**
- Querying a manual-related question returns relevant chunks with correct `source`/`page` metadata
  and plausible scores. This is the data Phase 4's LLM will consume.

---

## Task 3.7 — Frontend: resources UI
**Sub-tasks**
- Product page "Resources" section: company view = upload form (file or link, title, type) + delete;
  user view = list with download links / external links and an "indexed ✓" indicator.

**Verification**
- Company uploads a manual from the UI → appears in the list with "indexed ✓".
- User can download/open every resource; videos/links open correctly.

---

## Phase 3 completion checklist
- [ ] Parser lifted, Presidio removed, returns per-page text (incl. OCR).
- [ ] Chunking works (NLTK punkt present).
- [ ] Ingest builds/updates `product-{id}` MOSS index; chunk_count recorded.
- [ ] Upload endpoints handle file + link types with ownership checks.
- [ ] MOSS query returns relevant chunks with source+page metadata.
- [ ] Resources UI for both company (manage) and user (browse/download).
