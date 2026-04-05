# Zorvyn — Financial Backend (Dashboard API)

This repository is a **complete backend** for a finance-style dashboard: people, roles, money movements, summaries, and strict access rules. It was built as a **practical assignment piece** — clear structure over clever tricks, honest assumptions, and something a reviewer can run, read, and trust.

**Brand:** **Financial Backend** · *Supported by Zorvyn* · **Release:** *Updated V0.9*

**API reference (`/docs`):** Custom **Zorvyn** header + **[RapiDoc](https://rapidocweb.com/)** for browsing and **Try** requests. There is **no Swagger UI** in this project — the OpenAPI spec is still generated in Nest for tooling, but the browser experience is RapiDoc + your branding. Machine-readable spec: **`GET /openapi.json`**.

---

## Will edits “automatically” show in VS Code?

Yes, **if both tools point at the same folder on disk**. When you (or Cursor) save files in `finance-dashboard-api`, those files update immediately. VS Code does not need a special sync: **open the same project folder** in VS Code and you see the latest content. If you use **Git**, run `git pull` on the machine where you use VS Code to get updates pushed from another computer.

---

## The big picture (backend vs “dashboard” you see in the browser)

| What you might expect | What this repo actually is |
|----------------------|----------------------------|
| A screen with charts and tables | **Not included.** That would be a **frontend** (React, Vue, etc.) living in another project. |
| A way to **call** the API and prove it works | **Yes.** Open **`/docs`** — **RapiDoc** (Try requests, JWT auth). You log in, then call `GET /dashboard/summary` and see the **JSON** a future dashboard would graph. |
| Health check for monitors | **`GET /health`** — no login; returns `status`, service name, and **Updated V0.9**. |

So: **everything here is the engine room.** The “dashboard” in the assignment sense is **the data and endpoints** (`/dashboard/summary`, `/records`, …). The **pretty UI** is intentionally out of scope so evaluators can focus on **API design, data, and access control**.

---

## What we built (nothing important missing)

### 1. People and roles

- **Users** with email, name, hashed password, **role** (`VIEWER` | `ANALYST` | `ADMIN`), and **status** (`ACTIVE` | `INACTIVE`).
- **Inactive** users cannot use the API (blocked at login and again when the JWT is validated).
- **Admin** can list users, create users, and update users (including role and status).

### 2. Role-based access (RBAC)

Permissions live in one place (`src/common/permissions.ts`) and are enforced with a **guard** so behavior is predictable.

| Capability | Viewer | Analyst | Admin |
|------------|--------|---------|-------|
| `GET /dashboard/summary` | Yes | Yes | Yes |
| `GET /records`, `GET /records/:id` | No | Yes (sees all rows) | Yes (sees all rows) |
| `POST` / `PATCH` / `DELETE` records | No | No | Yes |
| `GET /users`, `GET /users/:id` | No | No | Yes |
| `POST` / `PATCH` users | No | No | Yes |
| `GET /users/me` (own profile) | Yes | Yes | Yes |

### 3. Financial records (the “ledger lines”)

Each record: **amount** (decimal, no float mistakes), **type** (`INCOME` | `EXPENSE`), **category**, **date** (`occurredAt`), optional **notes**, soft **delete** (`deletedAt`).

- **CRUD** as required; **filters**: date range, category, type, **pagination**, **full-text search on `notes`** (PostgreSQL English dictionary + `websearch_to_tsquery`).
- **Admin** may attach a record to another user; others may not.

### 4. Dashboard-style aggregates

`GET /dashboard/summary` returns **totals** (income, expense, net), **per-category** breakdown, **recent activity**, and **weekly or monthly trends** (database-side `date_trunc`, not “load everything into memory”).

### 5. Auth, validation, errors

- **JWT** after `POST /auth/login`; standard header `Authorization: Bearer <token>` (see **Why `Bearer`?** below — we do **not** use a custom word like `Zorvee`).
- **Validation** with `class-validator` + global `ValidationPipe` (unknown fields rejected where configured).
- **Consistent errors** via a global filter: validation becomes a readable `VALIDATION_ERROR` payload where appropriate.

### 6. Persistence and quality-of-life

- **PostgreSQL** + **Prisma** + **migrations** (including an index for note search).
- **Rate limiting** (throttle) to show awareness of abuse.
- **Tests:** unit tests for core services, permissions, guards, amount parsing; a small **e2e** test for `/health` without needing a database.
- **`/docs`:** Zorvyn-branded top bar + **RapiDoc**; **`/openapi.json`** for Postman, codegen, or other OpenAPI tools.

### 7. Demo / seed data (Zorvyn-themed summary entries)

`npm run db:seed` creates:

- **3 users:** `admin@zorvyn.com`, `analyst@zorvyn.com`, `viewer@zorvyn.com` (passwords in the table below).
- **10 financial records** (all attached to the admin user for a clear demo), with **realistic categories and notes** so dashboard math and search look real:

  | # | Type   | Category (sample)              | Notes flavour                          |
  |---|--------|---------------------------------|----------------------------------------|
  | 1 | INCOME | Operating — Payroll deposit     | Zorvyn ops / payroll ref               |
  | 2 | INCOME | Accounts Receivable — Client A  | Invoice / wire                         |
  | 3 | INCOME | Accounts Receivable — Client B    | Milestone / ACH                        |
  | 4 | INCOME | Interest — Savings               | Treasury / account mask                |
  | 5 | EXPENSE| Operating — Rent                 | Lease contract ref                     |
  | 6 | EXPENSE| Operating — Utilities          | Utility account id                     |
  | 7 | EXPENSE| Software subscriptions          | Seats / vendor receipt                 |
  | 8 | EXPENSE| Meals & entertainment           | Policy / receipt ref                   |
  | 9 | EXPENSE| Payroll — Contractor            | 1099 / contractor id                   |
  | 10| EXPENSE| Bank fees                       | Statement line                         |

  Full text is in [`prisma/seed.ts`](prisma/seed.ts). Search demo: query param **`search=Zorvyn`** on `GET /records`.

### 8. Scalability (how this design grows)

- **Stateless API** — JWT in header; you can run **multiple Node instances** behind a load balancer (same `JWT_SECRET` everywhere).
- **Database-first aggregates** — totals and trends use **SQL** (`SUM`, `GROUP BY`, `date_trunc`), not loading all rows into RAM.
- **Indexes** — `user_id` + `occurred_at`, `category`, `type`, `deleted_at`, plus **full-text** on `notes`.
- **Pagination** — list endpoints cap page size (e.g. max 100) to avoid huge responses.
- **Next steps at scale** — read replicas for heavy reporting, cache hot summary ranges, materialized monthly rollups, queue for async jobs (out of scope for this repo but the API shape supports it).

---

## Demo logins (after `npm run db:seed`)

| Email | Password | Role |
|-------|----------|------|
| `admin@zorvyn.com` | `Cracked@993` | Admin |
| `analyst@zorvyn.com` | `Insight@993` | Analyst |
| `viewer@zorvyn.com` | `Observe@993` | Viewer |

**Security:** These are for **local/demo and assignment review**. Before any **public** deployment, change passwords (especially admin), set a long random `JWT_SECRET`, and treat these accounts as disposable.

### Login returns **401** even with the table above?

That almost always means the **database does not have these users yet** (or still has old `example.com` accounts only). The API answers with the same “invalid credentials” message whether the email is missing or the password is wrong.

**Fix (pick one):**

1. **Preferred — refresh users without wiping everything** (if migrations already ran):

   ```bash
   npm run db:seed
   ```

2. **If that does not help — full local reset** (deletes **all** data in that database):

   ```bash
   npx prisma migrate reset
   npm run db:seed
   ```

Before either: **Docker / Postgres must be running**, and `.env` **`DATABASE_URL`** must point at that database. Then restart `npm run start:dev` and try login again.

---

## What is `access_token`?

When you **log in**, the API checks your email and password. If they are correct, the server creates a **JWT** (JSON Web Token) — a signed string that means “this request is allowed for this user until the token expires.”

In our JSON response, that string is the field **`access_token`** (note the spelling: **`access_token`**, not `access_tocken`).

Your app (or **RapiDoc** on `/docs`) sends it on later requests using the standard header:

`Authorization: Bearer <token>`

So: **`access_token`** = temporary proof of who you are, without sending your password every time.

---

## Why `Bearer`? Can we use `Zorvee` instead?

**`Bearer` is not a password** — it is the **scheme name** defined in **[RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750)** for OAuth 2.0 bearer tokens over HTTP. The header looks like:

`Authorization: Bearer <your-jwt-here>`

Almost every client (browsers, `fetch`, Postman, OpenAPI “HTTP bearer” security, **Passport JWT**) expects exactly **`Bearer`**. If we renamed it to **`Zorvee`**, we would need **custom** header parsing and **non-standard** OpenAPI docs, and **standard tools would stop working**.

So: **`Bearer` is effectively mandatory** for interoperable JWT APIs. We keep **`Zorvyn`** in your **product name and UI**, not in the HTTP scheme keyword.

---

## `/docs` — login, authenticate, and avoid common mistakes

### 1. Start the API and open the page

`npm run start:dev` → browser → `http://localhost:3000/docs` (use your deployed host + `/docs` if not local).

### 2. Log in (`POST /auth/login`)

1. Expand **Auth** → **`POST /auth/login`** in the left nav.
2. Use **Try** (or the request panel) with a JSON body, for example:

   ```json
   {
     "email": "admin@zorvyn.com",
     "password": "Cracked@993"
   }
   ```

3. Send the request and read the **response** (status **200**).

### 3. Where is `access_token`?

In the **response body** for **200** (below the request panel in RapiDoc).

You should see JSON like:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
  "token_type": "Bearer",
  "user": { ... }
}
```

Copy **only** the long string inside the quotes after `"access_token"` (no quotes).

**If you do not see this:**

| Status / symptom | Likely cause |
|------------------|--------------|
| **401** + invalid credentials | Wrong email/password, or user not seeded. Run `npm run db:seed` (and fix Docker/DB first). |
| **Cannot connect** | API not running or wrong URL/port. |
| **400** + validation | Body not JSON, wrong field names (`email` / `password` required), password too short. |
| Empty or HTML | You opened the wrong URL (not `/docs` or not the API). |

### 4. Authenticate (JWT)

In **RapiDoc**, open the **Authentication** / lock area (or per-operation auth if shown). For **HTTP bearer**:

1. Paste **only** the `access_token` value (`eyJ...`). **Do not** type `Bearer` yourself — the client adds the standard `Authorization: Bearer …` header. Typing `Bearer` again causes **`Bearer Bearer …`** and **401** on protected routes.
2. Apply / save so subsequent **Try** calls include the token.

**If calls still return 401:** double-`Bearer`, expired token (log in again), or extra quotes around the token.

**Deployed hosts:** set **`PUBLIC_API_URL`** in `.env` (e.g. `https://your-app.up.railway.app`) so “Try” calls hit the correct base URL (see `.env.example`).

