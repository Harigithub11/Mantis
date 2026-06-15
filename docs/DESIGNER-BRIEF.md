# MANTIS — Designer Brief

> Hand this to the designer. It covers the product, who uses it, every screen, the user
> flows, and the must-have UI details. Goal: a clean, trustworthy, slightly "technical"
> product that a non-technical person can use without confusion.

---

## 1. What MANTIS is (one paragraph)
A platform where **companies** list their products and upload support materials (manuals,
docs, images, videos, links), and **users** get an **intelligent diagnostic assistant** that
troubleshoots problems like a real technician — it asks follow-up questions, rules out causes,
suggests safe checks, and recommends fixes **with references to the official manual**. The
star feature: users can also **upload a photo of the problem** and the assistant interprets it.

**Tone / brand:** trustworthy, calm, helpful-expert (think "a great support technician"),
not playful/gimmicky. Clean, lots of whitespace, readable. Confidence without clutter.

---

## 2. Who uses it (2 personas → 2 areas of the app)
- **User (consumer)** — owns a product, something's wrong, wants help fast. Often on a **phone**,
  standing next to the broken device. Browses products, reads docs, chats with the assistant.
- **Company (manufacturer/seller)** — logs in, lists products, uploads support materials, manages them.

There is **no end-user account/login required to troubleshoot** (keep it frictionless). Only
**companies log in**. (If the designer wants an optional user login for history, mark it as "nice-to-have".)

---

## 3. Sitemap (all screens)

**Public / User area**
1. **Home / Marketplace** — hero + searchable, filterable grid of products.
2. **Product Detail** — product info + Knowledge Repository (resources) + entry to the Assistant.
3. **Diagnostic Assistant (Chat)** — the centerpiece. Can be a panel on the product page and/or a full screen.

**Company area** (behind login)
4. **Company Auth** — Register + Login (two states of one screen).
5. **Company Dashboard** — list of the company's products + "Add product".
6. **Add / Edit Product** — form (name, category, description, image).
7. **Manage Product Resources** — upload & list manuals/docs/images/videos/links (Knowledge Repo admin).

**Global / shared**
8. **Top navigation bar** + **footer** (logo, search, "Browse products", "For companies / Login").
9. **Shared states** — empty states, loading skeletons, error/toast, 404.

Design each screen at **two widths: desktop 1440px and mobile 390px** (chat especially must work on mobile).

---

## 4. Screen-by-screen detail

### 4.1 Home / Marketplace
- **Purpose:** discover a product to get help with.
- **Content:** short hero (headline + one line + search bar), category filter (chips or dropdown),
  responsive **product grid**. Each **product card**: product image, name, category tag, company name,
  short blurb, a subtle "Ask the assistant →" affordance.
- **States:** default grid, search-active (filtered), **empty** ("No products match"), loading skeleton cards.

### 4.2 Product Detail
- **Purpose:** see the product, its docs, and start troubleshooting.
- **Content / data:** large product image, name, category, company, full description.
  - **Knowledge Repository section:** list of resources. Each resource row: type icon
    (PDF / doc / image / video / link), title, and an action (view/download or open link).
  - **Primary CTA:** "Ask the Assistant" / "Troubleshoot an issue" — opens the chat (panel or screen).
- **States:** product with many resources, **product with no resources** (graceful message), loading.

### 4.3 Diagnostic Assistant (Chat) — ★ most important screen
- **Purpose:** the technician conversation. This is what the project is judged on — give it the most love.
- **Layout:** a chat thread. On desktop it can be a right-side panel next to product context; on
  mobile it's full-screen.
- **Message types to design:**
  - **User message bubble** (text; optionally with an attached **image thumbnail**).
  - **Assistant message bubble.** The assistant has TWO modes — design both:
    - **(a) Follow-up question** — short, e.g. "Does the headlight work normally? Is the horn silent or weak?"
      (May include quick-reply chips like "Yes / No / Not sure" — design these.)
    - **(b) Diagnosis answer** — a structured block with clear sections:
      - **Probable cause**
      - **Safe checks / tests** (a short ordered list)
      - **Recommended fix**
      - **References** → **citation chips**, e.g. `📄 Manual · p.23` (tappable → opens that resource/page).
  - **Sources / "Powered by MOSS" element:** a small badge on or under each answer reading
    **"Powered by MOSS · 4 ms"** plus an expandable **"Sources"** panel listing the manual snippets
    used (text excerpt + page + a relevance indicator). This visibly shows the AI is grounded in real
    docs — **please make it a deliberate, attractive component, not an afterthought.**
