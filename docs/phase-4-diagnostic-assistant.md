# Phase 4 — Intelligent Diagnostic Assistant (the heart)

**Goal:** A technician-like assistant that, per product, retrieves from MOSS and uses Gemini to
**ask follow-ups, eliminate causes, suggest safe checks, identify probable issues, and recommend
solutions with citations** (source + page). Answers stream via SSE; the UI shows MOSS is powering it.
(Core Feature #3 + the query half of MOSS integration. This is the highest-scoring phase.)

**Prerequisites:** Phase 3 (MOSS index per product returns good chunks), Phase 1 Gemini smoke test.

---

## Task 4.1 — Chat data models & session
**Sub-tasks**
- `ChatSession(id, product_id FK, created_at)`; `Message(id, session_id FK, role, content, citations_json, image_path nullable, created_at)`.
- `POST /products/{id}/chat/sessions` → new session id; messages persisted per turn.

**Verification**
- Creating a session returns an id; messages are stored and retrievable in order.

---

## Task 4.2 — Retrieval step (MOSS) per turn
**Sub-tasks**
- On a user message, build a retrieval query from the latest symptom (+ optional rewrite using
  recent history). Call `MossService.query("product-{id}", q, top_k=6, alpha=0.6)`.
- Capture `time_taken_ms` and each chunk's `text`, `score`, `source`, `page` for citations + the MOSS badge.

**Verification**
- Logged per turn: query text, retrieved chunk ids, scores, and MOSS latency. Chunks are on-topic.

---

## Task 4.3 — Technician system prompt + context assembly
**Sub-tasks**
- Assemble the LLM context: (a) technician **system prompt**, (b) retrieved chunks (with their
  source+page labels), (c) conversation history, (d) a compact **diagnostic state**
  (confirmed symptoms, ruled-out causes) maintained across turns.
- System prompt rules: behave like an experienced technician; if evidence is insufficient, ask **one**
  targeted follow-up question (do NOT dump an answer prematurely); when confident, output:
  **probable cause → safe checks/tests → recommended fix**, and **cite** the manual (source + page)
  for each claim; never invent facts not supported by retrieved chunks; flag safety warnings.

**Verification**
- Vague input ("it's broken") → assistant asks a clarifying question, not a final answer.
- Specific input with good chunks → structured answer with at least one citation tied to a real chunk.

---

## Task 4.4 — Structured Gemini output (answer + citations + state)
**Sub-tasks**
- `gemini_service.diagnose(context) -> {reply, asked_followup:bool, citations:[{source,page,quote}], updated_state}`.
- Use Gemini structured/JSON output (or robust parsing) so the backend can render citation chips and
  persist the diagnostic state for the next turn.

**Verification**
- Response parses into the schema reliably across ≥5 test turns; citations reference chunks actually
  retrieved this turn (no fabricated pages).

---

## Task 4.5 — SSE chat endpoint
**Sub-tasks**
- `POST /products/{id}/chat/{session_id}` (body `{question}`): run retrieval → Gemini → stream the
  reply tokens/segments as SSE events; emit a final event with `{citations, moss_time_ms, chunks}`.
- Persist the user + assistant messages (with citations + state).
- Model the SSE event shape on `moss/apps/moss-llamaindex/backend/main.py` (`type:"shard"`/`"done"`).

**Verification**
- `curl -N` the endpoint streams partial output then a final citations event; messages saved to DB.
- A second turn uses prior state (doesn't re-ask an already-answered question).

---

## Task 4.6 — Frontend chat UI + MOSS visibility
**Sub-tasks**
- Chat panel on the product page: message list, input, streaming render of assistant replies.
- Render **citation chips** ("Manual p.23") that link to / preview the source resource + page.
- Show a **"Powered by MOSS · {time_ms} ms"** badge and an expandable "Sources" panel listing the
  retrieved chunks with scores — makes the mandatory MOSS use visible to judges.

**Verification**
- Asking a symptom streams a live answer; follow-up questions render distinctly; citation chips open
  the right resource; MOSS badge + sources panel display real latency and chunks.

---

## Task 4.7 — Robustness & guardrails
**Sub-tasks**
- Product with **no indexed docs** → assistant says it lacks documentation and offers general safe
  guidance (no hallucinated citations).
- Handle MOSS/Gemini errors gracefully (retry once; user-facing fallback message).
- Cap history/context length to control token usage.

**Verification**
- Querying a doc-less product gives a safe, citation-free message (no crash).
- Simulated MOSS/Gemini failure shows a graceful error, not a stack trace.

---

## Phase 4 completion checklist
- [ ] Per-turn MOSS retrieval with metadata + latency captured.
- [ ] Technician prompt asks follow-ups before concluding.
- [ ] Structured answer with citations tied to real chunks; diagnostic state persists across turns.
- [ ] SSE streaming endpoint + persisted messages.
- [ ] Chat UI with citation chips + "Powered by MOSS" badge + sources panel.
- [ ] Graceful handling of no-docs and API failures.