---

## Try every feature — good vs bad results

Use **admin** unless the table says otherwise. After JWT is set in RapiDoc, **Try** each call from `/docs`.

| # | Action | Good result | Bad / expected “error” (by design) |
|---|--------|-------------|-------------------------------------|
| 1 | `GET /health` (no JWT) | **200** — `status: ok`, `version: Updated V0.9` | Connection refused → server off |
| 2 | `POST /auth/login` correct body | **200** — `access_token` + `user` | **401** wrong password |
| 3 | `GET /users/me` (authorized) | **200** — your profile | **401** if not authorized |
| 4 | `GET /users` | **200** — list (admin) | **403** as viewer/analyst |
| 5 | `GET /dashboard/summary` | **200** — totals, `byCategory`, `recentActivity`, `trends` | **401** without login |
| 6 | `GET /records` | **200** — `data` array + `meta` (admin/analyst) | **403** as viewer |
| 7 | `GET /records` + `search=Zorvyn` | **200** — filtered rows | **200** empty `data` if nothing matches |
| 8 | `POST /records` valid body | **201/200** — created record | **400** bad amount; **403** viewer/analyst |
| 9 | `PATCH /records/{id}` | **200** — updated | **404** wrong id |
| 10 | `DELETE /records/{id}` | **200** — soft delete message | **404** wrong id |
| 11 | Login as **viewer**, `GET /records` | **403** | Proves RBAC |
| 12 | Login as **analyst**, `POST /records` | **403** | Proves analyst read-only |
| 13 | `POST /auth/login` bad JSON | **400** `VALIDATION_ERROR` | Normal validation |