- **Input area:** text input + **send** + **image-attach button** (camera/upload). When an image is
  attached, show a **thumbnail preview with remove (×)** above the input.
- **States to design:** empty/intro state ("Describe the problem…"), **assistant typing / thinking**
  indicator, streaming answer (text appears progressively), error ("Couldn't reach the assistant — retry"),
  and **no-docs** state (assistant explains it lacks the manual and gives general safe guidance).

### 4.4 Company Auth (Register / Login)
- Two simple forms (toggle or two screens): Register (company name, email, password) and Login (email, password).
- States: default, validation error, submitting.

### 4.5 Company Dashboard
- List/table or cards of the company's products (image, name, category, # resources, edit/delete).
- Prominent **"+ Add product"**. **Empty state** for a brand-new company ("Add your first product").

### 4.6 Add / Edit Product
- Form: name, category (select), description (textarea), **product image upload** (drag-drop + preview).
- States: create vs edit, validation errors, saving.

### 4.7 Manage Product Resources (Knowledge Repo admin)
- **Upload area:** drag-drop files (PDF/doc/image/video) **and** an "add external link" option (title + URL + type).
- **Resource list:** each row = type icon, title, an **"Indexed ✓"** status badge (means the assistant can
  use it) or "Processing…", and a delete action.
- States: uploading/processing, indexed, failed, empty ("No resources yet — upload a manual").

---

## 5. Key user flows (design the screens to support these)

**Flow A — Company onboarding**
Register/Login → Dashboard → Add product (fill form + image) → Manage resources (upload manual →
see "Indexed ✓") → done.

**Flow B — User troubleshooting (the hero flow)**
Home → search/filter → Product card → Product detail → "Ask the Assistant" →
type symptom → assistant asks a **follow-up** → user answers (text or quick-reply) →
assistant gives **diagnosis with citation chips + MOSS badge** → (optional) user **uploads a photo** →
assistant refines the answer → resolved.

**Flow C — Browse the knowledge repo**
Product detail → open/download a manual or external link directly (without chatting).

---

## 6. Design system to deliver (tokens + components)
Please include a **styles/foundations page** and a **components page** so we can map them to code (Tailwind):
- **Color:** primary (action), neutral grays for text/surfaces, plus **semantic colors** for
  success (indexed), warning, error/danger (safety notes), and an accent for the MOSS badge.
- **Typography:** one display/heading family + one body family; define sizes for h1/h2/h3/body/caption.
- **Spacing & radius:** a consistent scale (e.g. 4/8px base); card and button corner radius.
- **Reusable components:** buttons (primary/secondary/ghost, + states), input/textarea/select, card,
  tag/chip, **citation chip**, **MOSS "Powered by" badge**, status badge (Indexed/Processing),
  chat bubbles (user/assistant), quick-reply chips, file/resource row, upload dropzone, nav bar, toast,
  modal/confirm dialog, loading skeleton, empty-state illustration/placeholder.
- **Icons:** a single icon set; need at least PDF, document, image, video, link, send, attach/camera,
  search, edit, delete, check.

---

## 7. Responsive & accessibility
- **Two breakpoints minimum:** desktop **1440** and mobile **390**. The **chat must be fully usable on mobile.**
- Tap targets ≥ 44px; sufficient text contrast (WCAG AA); don't rely on color alone for status.
- Safety/warning text in diagnoses should be visually distinct (the assistant gives "safe checks").

---

## 8. Handoff format (so it drops into our build cleanly)
We'll rebuild the design as React/Next.js + Tailwind components and read the file via **Figma Dev Mode**.
To make that smooth, please:
- Use **Auto Layout** for everything (so spacing/responsiveness translate to flex/grid).
- Use **shared color & text styles / variables** (these become our design tokens).
- Name layers/frames meaningfully (e.g. `ProductCard`, `ChatBubble/Assistant`, `CitationChip`).
- Keep one **frame per screen per breakpoint**, plus the foundations + components pages.
- Mark **interactive states** (hover/active/disabled, empty/loading/error) as variants where possible.
- Export or flag any custom **icons/illustrations/logo** as exportable assets.
- Share the file with **Dev Mode** access + the file URL.

---

## 9. Priority order (if time is tight for the designer)
1. **Diagnostic Assistant (chat)** — incl. follow-up, diagnosis-with-citations, MOSS badge, image attach.
2. **Product Detail** (with resources).
3. **Home / Marketplace**.
4. Company **Dashboard + Add product + Manage resources**.
5. Auth + global states + 404.

The first three carry the demo. The chat screen is the single most important deliverable.
