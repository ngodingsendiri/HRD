# Audit HRD ASN — Laporan & Status Perbaikan

> **Tanggal audit ulang:** 10 Juli 2026  
> **Branch:** `main`  
> **Scope:** keamanan, API, data model, frontend, ops  
> **Status verifikasi:** `npm run lint` + `npm test` (jalankan setelah merge)

---

## Ringkasan eksekutif

HRD ASN adalah SPA internal (Vite/React) + API serverless Vercel + Neon/Prisma.
Arsitektur dasar sudah tepat (client tidak menyentuh Prisma; auth session custom
cocok untuk Vercel Node). Audit awal menemukan celah kritis (kredensial di git,
fallback `AUTH_SECRET`, tanpa rate limit, validasi longgar, tanpa migrasi).

**Batch perbaikan 10 Juli 2026** mengimplementasikan rekomendasi di bawah.
Dokumen audit sebelumnya (7 Juli) **usang** — masih mereferensi NextAuth yang
sudah diganti custom session di `api/_lib/session.ts`.

---

## Status temuan

| Prioritas | Temuan | Status | Perbaikan |
|-----------|--------|--------|-----------|
| 🔴 Critical | Password admin hardcoded di repo | ✅ Fixed | `scripts/create-admin.ts` hanya dari env; password dihapus dari docs |
| 🔴 Critical | Fallback `AUTH_SECRET` di production | ✅ Fixed | `getAuthSecret()` throw di production; dev-only fallback |
| 🟠 High | Tidak ada rate limit login | ✅ Fixed | In-memory limit 10 / 15 mnt per IP & email (`api/_lib/http.ts`) |
| 🟠 High | Login tanpa cek admin allowlist | ✅ Fixed | Login + `/me` enforce `ADMIN_EMAILS` |
| 🟠 High | Tidak ada Prisma migrations | ✅ Fixed | `prisma/migrations/...` + partial unique NIP/NIK |
| 🟠 High | Bulk/list tanpa batas | ✅ Fixed | Cap 500 bulk, 2000 list, optional `?q=&limit=&offset=` |
| 🟡 Medium | NIP/NIK tidak unique | ✅ Fixed | Partial unique SQL + `findEmployeeIdByNipOrNik` (409) |
| 🟡 Medium | Zod terlalu longgar | ✅ Fixed | `nama` wajib; NIK 16 digit / kosong; NIP 8–25 digit / kosong |
| 🟡 Medium | Error 500 bocor detail | ✅ Fixed | `withErrorBoundary` + pesan generik |
| 🟡 Medium | API tanpa try/catch DB | ✅ Fixed | Semua handler data di-wrap |
| 🟡 Medium | Security headers | ✅ Fixed | HSTS, X-Frame-Options, nosniff, Referrer-Policy di `vercel.json` |
| 🟡 Medium | Logo base64 unbounded di API | ✅ Fixed | Max length di Zod + settings handler |
| 🟢 Low | Nav Chat WIP | ✅ Fixed | Route & nav disembunyikan |
| 🟢 Low | README kosong | ✅ Fixed | README + SETUP diperbarui |
| 🟢 Low | Tidak ada unit test | ✅ Partial | Vitest: schemas, rateLimit, authEnv |
| ⚪ Later | Pecah monolit Print/Employees | ⏳ Deferred | File ~1500+ baris; refactor terpisah |
| ⚪ Later | Role model di DB | ⏳ Deferred | Masih env allowlist (cukup single-tenant) |
| ⚪ Later | Pagination UI penuh | ⏳ Partial | API siap; UI masih load batch (max 2000) |
| ⚪ Later | Rate limit terdistribusi (Redis/KV) | ⏳ Deferred | In-memory per instance serverless |

---

## Perubahan file (batch 10 Juli 2026)

### Baru

- `api/_lib/http.ts` — rate limit, error boundary, limits
- `api/_lib/authEnv.ts` — pure env helpers (testable)
- `api/_lib/*.test.ts`, `src/lib/schemas.test.ts`
- `prisma/migrations/20260710000000_init_and_partial_unique/`
- `vitest.config.ts`