**Example `POST /records` body (admin):**

```json
{
  "amount": "99.50",
  "type": "EXPENSE",
  "category": "Office supplies",
  "occurredAt": "2026-04-04T12:00:00.000Z",
  "notes": "Zorvyn demo line"
}
```

---

## Local setup (Windows / macOS / Linux)

1. **Clone or open** this folder in VS Code / Cursor.
2. **Environment**

   ```bash
   copy .env.example .env
   ```

   Edit `.env` if needed (`DATABASE_URL`, `JWT_SECRET`).

3. **Database** — Docker (start **Docker Desktop** first):

   ```bash
   docker compose up -d
   ```

4. **Install & migrate & seed**

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run db:seed
   ```

5. **Run**

   ```bash
   npm run start:dev
   ```

6. **URLs**

   - API root: `http://localhost:3000`
   - **Health:** `http://localhost:3000/health`
   - **Docs:** `http://localhost:3000/docs`

### If you already seeded old data

To reload **new** Zorvyn users and ledger lines (**wipes local DB**):

```bash
npx prisma migrate reset
npm run db:seed
```

### How to **see** the dummy ledger entries

1. Open **`/docs`** → **Auth** → **`POST /auth/login`** with `admin@zorvyn.com` / `Cracked@993`.
2. In RapiDoc’s **Authentication** (bearer), paste **only** the `access_token` value (no extra `Bearer` prefix).
3. **Financial records** → **`GET /records`** → **Try** (optionally `search=Zorvyn` or `search=payroll`).
4. **Dashboard** → **`GET /dashboard/summary`** → **Try** — totals and categories reflect those lines.

