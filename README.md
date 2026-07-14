# HRD ASN

Aplikasi manajemen kepegawaian internal **satu dinas**: direktori pegawai, **Dashboard** (KP/KGB/pensiun & kesehatan data), cetak, impor/ekspor Excel, pengaturan kop & kamus jabatan, API baca untuk app lain.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 6, Tailwind 4, Motion, Recharts, PWA |
| API | Vercel Serverless (`/api/*`) |
| DB | Neon Postgres + Prisma 6 |
| Auth | Session cookie custom + role `ADMIN` / `VIEWER` |

## Fitur utama

- Autentikasi admin/viewer (session HttpOnly, rate limit login)
- CRUD pegawai + impor Excel (mesin normalize + match NIP/NIK)
- **Dashboard** agregat lewat `GET /api/stats` (peringatan KP/KGB/pensiun di sini, bukan di menu Pegawai)
- Login non-blocking: shell langsung, warm stats/settings di background
- Cetak dokumen, kamus jabatan, peta jabatan / bezetting
- **External API** — generate API key di Pengaturan → ambil data lewat `/api/v1/*`
- Audit log write path
- Health check dengan probe database

## Quick start

```bash
npm install
cp .env.example .env
# Isi DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAILS
npx prisma migrate dev
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin
npm run dev
```

Panduan lengkap: **[SETUP.md](./SETUP.md)**  
Prinsip tertinggi: **[constitution.md](./constitution.md)**  
Spesifikasi produk: **[specify.md](./specify.md)**  
Konvensi agent/kontributor: **[AGENTS.md](./AGENTS.md)**

## Keamanan

Jangan commit `.env` atau password. Rotate kredensial jika pernah bocor di history git. Production **wajib** set `AUTH_SECRET`.

## Scripts

| Script | Fungsi |
|--------|--------|
| `npm run dev` | Development |
| `npm run build` | Build production |
| `npm run lint` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run create-admin` | Buat/update user |
| `npm run db:deploy` | Apply migrations |