### Diubah (keamanan / API)

- `api/_lib/session.ts` — secret fail-hard, re-export authEnv
- `api/auth/login.ts` — rate limit + admin gate + generic errors
- `api/auth/logout.ts`, `api/auth/me.ts` — error boundary; me filter admin
- `api/employees.ts`, `api/employees/[id].ts` — limits, duplikat 409, search/pagination
- `api/settings.ts` — logo size guard
- `src/lib/schemas.ts` — validasi lebih ketat
- `src/lib/queries.ts` — search, findByNip/Nik, getEmployees options
- `scripts/create-admin.ts` — credentials dari env saja
- `vercel.json` — security headers
- `src/App.tsx`, `src/components/Layout.tsx` — hide Chat
- `package.json` — `test`, `db:deploy`, `create-admin`
- `.env.example`, `SETUP.md`, `README.md`, `AUDIT.md`

---

## Arsitektur auth (saat ini)

```
POST /api/auth/login
  → rate limit
  → bcrypt verify
  → isAdminEmail(ADMIN_EMAILS)?
  → createSession (cookie HttpOnly + hash di DB)

GET /api/auth/me
  → session valid + admin allowlist → user | null

/api/employees|settings
  → requireAdmin (session + allowlist)
```

Cookie: `hrdasn_session` = `selector.hmac(verifier).verifier`  
DB menyimpan hash verifier, bukan token mentah.

---

## Checklist post-deploy (wajib)

1. **Rotate password** jika kredensial lama pernah ada di git history  
2. Set `AUTH_SECRET` baru (random ≥ 32 bytes) di Vercel  
3. Set `ADMIN_EMAILS`  
4. `npx prisma migrate deploy` di production  
5. Buat ulang admin: `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin`  
6. Verifikasi login + CRUD pegawai  
7. Opsional: rewrite git history / rotate jika secret pernah ter-push

---

## Skor (setelah perbaikan)

| Area | Sebelum | Sesudah (estimasi) |
|------|---------|---------------------|
| Keamanan | 4/10 | **7.5/10** |
| Arsitektur | 7/10 | **7.5/10** |
| Validasi data | 5/10 | **7/10** |
| Maintainability | 4/10 | **5.5/10** |
| Ops / Deploy | 5/10 | **7/10** |
| Testing | 1/10 | **4/10** |

Sisa risiko utama: rate limit in-memory (bukan global), monolit UI, data sensitif
di internet tanpa VPN — pertimbangkan IP allowlist / SSO institusi untuk
hardening lanjutan.

---

## Catatan histori (7 Juli 2026) — arsip

Audit 7 Juli fokusbaiki NextAuth bridge yang crash di Vercel dan menambahkan
badge KP/KGB. Auth tersebut **sudah diganti** custom session (commit
`Replace Auth.js with custom DB-backed sessions`). Jangan ikuti langkah
`AUTH_TRUST_HOST` / NextAuth dari dokumen lama.

**Peringatan:** versi AUDIT/SETUP lama sempat memuat password contoh di plaintext.
Anggap terkompromi → ganti password & `AUTH_SECRET`.

---

---

## Batch lanjutan (backend + clean)

| Item | Status |
|------|--------|
| List employees envelope + lean + kamus dari settings | ✅ |
| Bulk import chunk + `errorDetails` | ✅ |
| Settings `?include=` | ✅ |
| Audit log | ✅ |
| Health + DB ping | ✅ |
| `GET /api/stats` dasbor | ✅ |
| Role ADMIN/VIEWER + requireStaff/requireAdmin | ✅ |
| Logout all devices | ✅ |
| Hapus Chat.tsx, plan.md, fetch-fonts.md | ✅ |
| AGENTS.md + SETUP.md + README | ✅ |

Deploy: `npx prisma migrate deploy` (role + audit_logs).

*Diperbarui seiring batch backend & clean code.*