---

## Tests and build

```bash
npm test
npm run test:e2e
npm run build
```

---

## GitHub: push this project (first time)

In a terminal **inside** `finance-dashboard-api`:

```bash
git init
git add .
git commit -m "Zorvyn financial backend — Updated V0.9"
```

On GitHub: **New repository** (empty, no README). Then:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Future changes:

```bash
git add .
git commit -m "Describe your change"
git push
```

VS Code: **Source Control** panel can do the same (stage → commit → push) once the remote exists.

---

## What are `LoginDto`, `CreateUserDto`, `UpdateUserDto`, …?

Those files are **DTOs** (Data Transfer Objects): plain TypeScript classes that describe **the shape of JSON** for a request or response.

| File / pattern | Role |
|----------------|------|
| **`LoginDto`** | Body for `POST /auth/login`: `email`, `password`. Validates format before your password is checked. |
| **`CreateUserDto`** | Body for `POST /users`: new user fields (email, password, name, role, …). |
| **`UpdateUserDto`** | Body for `PATCH /users/:id`: only fields you want to change. |
| Similar under **`records/dto/`** | Create / update / query financial records (amount, type, dates, `search`, pagination). |

**Why they exist:** one place for **validation rules** (with `class-validator`) and for **OpenAPI** so `/docs` shows the right examples. They are **not** a separate database table — they are the contract between client and API.

---

## Security & constraints (backend — what is enforced)

| Layer | What we use |
|-------|-------------|
| **Passwords** | Stored as **bcrypt** hashes, never plain text in the DB. |
| **Sessions** | **JWT** after login; `JWT_SECRET` signs tokens; inactive users rejected. |
| **RBAC** | `VIEWER` / `ANALYST` / `ADMIN` — matrix in `src/common/permissions.ts` + guards. |
| **Input** | **`ValidationPipe`**: whitelist fields, reject unknown properties on DTOs, type checks. |
| **Money** | **Decimal** in PostgreSQL; API returns decimal strings to avoid float bugs. |
| **Abuse** | **Rate limit** (~200 req/min per IP) via `@nestjs/throttler`. |
| **Deletes** | Financial records use **soft delete** (`deleted_at`), not hard remove by default. |
| **`/docs` UI** | Only for **trying** the API; it is not the production customer dashboard. |

**`/docs`** uses **RapiDoc** (third-party component) only to render the spec; your **branding** is the custom header. Machine contract is still **OpenAPI** + standard **`Bearer`** JWT. Your **product** security is the API + DB above.

---

## Can I ship a frontend to the market with only this backend?

**This backend is a solid API layer**, but a real launch usually needs more:

