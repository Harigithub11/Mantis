# Phase 2 — Marketplace & Auth

**Goal:** Companies can register/log in and manage products; users can browse and search
products and open a product detail page. (Core Feature #1.)

**Prerequisites:** Phase 1 complete (backend runs, DB works, frontend calls backend).

---

## Task 2.1 — Data models: Company & Product
**Sub-tasks**
- `models.py`: `Company(id, name, email unique, password_hash, created_at)`.
- `Product(id, company_id FK, name, category, description, image_path, created_at)`.
- `init_db()` creates both tables.

**Verification**
- App start creates `company` and `product` tables; `.tables` lists them; FK relationship defined.

---

## Task 2.2 — Company auth (register / login)
**Sub-tasks**
- `auth.py`: `hash_password`/`verify_password` (passlib bcrypt); issue a simple token
  (signed JWT or opaque token stored in-memory/DB) on login.
- `routers/companies.py`: `POST /companies/register`, `POST /companies/login`,
  `GET /companies/me` (token-protected). A `get_current_company` dependency.

**Verification**
- Register a company via curl → 201 + company id.
- Login with correct creds → token; wrong password → 401.
- `GET /companies/me` with token → company; without token → 401.

---

## Task 2.3 — Product CRUD (company-scoped)
**Sub-tasks**
- `routers/products.py`:
  - `POST /products` (auth) — create, `company_id` from token.
  - `PUT /products/{id}` / `DELETE /products/{id}` (auth + ownership check).
  - `GET /products/{id}` (public) — product detail incl. company name.
  - `GET /products` (public) — list with optional `?q=` search + `?category=` filter + pagination.
- Product image upload (multipart) saved to `uploads/`, path stored in `image_path`.

**Verification**
- Create/edit/delete product as owner works; editing another company's product → 403.
- `GET /products?q=scooter` returns matching products; `GET /products/{id}` returns full detail.
- Uploaded product image is retrievable via a static route.

---

## Task 2.4 — Static file serving
**Sub-tasks**
- Mount `uploads/` as static (e.g. `app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR))`).

**Verification**
- An uploaded image opens at `http://localhost:8000/uploads/<file>`.

---

## Task 2.5 — Frontend: marketplace browse + search
**Sub-tasks**
- Home/marketplace page: product grid (image, name, category, company), search box (debounced → `?q=`),
  category filter.
- Card links to `/products/[id]`.

**Verification**
- Grid renders products from `GET /products`; typing in search filters results; clicking a card navigates.

---

## Task 2.6 — Frontend: product detail page
**Sub-tasks**
- `/products/[id]`: header (image, name, category, description, company), tabs/sections for
  **Resources** (Phase 3) and **Ask the Assistant** (Phase 4) — placeholders for now.

**Verification**
- Page loads product by id; shows all fields; placeholders present for resources + chat.

---

## Task 2.7 — Frontend: company dashboard + auth UI
**Sub-tasks**
- Company register/login forms; store token (localStorage); authed dashboard listing the company's products.
- "Add product" + "Edit/Delete" actions wired to the API.

**Verification**
- Register → login → dashboard shows only this company's products; add/edit/delete reflect immediately.
- Logout clears token; protected pages redirect to login.

---

## Phase 2 completion checklist
- [ ] Company register/login/me work; bad creds rejected.
- [ ] Product CRUD with ownership enforcement.
- [ ] Public browse + search + product detail.
- [ ] Images upload + served statically.
- [ ] Frontend: marketplace, product page, company dashboard all functional.
