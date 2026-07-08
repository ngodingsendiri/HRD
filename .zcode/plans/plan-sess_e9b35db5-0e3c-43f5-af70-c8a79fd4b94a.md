## Rombak Total Sistem Auth: @auth/core → Custom Session-Based

### Latar belakang & root cause
Sistem login saat ini pakai `@auth/core` yang dirancang untuk Web API (Request/Response), dipaksakan jalan di Vercel Node runtime (IncomingMessage/ServerResponse) via bridge rapuh. Ini menyebabkan siklus bug: POST `/api/auth/callback/credentials` return `NOT_FOUND sin1::...` (404 edge-level) padahal GET `/api/auth/csrf` jalan — karena Auth.js selalu return redirect 302 yang di-follow browser ke HTML, terlihat sebagai 404. Solusi: ganti ke custom session auth yang return JSON murni.

### Keputusan
- Session: **DB-backed** (tabel `sessions` yang sudah ada di schema), token = random 32-byte hex
- Expiry: **7 hari**, cookie persistent (`Max-Age`)
- File Auth.js lama: **dihapus total**
- Password verify: pakai `bcryptjs` (sudah ada, sama seperti `create-admin.ts`)
- Cookie signing: pakai `AUTH_SECRET` env var (HMAC via `jose` atau crypto bawaan)

### Perubahan file

**BACKEND (api/):**

1. **HAPUS** `api/auth/[...auth].ts` (catch-all Auth.js — sumber masalah)
2. **HAPUS** `api/_lib/auth-config.ts` (bridge Auth.js — dead code setelah rombak)
3. **BUAT** `api/_lib/session.ts` — library inti baru berisi:
   - `createSession(userId): Promise<sessionToken>` — generate token, hash dengan bcrypt-ish, simpan ke tabel `sessions` dengan expiry 7 hari, set cookie http-only
   - `getSession(req): Promise<SessionPayload|null>` — baca cookie `hrcube_session`, lookup di DB, cek expiry, return user payload
   - `destroySession(req, res): Promise<void>` — hapus row DB + clear cookie
   - `setSessionCookie(res, token)` / `clearSessionCookie(res)` — helper cookie (httpOnly, secure, sameSite=lax, maxAge 7 hari)
   - `requireAdmin(req, res): Promise<AdminUser>` — pindahkan dari `auth.ts`, pakai `getSession` baru. Signature tetap sama supaya caller (`employees.ts`, `settings.ts`) **tidak berubah**
4. **HAPUS & RECREATE** `api/_lib/auth.ts` — sederhana, jadi re-export `requireAdmin` + `AdminUser` interface dari `session.ts` (agar import path `./_lib/auth.js` di handler data tidak berubah)
5. **BUAT** `api/auth/login.ts` — handler:
   - POST `{ email, password }` → verify bcrypt, `createSession`, return `{ user }` JSON 200
   - Error: 401 `{ error: "Email atau password salah" }`, 400 jika field kosong
   - **Tidak ada CSRF dance, tidak ada redirect** — JSON murni
6. **BUAT** `api/auth/logout.ts` — handler:
   - POST → `destroySession`, return `{ ok: true }` JSON 200
7. **BUAT** `api/auth/me.ts` — handler:
   - GET → `getSession`, return `{ user }` atau `{ user: null }` JSON 200
8. **PERTAHANKAN**: `api/auth/register.ts` (sudah disabled, aman), `api/health.ts`, semua handler data (`employees*`, `settings`) — **tidak disentuh sama sekali**

**FRONTEND (src/):**

9. **UPDATE** `src/lib/auth.tsx` — ganti implementasi `AuthProvider`:
   - `fetchSession()`: `GET /api/auth/me` (bukan `/api/auth/session`)
   - `signOut()`: `POST /api/auth/logout` (bukan csrf+signout dance). Signature `signOut` tetap sama supaya `Layout.tsx` tidak berubah
10. **UPDATE** `src/App.tsx` `handleLogin()`:
    - Hapus fetch csrf terpisah
    - POST langsung ke `/api/auth/login` dengan JSON `{ email, password }`
    - Hapus `redirect: "manual"` + `opaqueredirect` logic (tidak relevan lagi)
    - On success: `setUser(data.user)` langsung (tidak perlu reload)
11. **UPDATE** `src/lib/api.ts` `getSession()`: endpoint `/api/auth/me`

**SCHEMA & ENV:**

12. Schema Prisma: **tidak berubah** (model `Session` sudah ada, field cocok: `sessionToken`, `userId`, `expires`)
13. Env var di Vercel: `AUTH_SECRET` wajib diset (32+ char random). Akan di-dokumentasikan di plan output.

### Alur baru (setelah rombak)
```
Login:   POST /api/auth/login {email,password}  → 200 {user} + Set-Cookie
         (bcrypt verify → insert sessions row → set httpOnly cookie)
Session: GET  /api/auth/me                      → 200 {user} or {user:null}
         (baca cookie → lookup sessions → cek expiry)
Logout:  POST /api/auth/logout                  → 200 {ok:true} + clear cookie
         (delete sessions row → clear cookie)
Protect: requireAdmin(req,res) di setiap handler data
         (getSession → cek ADMIN_EMAILS allowlist)
```

### Keamanan
- Cookie: `httpOnly`, `secure` (production), `sameSite=Lax`, `path=/`, `maxAge=7d`
- Session token: 32 byte crypto-random, disimpan **hashed** di DB (token DB ≠ cookie value, jadi leak DB tidak langsung kompromikan session)
- Password: bcrypt rounds 10 (sama dengan create-admin.ts)
- Brute-force: rate-limit sederhana optional (bisa ditambah nanti, tidak di scope awal)

### Testing & verifikasi
- `npx tsc --noEmit` lolos
- `npm run build` lolos
- Manual test alur di Vercel: login → akses /api/employees (200) → logout → akses /api/employees (401)

### Catatan
- Semua user yang sedang login akan logout paksa **sekali** saat deploy (cookie format berubah). Wajar saat rombak auth.
- Dependency: tidak tambah package baru. Hapus `@auth/core`, `@auth/prisma-adapter` dari package.json (dead code setelah ini). `bcryptjs` + `@prisma/client` tetap.

### File yang disentuh: 11 total
- Hapus: 2 (`[...auth].ts`, `auth-config.ts`)
- Buat: 4 (`session.ts`, `login.ts`, `logout.ts`, `me.ts`)
- Update: 5 (`auth.ts`, `auth.tsx`, `App.tsx`, `api.ts`, `package.json`)
- Tidak disentuh: semua handler data, schema, register.ts, health.ts, Layout.tsx, main.tsx