1. **A separate frontend** (React, Next.js, etc.) that calls `https://your-api/...` with the same JWT flow (login → store token → attach `Authorization`).
2. **HTTPS everywhere** (host provides TLS; never ship production over plain HTTP).
3. **CORS:** demo uses `origin: true`. For production, set **only your frontend origin(s)** in code or env.
4. **Secrets:** strong `JWT_SECRET`, rotate if leaked; never commit `.env`.
5. **Admin & demo users:** change passwords; disable or remove seed demo accounts if real users exist.
6. **Legal / compliance:** privacy policy, data handling, backups — if you store real financial or personal data.
7. **Ops:** monitoring, database backups, uptime (health checks).

So: **yes, you can connect a market frontend to this API**, after the items above match your risk level.

---

## Change the admin account

- **Same user, new password:** log in as admin → `PATCH /users/{adminUserId}` with `{ "password": "YourNewStrongPassword" }` (see `/docs` for body).
- **New admin email:** `PATCH` with `{ "email": "you@yourdomain.com" }` (must stay unique).
- **New admin user:** `POST /users` with `role: ADMIN`, then optionally deactivate the old admin with `PATCH` `status: INACTIVE`.

---

## Deploy on Railway (public links)

1. Push this repo to **GitHub**.
2. [railway.app](https://railway.app) → sign in → **New project** → **Deploy from GitHub repo** → select the repo.
3. **Add PostgreSQL:** **+ New** → **Database** → **PostgreSQL**.
4. On your **web service** (Node app) → **Variables**:
   - **`DATABASE_URL`** — paste from Postgres **Connect**, or reference Railway’s variable from the Postgres service.
   - **`JWT_SECRET`** — long random string (generate locally; keep private).
5. **Settings** for the web service:
   - **Build command:** `npm install && npx prisma generate && npm run build`
   - **Start command:** `npx prisma migrate deploy && npm run start:prod`
6. **Networking** → **Generate domain** → you get `https://<name>.up.railway.app`.
7. **Public URLs to share:**
   - `https://<name>.up.railway.app/health`
   - `https://<name>.up.railway.app/docs`
8. **Seed once** (from your PC with the same `DATABASE_URL` in `.env`): `npm run db:seed`  
   Or Railway **one-off** shell if you use their CLI.

After deploy: **change admin password**, review **CORS** for your real frontend domain.

---

## Submission ideas (human, structured)

What evaluators usually appreciate:

1. **Repository link** + this **README**.
2. **Live links** in the email/form: `/health`, `/docs`, and one sentence: *“Log in as documented, then open Dashboard summary.”*
3. **Short cover note** with assumptions (single org, global aggregates, no separate frontend) and **what you would add next** (real UI, audit log, stricter CORS).
4. **Optional 2–5 min video** — walk through folder layout, login, one CRUD, viewer vs admin. **Not required** unless the brief asks.

---

## Project layout (where to look in the code)

```text
src/
  main.ts                 # App bootstrap, CORS, validation, /docs page copy
  app.module.ts           # Global guards (JWT, throttle), feature modules
  app.controller.ts       # GET /health
  auth/                   # Login, JWT strategy
  users/                  # User CRUD + /users/me
  records/                # Financial CRUD, filters, FTS on notes
  dashboard/              # Aggregations & trends
  prisma/                 # PrismaService
  common/                 # Permissions, guards, decorators, exception filter
prisma/
  schema.prisma           # Users, records, enums
  migrations/             # SQL history (including FTS index)
  seed.ts                 # Zorvyn users + demo ledger
test/                     # e2e (health)
```

---

## Assumptions & tradeoffs (plain English)

- **One organization** — dashboard totals are **global** (all non-deleted records), not per-tenant company keys.
- **Money** stored as **decimal** in the database; API returns **strings** with fixed decimals to avoid floating-point surprises.
- **CORS** is permissive (`origin: true`) for **demos**; production should whitelist your real frontend origin.
- **`/docs`** stays available in V0.9 so reviewers can **try the API** in the browser; for hardened production you might password-protect or disable it.

---

## Troubleshooting

- **Docker pipe / engine errors:** start **Docker Desktop** and wait until it is fully running; then `docker compose up -d`.
- **`npm install` EPERM (Windows):** delete `node_modules`, close locking apps, `npm cache clean --force`, retry.
- **Seed skipped:** data already exists — use `prisma migrate reset` (local only) or add rows with **POST /records** as admin.

---

## License

MIT
