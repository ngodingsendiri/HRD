# HRD ASN — Agent & Contributor Guide

Internal kepegawaian (satu dinas): **React (Vite PWA) + Vercel Serverless API + Prisma/Neon**.

---

## 1. Architecture (do not break)

```
Browser (src/)  →  fetch /api/*  →  Vercel catch-all (1 function)  →  handlers  →  Prisma  →  Neon
```

| Layer | Path | Rules |
|-------|------|--------|
| UI | `src/` | Never import Prisma / `queries.ts` / `db.ts` |
| API client | `src/lib/api.ts` | Only gateway from React to backend |
| Domain pure | `src/lib/employeeImport.ts`, `dashboardStats.ts`, `employeeUtils.ts`, `schemas.ts` | Shared, unit-tested; no HTTP |
| Data access | `src/lib/queries.ts` | Only place that calls Prisma (except audit/db helpers) |
| HTTP entry | `api/index.ts` | **Single** Serverless Function (Hobby ≤12 limit); **static** imports |
| Handlers | `src/server/handlers/**` | Route implementations (not Vercel functions) |
| Shared API libs | `api/_lib/**` | session, http, apiKey, rateLimitDb |
| Auth | `api/_lib/session.ts`, `authEnv.ts` | Cookie session + RBAC |

**Do not** add new top-level `api/foo.ts` endpoints — register in `api/index.ts` + handler under `src/server/handlers/`.  
Vite+Vercel: `/api/(.*)` → `/api?path=$1` (`vercel.json`).

---

## 2. Auth & roles

| Role | Read APIs | Write APIs |
|------|-----------|------------|
| `ADMIN` | ✅ | ✅ |
| `VIEWER` | ✅ | ❌ 403 |
| `ADMIN_EMAILS` env | always treated as **ADMIN** (bootstrap) |

- Cookie: HttpOnly `hrdasn_session`, SameSite=Lax, Secure in production.
- Guards: `requireStaff` (read), `requireAdmin` (write).
- Logout: `POST /api/auth/logout` body `{ allDevices?: true }` revokes all sessions.
- `AUTH_SECRET` **required** in production (fail hard).

---

## 3. API surface (current)

### Session (cookie)

| Method | Path | Access | Notes |
|--------|------|--------|--------|
| POST | `/api/auth/login` | public | rate limited |
| POST | `/api/auth/logout` | public | optional allDevices |
| GET | `/api/auth/me` | public | returns user or null |
| GET | `/api/employees` | staff | `{ data, total, limit, offset }` |
| POST/PUT/DELETE | `/api/employees` | admin | create / bulk-upsert / bulk-delete |
| GET/PUT/DELETE | `/api/employees/:id` | staff / admin | |
| GET/PUT | `/api/settings?include=` | staff / admin | `core,logo,kamus,peta,all` |
| GET | `/api/stats` | staff | dashboard aggregates |
| GET | `/api/health` | public | DB ping |

### External API (API key — for other apps)

| Method | Path | Auth | Scope |
|--------|------|------|--------|
| GET | `/api/v1/employees` | Bearer / `X-API-Key` | `employees:read` |
| GET | `/api/v1/employees/:id` | Bearer / `X-API-Key` | `employees:read` |
| GET | `/api/v1/stats` | Bearer / `X-API-Key` | `stats:read` |
| GET | `/api/v1/settings` | Bearer / `X-API-Key` | `settings:read` (default `include=core`) |
| GET | `/api/v1/openapi` | public | discovery doc |
| GET/POST | `/api/v1/keys` | **session admin** | manage keys (not via API key) |
| DELETE | `/api/v1/keys/:id` | **session admin** | revoke |

- Keys: prefix `hrc_…`, only **SHA-256 hash** stored (`api_keys` table).
- No wildcard scopes; max **25** active keys; create rate-limited.
- UI: **Pengaturan → API & Integrasi** (generate once, copy, revoke).
- Auth helpers: `api/_lib/apiKey.ts`; CRUD: `src/lib/apiKeys.ts`.
- CORS enabled on v1 data endpoints for browser clients.
- Rate limit: IP + per-key (e.g. employees ~120/min IP, ~300/min key).
- `lastUsedAt` throttled (5 min) and awaited (serverless-safe).

