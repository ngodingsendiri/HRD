# Setup & Deployment — HRCube

## Prasyarat

- Node.js ≥ 18  
- Neon Postgres  
- Akun Vercel (production)

---

## 1. Environment variables

Salin `.env.example` → `.env` (lokal) atau set di Vercel.

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `DATABASE_URL` | ✅ | Neon **pooled** (+ `sslmode=require`) |
| `DIRECT_URL` | ✅ | Neon **direct** (migrasi) |
| `AUTH_SECRET` | ✅ prod | `openssl rand -base64 32` (min 16 char). **Gagal hard** jika kosong di production |
| `ADMIN_EMAILS` | disarankan | Email yang selalu dapat **write** (comma-separated) |
| `ADMIN_EMAIL` | script | Hanya untuk `create-admin` |
| `ADMIN_PASSWORD` | script | Min 8 karakter |
| `ADMIN_NAME` | opsional | Nama tampilan |
| `ADMIN_ROLE` | opsional | `ADMIN` (default) atau `VIEWER` |
| `REVOKE_SESSIONS` | opsional | `1` = hapus semua session setelah ganti password |

---

## 2. Database

```bash
npm install
npx prisma migrate deploy   # production / CI
# development:
npm run db:migrate
```

Migrasi termasuk:

- schema employees + auth tables  
- partial unique NIP/NIK non-empty  
- `audit_logs`  
- `users.role`  
- `api_keys` (external API)

Seed settings (opsional):

```bash
npm run db:seed
```

---

## 3. Buat user

```bash
# PowerShell
$env:ADMIN_EMAIL="anda@instansi.go.id"
$env:ADMIN_PASSWORD="password-kuat-min-8"
$env:ADMIN_NAME="Admin Sekretariat"
$env:ADMIN_ROLE="ADMIN"          # atau VIEWER
$env:REVOKE_SESSIONS="1"         # opsional setelah rotate password
npm run create-admin
```

```bash
# bash
ADMIN_EMAIL=anda@instansi.go.id \
ADMIN_PASSWORD='password-kuat-min-8' \
ADMIN_ROLE=ADMIN \
npm run create-admin
```

Tambahkan email yang sama ke `ADMIN_EMAILS` jika ingin bootstrap write lewat env (selain role DB).

**VIEWER:** role `VIEWER` → bisa login & baca; mutasi API → 403.

---

## 4. Lokal

```bash
npm install
cp .env.example .env   # isi env
npx prisma migrate dev
npm run create-admin
```

**Penting:** `npm run dev` (Vite) hanya menyajikan frontend. Endpoint `/api/*` **tidak** ikut jalan kecuali Anda pakai Vercel CLI:

```bash
# Opsi A — full stack lokal (disarankan)
npx vercel dev

# Opsi B — UI saja (API akan 404)
npm run dev            # http://localhost:5173
```

---

## 5. Deploy Vercel

1. Push repo, connect Vercel  
2. Set env (production)  
3. Build: `npm run build` (sudah di `package.json` / `vercel.json`)  
4. Setelah deploy: `npx prisma migrate deploy` terhadap DB production  

### Serverless function budget (Hobby)

Vercel **Hobby** = max **12** Serverless Functions per deployment.

Proyek ini sengaja memakai **1 function** saja:

| Path | Peran |
|------|--------|
| `api/[[...path]].ts` | Catch-all router untuk seluruh `/api/*` |
| `api/_handlers/**` | Implementasi handler (folder `_` = **bukan** function terpisah) |
| `api/_lib/**` | Shared helpers (bukan function) |

URL publik **tidak berubah** (`/api/employees`, `/api/v1/stats`, …).  
Jangan menambah file `api/*.ts` di root API — daftarkan route di catch-all + handler di `_handlers`.

### Checklist

- [ ] `DATABASE_URL` + `DIRECT_URL`  
- [ ] `AUTH_SECRET` random  
- [ ] `ADMIN_EMAILS`  
- [ ] Migrasi applied  
- [ ] Admin dibuat / password di-rotate  
- [ ] `GET /api/health` → `"db":"up"`  

---

