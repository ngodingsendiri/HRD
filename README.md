# HRCube

Aplikasi manajemen data pegawai (HR) — React + Vite (PWA), API serverless Vercel, Prisma, Neon Postgres.

## Fitur

- Autentikasi admin (session cookie HttpOnly + allowlist email)
- Direktori pegawai (CRUD, impor/ekspor Excel, badge KP/KGB)
- Dasbor ringkasan (status kepegawaian, peringatan berkala/kenaikan pangkat/pensiun)
- Pencetakan dokumen
- Pengaturan kop surat, kamus jabatan, peta jabatan

## Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind 4, Motion, Recharts |
| API | Vercel Node serverless (`/api/*`) |
| DB | Neon Postgres + Prisma 6 |
| Auth | Custom session (bukan Auth.js/NextAuth) |

## Mulai cepat

```bash
npm install
cp .env.example .env
# Isi DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAILS
npx prisma migrate dev
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run create-admin
npm run dev
```

Panduan lengkap: **[SETUP.md](./SETUP.md)**  
Riwayat audit & perbaikan: **[AUDIT.md](./AUDIT.md)**  
Pedoman UI: **[AGENTS.md](./AGENTS.md)**

## Scripts

| Script | Keterangan |
|--------|------------|
| `npm run dev` | Development |
| `npm run build` | Production build |
| `npm run lint` | TypeScript check |
| `npm test` | Unit tests |
| `npm run create-admin` | Buat admin (butuh `ADMIN_EMAIL` + `ADMIN_PASSWORD`) |

## Keamanan

Jangan commit file `.env` atau password. Lihat `SETUP.md` dan `AUDIT.md`.
