# Phase 6 — Polish, Seed Data & Demo Prep

**Goal:** Turn a working build into a **polished, demoable, judge-ready** product — seeded with real
data, with graceful states, a clean UI, and a rehearsed demo. ("Fewer features done well.")

**Prerequisites:** Phases 1–4 complete (5 strongly recommended).

---

## Task 6.1 — Seed real data
**Sub-tasks**
- Create a seed script: 1 company + 1–2 real products (e.g., a scooter and a home appliance) with
  a **real downloadable manual PDF** each, ingested into MOSS.
- Pre-build / pre-load the MOSS indexes so the demo is instant (mirror the ref app's `SEED_INDEX_NAME` idea).

**Verification**
- Fresh DB + `python scripts/seed.py` → products visible in marketplace with working assistants
  answering real manual questions.

---

## Task 6.2 — UI/UX polish
**Sub-tasks**
- Consistent layout, spacing, typography (Tailwind); responsive on laptop + phone widths.
- Empty states (no products, no resources, no messages), loading skeletons, and toasts for actions.
- Clear visual identity: name/logo, the "Powered by MOSS" badge styled prominently in chat.

**Verification**
- Walk every page at 1280px and 390px widths — no broken layouts; all empty/loading states render.

---

## Task 6.3 — Error handling & resilience
**Sub-tasks**
- Friendly errors for: bad login, upload failures, unsupported file types, MOSS/Gemini downtime.
- Backend input validation; never leak stack traces to the client.

**Verification**
- Trigger each failure path → user sees a helpful message; server logs the detail.

---

## Task 6.4 — Performance & cost sanity
**Sub-tasks**
- Pre-`load_index` for seeded products at startup; reuse a single `MossClient`.
- Cap `top_k`, history length, and image size to keep latency + token cost reasonable.

**Verification**
- Cold-start a chat on a seeded product → first answer within a few seconds; MOSS latency badge shows single/low-double-digit ms.

---

## Task 6.5 — Documentation
**Sub-tasks**
- `README.md`: what it is, architecture diagram, **how MOSS is used**, setup steps, env vars, run commands.
- Short `.env.example` for backend + frontend.
- Note which existing project was reused (PII `DocumentProcessor`) and why.

**Verification**
- A teammate can clone, set keys, and run both servers using only the README.

---

## Task 6.6 — Demo script & dry run
**Sub-tasks**
- Write the 3–4 minute demo flow (see master plan §9): company adds product+manual → user asks symptom →
  follow-up → cited fix → image upload → cited confirmation.
- Rehearse end-to-end at least twice; prepare a fallback (recorded clip / seeded session) in case of network issues.

**Verification**
- Full demo runs start-to-finish in one take within the time limit; MOSS's role is clearly visible.

---

## Phase 6 completion checklist
- [ ] Seed script loads real products + manuals; assistants answer correctly.
- [ ] UI polished + responsive; empty/loading states everywhere.
- [ ] All error paths handled gracefully.
- [ ] Startup pre-loads indexes; latency acceptable.
- [ ] README + `.env.example` complete; reuse documented.
- [ ] Demo script written and rehearsed with a fallback.