## 6. API penting

### Session (aplikasi web)

| Endpoint | Auth |
|----------|------|
| `GET /api/health` | publik — cek DB |
| `POST /api/auth/login` | publik — rate limit |
| `GET /api/auth/me` | cookie |
| `POST /api/auth/logout` `{ "allDevices": true }` | cookie — revoke semua session |
| `GET /api/employees?limit=&offset=&q=&lean=1` | staff |
| `GET /api/stats` | staff — dasbor |
| `GET /api/settings?include=core,kamus` | staff |
| Mutasi employees/settings | **admin only** |

### External API (aplikasi lain)

1. Login sebagai **admin** → **Pengaturan → API & Integrasi** → **Buat API key**.  
2. Salin secret `hrc_…` (hanya sekali).  
3. Panggil endpoint dengan header:

```bash
# List pegawai
curl -H "Authorization: Bearer hrc_YOUR_KEY" \
  "https://YOUR_DOMAIN/api/v1/employees?limit=50&lean=1&q=budi"

# Satu pegawai
curl -H "X-API-Key: hrc_YOUR_KEY" \
  "https://YOUR_DOMAIN/api/v1/employees/EMPLOYEE_ID"

# Ringkasan dasbor (total, bidang, KP/KGB/pensiun)
curl -H "Authorization: Bearer hrc_YOUR_KEY" \
  "https://YOUR_DOMAIN/api/v1/stats"
```

| Endpoint | Scope | Catatan |
|----------|-------|---------|
| `GET /api/v1/employees` | `employees:read` | Query: `q`, `status`, `alert`, `limit`, `offset`, `lean` |
| `GET /api/v1/employees/:id` | `employees:read` | Detail penuh |
| `GET /api/v1/stats` | `stats:read` | Agregat dasbor |
| `GET /api/v1/settings?include=core` | `settings:read` | Default `core` saja; tambah `logo,kamus,peta` bila perlu |
| `GET /api/v1/openapi` | — | OpenAPI 3 (publik) |
| `GET/POST /api/v1/keys` | session admin | Kelola key di UI (maks 25 aktif) |
| `DELETE /api/v1/keys/:id` | session admin | Cabut key |

- Secret **tidak** disimpan plain-text (hanya hash SHA-256).  
- Cabut key di UI jika bocor.  
- CORS: diizinkan untuk GET data v1 (header `Authorization` / `X-API-Key`).  
- **Origin binding (opsional):** isi origin browser di form key; kosong = bebas (server-to-server OK).  
- Scope wildcard `*` **tidak** diizinkan (least privilege).  
- Login + create key: rate limit **terdistribusi di Neon** (bukan hanya memory isolate).

Import Excel: unduh **Template** di Direktori Pegawai → isi sheet `Data_Import` + baca `Petunjuk` → Impor.

---

## 7. Troubleshooting

| Gejala | Cek |
|--------|-----|
| Login 500 | `AUTH_SECRET`, koneksi DB |
| Login 403 | role / allowlist |
| 403 saat simpan (VIEWER) | normal — butuh ADMIN |
| Import banyak error | buka detail baris di alert; NIP/NIK valid; Nama wajib |
| Settings lambat | pakai `include=` tanpa logo di halaman lain (sudah) |
| Health 503 | Neon down / `DATABASE_URL` salah |
| Audit tidak terisi | jalankan migrasi `audit_logs` |
| External API 401 | key salah / dicabut / kadaluarsa; cek prefix `hrc_` |
| External API 403 | scope key tidak mencakup endpoint (mis. butuh `stats:read`) |
| Tabel `api_keys` hilang | `npx prisma migrate deploy` |

---

## 8. Perintah harian

| Command | Fungsi |
|---------|--------|
| `npm run dev` | Frontend dev |
| `npm run build` | Production build |
| `npm run lint` | Typecheck |
| `npm test` | Unit tests |
| `npm run db:deploy` | Migrasi production |
| `npm run create-admin` | User admin/viewer |

Konvensi kode & desain: **[AGENTS.md](./AGENTS.md)**.  
Ringkasan produk: **[README.md](./README.md)**.
