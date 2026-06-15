# Phase 5 — Image-Based Troubleshooting (wow feature)

**Goal:** Let users attach a **photo of the problem** to a chat turn. Gemini Vision interprets the
image, and that interpretation is folded into the diagnostic loop (MOSS retrieval + reasoning +
citations). Also ensure **scanned/image manuals** are searchable via the OCR ingest path.

**Prerequisites:** Phase 4 (diagnostic loop works), Phase 1 Gemini vision confirmed,
Phase 3 OCR path working.

---

## Task 5.1 — Image upload in chat
**Sub-tasks**
- Extend the chat endpoint to accept an optional image (multipart or base64) alongside the question.
- Save the image to `uploads/`, store `image_path` on the user `Message`.

**Verification**
- Sending a turn with an image persists the file + `image_path`; text-only turns still work.

---

## Task 5.2 — Gemini Vision interpretation
**Sub-tasks**
- `gemini_service`: add an image-aware call that, given the photo + the user's text, produces a
  concise **visual observation** (e.g., "corroded battery terminal", "error code E4 on display",
  "fuse appears blown").
- Feed this observation into: (a) the MOSS retrieval query, and (b) the technician context for the turn.

**Verification**
- For a test fault photo, the model returns a relevant, specific observation that visibly improves the
  MOSS query (retrieved chunks become more on-target) and the final answer references the visual finding.

---

## Task 5.3 — Merge vision into the diagnostic loop
**Sub-tasks**
- Combine visual observation + typed symptom into the retrieval query and the diagnostic state.
- The assistant should reference what it "sees" and still **cite the manual** for the fix.

**Verification**
- End-to-end: upload photo + short text → assistant describes the visible issue, retrieves relevant
  manual chunks, and gives a cited fix that matches the image.

---

## Task 5.4 — Scanned/image manual ingest (OCR closure)
**Sub-tasks**
- Confirm the Phase 3 OCR path (`_process_pdf_with_ocr` / `_process_image`) indexes image-only PDFs
  and standalone images so they are queryable in MOSS.

**Verification**
- Upload a scanned (image-only) PDF manual → `chunk_count>0`; a question answerable only from that
  scanned content returns a correct, cited answer.

---

## Task 5.5 — Frontend: image attach UX
**Sub-tasks**
- Add an image attach button + thumbnail preview in the chat input; show the user's image inline in
  the message thread; loading state while vision+retrieval run.

**Verification**
- User attaches a photo, sees the preview + their image in the thread, and gets a streamed cited answer.

---

## Phase 5 completion checklist
- [ ] Chat accepts + stores image attachments.
- [ ] Gemini Vision produces useful observations from fault photos.
- [ ] Visual findings improve retrieval and appear in the cited answer.
- [ ] Scanned/image manuals are OCR-indexed and answerable.
- [ ] Chat UI supports attaching + displaying images.