Import machine: client maps Excel → `normalizeEmployeeForImport` (also on server bulk).  
Template source of truth: `src/lib/employeeImport.ts` (`IMPORT_COLUMNS`).

---

## 4. UI design system (strict)

Use tokens from **`src/lib/ui.ts`** (`pageShell`, `card`, `btnPrimary`, `input`, motion variants).

### Aesthetic
- **Flat:** no gradients, no heavy shadows (`shadow-md+`).
- **Structure:** borders `border-slate-200` / `border-slate-100`.
- **Background:** `bg-slate-50` + 24px grid on `body` (`src/index.css`).
- **Cards:** `bg-white` + `rounded-xl`.
- **Controls:** `rounded-lg`, focus `ring-1 ring-slate-900`.
- **No indigo/random brand colors** for actions — slate + semantic status only.

### Motion
- Library: `motion/react`.
- Duration **0.2s**, ease **easeOut**, slide **y ≤ 10**, stagger **0.05**.
- No bounce / spring drama.

### Feedback (single language)
- Success / error → `notify` from `src/lib/notify.ts` (Sonner toast).
- Destructive confirm → `<ConfirmDialog />` (never `window.confirm` / `alert`).
- Import results → `<ImportResultDialog />`.
- Loading lists → `<TableSkeleton />` / `<PageSkeleton />`.
- Empty → `<EmptyState />` + clear CTA when possible.

### Page chrome
- Titles via `<PageHeader />`.
- One primary action per screen; secondary actions in “Lainnya”.
- Mobile: **bottom nav only** (no hamburger sidebar). Desktop: sidebar.

### Copy
- Short operator language (“Pegawai”, “Simpan”, “Ringkasan”), not pejabat jargon.

---

## 5. Data rules

- **Stored vs derived:** never persist `masaKerja`, `kelasJabatan`, `bebanKerja`, `pensiun`, prediksi KP/KGB — compute on read.
- **Kamus:** server loads from settings when listing employees.
- **NIP 18 (PNS/CPNS):** can fill tgl lahir / TMT / JK if empty (import + form).
- **Audit:** writes go to `audit_logs` (best-effort; never fail the request).
- **Bulk import:** max 500 rows; chunked transactions; `errorDetails[]` in response.

---

## 6. Scripts

```bash
npm run dev          # Vite
npm run build        # prisma generate + vite build
npm run lint         # tsc --noEmit
npm test             # vitest
npm run db:deploy    # prisma migrate deploy
npm run create-admin # ADMIN_EMAIL + ADMIN_PASSWORD (+ ADMIN_ROLE)
```

---

## 7. Performance rules

- **Lazy-load every page route** (`React.lazy` in `App.tsx`).
- **Never** static-import `xlsx` / heavy sheets in page modules — `await import("xlsx")` on action.
- List API default **50** rows; max **500**. Use `q`, `status`, `alert`, `offset`.
- Read path: fast mapper (`mapRow`), **no Zod per row**. Zod = writes only.
- Kamus CSV cached 60s in-process (`getKamusCsv`); invalidate on settings save.
- Stats: SQL `groupBy` for counts; slim select for timelines.
- No full-list polling every 60s — manual refresh or refetch on mutation.
- Vite `manualChunks`: `xlsx`, `charts`, `motion`, `react-vendor`.
- Log slow handlers via `x-response-time` header (`withErrorBoundary`).

## 8. What not to do

- Do not reintroduce NextAuth / Auth.js bridges on Vercel Node.
- Do not put passwords or real secrets in docs or seed scripts.
- Do not import `xlsx` at module top of pages — keep dynamic/lazy.
- Do not add `Chat` nav until the feature is real.
- Do not `getEmployees({ limit: 2000 })` for UI tables — paginate.

---

## 8. Docs map

| File | Purpose |
|------|---------|
| `constitution.md` | **Highest rules** — product/tech principles, what AI/humans must not break |
| `specify.md` | Product vision, scope, domain, roadmap |
| `README.md` | Product overview + quick start |
| `SETUP.md` | Env, migrate, admin, deploy |
| `AGENTS.md` | This file — architecture & coding conventions |
| `AUDIT.md` | Historical security/UI audit notes |

**Hierarchy:** `constitution.md` → `specify.md` → `AGENTS.md` → `SETUP.md` → code.
