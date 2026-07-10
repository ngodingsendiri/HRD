# Panduan Setup & Deployment HRCube

> Dokumen ini menjelaskan langkah-langkah untuk menjalankan HRCube secara lokal
> maupun di Vercel (produksi).

---

## 1. Prasyarat

- **Node.js** ≥ 18
- **Database** Neon Postgres ([neon.tech](https://neon.tech))
- **Vercel** account (untuk deployment)

---

## 2. Environment Variables

Salin `.env.example` menjadi `.env` (lokal) atau set di **Vercel Dashboard → Settings → Environment Variables**.

### Variabel wajib

| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| `DATABASE_URL` | Neon pooled URL + `sslmode=require` | Koneksi runtime (pooler) |
| `DIRECT_URL` | Neon direct URL | Migrasi Prisma |
| `AUTH_SECRET` | output `openssl rand -base64 32` | **Wajib di production** (min 16 char). App **gagal hard** jika kosong. |
| `ADMIN_EMAILS` | `admin@example.com` | Allowlist email admin (comma-separated) |

### Variabel untuk script admin (hanya lokal / CI — jangan commit)

| Variabel | Keterangan |
|----------|------------|
| `ADMIN_EMAIL` | Email user yang dibuat/di-update |
| `ADMIN_PASSWORD` | Password min 8 karakter |
| `ADMIN_NAME` | Nama tampilan (opsional) |

### Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

---

## 3. Setup Database

```bash
npm install
npx prisma migrate deploy
# atau development: npm run db:migrate
```

Jika database sudah ada dari `db push` lama, jalankan migrasi partial unique index:

```bash
npx prisma migrate deploy
```

Jika index gagal karena **duplikat NIP/NIK**, bersihkan duplikat dulu di Neon SQL Editor, lalu ulang.

---

## 4. Buat User Admin

**Jangan hardcode password di repo.** Gunakan env:

```bash
# Windows PowerShell
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="ganti-dengan-password-kuat"
$env:ADMIN_NAME="Admin Sekretariat"
npm run create-admin
```

```bash
# bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='ganti-dengan-password-kuat' \
ADMIN_NAME='Admin Sekretariat' \
npm run create-admin
```

Pastikan email yang sama ada di `ADMIN_EMAILS`, jika tidak login akan ditolak (403).

### Production (Neon via Vercel)

```bash
vercel env pull .env.production.local
# set ADMIN_EMAIL / ADMIN_PASSWORD, lalu:
# pastikan DATABASE_URL mengarah ke production
npm run create-admin
```

---

## 5. Jalankan Lokal

```bash
npm install
cp .env.example .env
# Edit .env — DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAILS
npx prisma migrate dev
npm run create-admin   # setelah set ADMIN_EMAIL + ADMIN_PASSWORD
npm run dev
```

Buka `http://localhost:5173`.

---

## 6. Deploy ke Vercel

1. Push ke GitHub  
2. Connect repo di [Vercel](https://vercel.com/new)  
3. Set environment variables  
4. Deploy  

### Checklist

- [ ] `DATABASE_URL` + `DIRECT_URL`
- [ ] `AUTH_SECRET` (panjang ≥ 16, random)
- [ ] `ADMIN_EMAILS` berisi email admin
- [ ] `create-admin` sudah dijalankan di DB produksi
- [ ] Password default / lama sudah diganti jika pernah bocor di git

---

## 7. Keamanan (ringkas)

- Login dibatasi rate limit (~10 percobaan / 15 menit per IP & email)
- Hanya email di `ADMIN_EMAILS` yang boleh session
- Cookie session: HttpOnly, SameSite=Lax, Secure di production
- Header keamanan di `vercel.json` (HSTS, X-Frame-Options, nosniff, …)
- Bulk import/delete dibatasi 500 baris per request

Detail temuan & status perbaikan: lihat [`AUDIT.md`](./AUDIT.md).

---

## 8. Troubleshooting

### Login gagal / 500

| Penyebab | Solusi |
|----------|--------|
| `AUTH_SECRET` kosong di production | Generate & set di Vercel |
| User belum ada | `npm run create-admin` |
| Email tidak di `ADMIN_EMAILS` | Tambahkan email → 403 “tidak memiliki akses admin” |
| Rate limit | Tunggu ~15 menit |

### 401 setelah login

Email tidak di allowlist `ADMIN_EMAILS`.

### DB connection

Pastikan `sslmode=require`. Untuk pooler Neon, app menambahkan `pgbouncer=true` otomatis jika perlu.

---

## 9. Scripts berguna

| Command | Fungsi |
|---------|--------|
| `npm run dev` | Vite dev server |
| `npm run build` | Prisma generate + Vite build |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Unit tests (Vitest) |
| `npm run db:migrate` | Migrasi dev |
| `npm run db:deploy` | Migrasi production |
| `npm run create-admin` | Buat/update admin dari env |
