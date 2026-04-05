# Financial Backend (Zorvyn)

REST API for a finance-style dashboard: **users with roles**, **ledger entries** (income/expense), **aggregated reporting**, and **JWT-based access control**. Release **V0.9**.

This repository contains the **server only**. A separate web or mobile client would consume these endpoints over HTTPS.

---

## Table of contents

1. [Capabilities](#capabilities)
2. [Technology stack](#technology-stack)
3. [How the system works](#how-the-system-works)
4. [Data model](#data-model)
5. [Authentication and roles](#authentication-and-roles)
6. [HTTP API overview](#http-api-overview)
7. [Getting started](#getting-started)
8. [Environment variables](#environment-variables)
9. [Using the API](#using-the-api)
10. [Seed data](#seed-data)
11. [Testing and build](#testing-and-build)
12. [Deployment](#deployment)
13. [Production notes](#production-notes)
14. [Project layout](#project-layout)
15. [Assumptions and limits](#assumptions-and-limits)
16. [Troubleshooting](#troubleshooting)
17. [Updating your Git branch](#updating-your-git-branch)
18. [License](#license)

---

## Capabilities

| Area | Behavior |
|------|----------|
| **Users** | Email, name, bcrypt-hashed password, role (`VIEWER` \| `ANALYST` \| `ADMIN`), status (`ACTIVE` \| `INACTIVE`). Inactive users cannot authenticate. |
| **Auth** | `POST /auth/login` returns a signed **JWT**; protected routes require `Authorization: Bearer <token>`. |
| **RBAC** | Permissions are centralized (`src/common/permissions.ts`) and enforced with Nest guards after JWT validation. |
| **Financial records** | Create, read, update, soft-delete; filter by date range, category, type; paginate; optional **full-text search** on `notes` (PostgreSQL GIN + `websearch_to_tsquery`). |
| **Dashboard** | `GET /dashboard/summary` — totals, per-category breakdown, recent activity, weekly/monthly trends (computed in SQL). |
| **Quality** | Global validation pipe (whitelist, reject unknown fields), consistent error payloads, rate limiting (~200 requests/minute per IP). |
| **Documentation** | `GET /docs` — branded HTML shell + **RapiDoc** for interactive calls. `GET /openapi.json` — OpenAPI 3 document for Postman, codegen, or other tools. |

---

## Technology stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js |
| Framework | **NestJS** 10 (TypeScript) |
| ORM | **Prisma** 6 |
| Database | **PostgreSQL** 16 (Docker image in `docker-compose.yml`) |
| Auth | **passport-jwt**, **@nestjs/jwt**, **bcrypt** |
| Validation | **class-validator**, **class-transformer** |
| API metadata | **@nestjs/swagger** (OpenAPI document only; UI is RapiDoc) |
| Abuse control | **@nestjs/throttler** |
| Tests | **Jest**, **Supertest** (e2e for `/health`) |

---

## How the system works

1. **Bootstrap** (`src/main.ts`): Creates the Nest application, registers a global exception filter, `ValidationPipe`, and permissive CORS (`origin: true` — tighten for production). Builds an OpenAPI document and exposes `/openapi.json` and `/docs`.
2. **Guards** (`src/app.module.ts`): Every route is protected by default via **`JwtAuthGuard`**, except those marked `@Public()` (e.g. `GET /`, `GET /health`, `POST /auth/login`). **`ThrottlerGuard`** applies the rate limit. On dashboard, records, and users controllers, **`PermissionsGuard`** runs with **`@RequirePermissions(...)`** so each handler declares the permissions it needs.
3. **Request path**: HTTP request → controller → service → **PrismaService** → PostgreSQL. Amounts use `Decimal` in the database; API exposes them as decimal strings where applicable to avoid floating-point errors.
4. **Interactive docs**: `/docs` loads **RapiDoc** from a CDN and points it at `/openapi.json`. The top bar is custom (Financial Backend / Zorvyn / V0.9).

```text
Client
  → NestJS (Throttler → JWT → Permissions)
    → Controller → Service → Prisma → PostgreSQL
```

---

## Data model

- **User** — `id`, `email` (unique), `passwordHash`, `name`, `role`, `status`, timestamps; one-to-many **financial records**.
- **FinancialRecord** — `amount` (`Decimal(19,4)`), `type` (`INCOME` \| `EXPENSE`), `category`, `occurredAt`, optional `notes`, `deletedAt` (soft delete), timestamps. Indexed on `(userId, occurredAt)`, `category`, `type`, `deletedAt`; GIN index on full-text vector of `notes`.

---

## Authentication and roles

### JWT and `Authorization` header

After a successful login, clients send:

```http
Authorization: Bearer <access_token>
```

`Bearer` is the standard HTTP authorization scheme for bearer tokens ([RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750)). The token string itself is the JWT returned as `access_token` in the login response. **Do not** invent a custom scheme name in place of `Bearer` unless every client and middleware is changed to match.

### Role matrix

| Permission / route pattern | VIEWER | ANALYST | ADMIN |
|----------------------------|--------|---------|-------|
| `GET /dashboard/summary` | Yes | Yes | Yes |
| `GET /records`, `GET /records/:id` | No | Yes | Yes |
| `POST` / `PATCH` / `DELETE` records | No | No | Yes |
| `GET /users`, `GET /users/:id` | No | No | Yes |
| `POST` / `PATCH` users | No | No | Yes |
| `GET /users/me` | Yes | Yes | Yes |

Analysts see all non-deleted records (read-only). Admins may optionally assign a record to another user on create/update.

---

## HTTP API overview

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | Public | Redirects to `/docs` |
| GET | `/health` | Public | Liveness JSON (`status`, `service`, `version`, `timestamp`) |
| GET | `/docs` | Public | Interactive API reference (RapiDoc) |
| GET | `/openapi.json` | Public | OpenAPI 3 JSON |
| POST | `/auth/login` | Public | Email + password → JWT + user profile |
| GET | `/users/me` | JWT | Current user profile |
| GET | `/users`, `GET /users/:id` | JWT + admin | List / get user |
| POST | `/users` | JWT + admin | Create user |
| PATCH | `/users/:id` | JWT + admin | Update user |
| GET | `/records` | JWT + analyst/admin | List with filters, pagination, `search` |
| GET | `/records/:id` | JWT + analyst/admin | Single record |
| POST | `/records` | JWT + admin | Create |
| PATCH | `/records/:id` | JWT + admin | Update |
| DELETE | `/records/:id` | JWT + admin | Soft delete |
| GET | `/dashboard/summary` | JWT | Aggregates and trends |

Full schemas, examples, and **Try** requests: open **`/docs`** after the server is running.

---

## Getting started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm**
- **Docker Desktop** (or another PostgreSQL 16 instance and a matching `DATABASE_URL`)

### Steps

1. **Clone** the repository and open the project root in your editor.

2. **Environment file**

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux: `cp .env.example .env`

3. **Start PostgreSQL** (from project root):

   ```bash
   docker compose up -d
   ```

4. **Install dependencies, migrate, generate client, seed**

   ```bash
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run db:seed
   ```

5. **Run the API**

   ```bash
   npm run start:dev
   ```

6. **Verify**

   - Browser or HTTP client: `http://localhost:3000/health`
   - Interactive reference: `http://localhost:3000/docs`

To reset the database and re-seed locally (destructive):

```bash
npx prisma migrate reset
npm run db:seed
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (see `.env.example`) |
| `JWT_SECRET` | Yes | Secret used to sign JWTs (use a long random value in production) |
| `JWT_EXPIRES_IN` | No | Token lifetime (default in code if unset; example: `8h`) |
| `PORT` | No | Listen port (default `3000`) |
| `PUBLIC_API_URL` | No | Public base URL **without** trailing slash, e.g. `https://your-app.up.railway.app`. Used as the OpenAPI server URL so **Try** in `/docs` targets the correct host when not on localhost. |

---

## Using the API

### From `/docs` (RapiDoc)

1. Open `/docs`.
2. Execute **`POST /auth/login`** with a JSON body: `email`, `password` (see [Seed data](#seed-data)).
3. Copy the **`access_token`** value from the response (the long string starting with `eyJ...`).
4. Open the **authentication** section in RapiDoc and paste **only** the token. RapiDoc sends `Authorization: Bearer <token>`. If you paste `Bearer eyJ...`, many clients will send a **double** `Bearer` prefix and return **401**.
5. Call protected endpoints (e.g. `GET /dashboard/summary`, `GET /records`).

On a deployed host, set **`PUBLIC_API_URL`** so Try requests use your public origin.

### From code or Postman

- `POST /auth/login` with JSON `{"email":"...","password":"..."}`.
- Store `access_token`.
- For subsequent requests, set header `Authorization: Bearer <access_token>`.

---

## Seed data

`npm run db:seed` creates three users and ten **FinancialRecord** rows (categories such as payroll, receivables, rent, utilities, subscriptions, contractor pay, bank fees; several notes reference **Zorvyn** for search demos). Source of truth: `prisma/seed.ts`.

| Email | Password | Role |
|-------|----------|------|
| `admin@zorvyn.com` | `Cracked@993` | ADMIN |
| `analyst@zorvyn.com` | `Insight@993` | ANALYST |
| `viewer@zorvyn.com` | `Observe@993` | VIEWER |

**Security:** These credentials are for local development and demonstration. Change them before any production use.

---

## Testing and build

```bash
npm test
npm run test:e2e
npm run build
```

- Unit tests cover services, permissions, guards, and utilities.
- E2E includes `/health` without requiring a database connection for basic smoke coverage.

---

## Deployment

Example: **Railway**

1. Push the repository to GitHub (or another Git host Railway supports).
2. Create a project and deploy the repository as a **Node** service.
3. Add a **PostgreSQL** plugin and connect `DATABASE_URL` to the web service.
4. Set `JWT_SECRET` (long random string) and optionally `PUBLIC_API_URL` to your public HTTPS origin (no trailing slash).
5. Typical commands:
   - **Build:** `npm install && npx prisma generate && npm run build`
   - **Start:** `npx prisma migrate deploy && npm run start:prod`
6. Run **`npm run db:seed`** once against the same database (from CI, a one-off job, or your machine with production `DATABASE_URL` in `.env`) if you need demo users.

After deployment: rotate demo passwords, restrict **CORS** to real front-end origins, and treat `/docs` exposure according to your security policy.

---

## Production notes

| Topic | Recommendation |
|-------|----------------|
| **HTTPS** | Terminate TLS at the host (Railway, reverse proxy, etc.). |
| **CORS** | Replace `origin: true` with an explicit allowlist of front-end origins. |
| **Secrets** | Never commit `.env`; rotate `JWT_SECRET` if compromised. |
| **Accounts** | Change or remove seed users; use `PATCH /users` / `POST /users` for real admins. |
| **Docs** | Optionally disable or protect `/docs` and `/openapi.json` if you do not want a public contract. |

---

## Project layout

```text
src/
  main.ts                 # Bootstrap, validation, CORS, OpenAPI, /docs HTML
  app.module.ts           # Modules, global guards
  app.controller.ts       # GET / redirect, GET /health
  auth/                   # Login, JWT strategy
  users/                  # User CRUD, /users/me
  records/                # Financial CRUD, filters, full-text search
  dashboard/              # Summary aggregates
  prisma/                 # PrismaService
  common/                 # Permissions, guards, decorators, exception filter
prisma/
  schema.prisma
  migrations/
  seed.ts
test/                     # E2E (e.g. health)
docker-compose.yml
.env.example
```

---

## Assumptions and limits

- **Single-organization model** — dashboard aggregates are global across non-deleted records, not multi-tenant keyed by company.
- **No built-in frontend** — consumers integrate via HTTP + JWT.
- **Soft delete** — deleted records remain in the database with `deletedAt` set; list queries exclude them by default.

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Login **401** with seeded emails | Database not migrated or not seeded | `npx prisma migrate deploy` then `npm run db:seed` |
| **401** on all protected routes after “login” in `/docs` | Pasted `Bearer eyJ...` into the token field | Paste **only** the JWT string |
| Cannot connect to DB | Postgres not running or wrong `DATABASE_URL` | Start Docker / check `.env` |
| `npm install` EPERM (Windows) | File locks | Close other processes, remove `node_modules`, retry |
| Try requests hit wrong host when deployed | Missing `PUBLIC_API_URL` | Set to your public API base URL |

---

## Updating your Git branch

If the project is already on GitHub and you want to publish these README (and any other) changes:

```bash
cd path/to/finance-dashboard-api
git status
git add README.md
# or: git add .
git commit -m "docs: rewrite README for submission"
git push origin main
```

Use your real branch name if it is not `main` (e.g. `git push origin your-branch`). If the remote branch tracks your local branch:

```bash
git push
```

If you have not set the remote yet:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## License

MIT
