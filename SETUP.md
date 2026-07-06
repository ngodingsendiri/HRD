# Panduan Setup & Deployment HRCube

> Dokumen ini menjelaskan langkah-langkah yang diperlukan untuk menjalankan
> aplikasi HRCube secara lokal maupun di Vercel (produksi).

---

## 1. Prasyarat

- **Node.js** ≥ 18
- **Database** Neon Postgres (buat project di [neon.tech](https://neon.tech))
- **Vercel** account (untuk deployment)

---

## 2. Environment Variables

Salin `.env.example` menjadi `.env` (lokal) atau set di **Vercel Dashboard → Settings → Environment Variables** (produksi).

### Variabel Wajib

| Variabel | Contoh | Keterangan |
|----------|--------|------------|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require` | Neon pooled connection string |
| `DIRECT_URL` | `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require` | Neon direct connection (untuk migrasi) |
| `AUTH_SECRET` | `r4nd0m_b4se64_str1ng...` | Generate: `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` | Wajib `true` untuk Vercel |
| `ADMIN_EMAILS` | `ngerjaindiri@gmail.com` | Email admin yang boleh akses (comma-separated) |

### Cara Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

Salin output-nya ke `AUTH_SECRET`.

---

## 3. Setup Database

### 3a. Jalankan Migrasi

```bash
npm install
npx prisma migrate dev --name init
```

Atau jika database sudah ada tabel:

```bash
npx prisma db push
```

### 3b. Buat User Admin

Script `scripts/create-admin.ts` akan membuat atau mengupdate akun admin
di database.

**Secara lokal:**

```bash
npx tsx scripts/create-admin.ts
```

**Untuk database produksi (Neon via Vercel):**

1. Set semua env vars di Vercel dashboard terlebih dahulu
2. Jalankan script secara remote menggunakan `vercel env pull` lalu jalankan lokal:
   ```bash
   vercel env pull .env.production.local
   npx tsx scripts/create-admin.ts
   ```
3. Atau jalankan melalui Vercel CLI shell:
   ```bash
   vercel link
   vercel env pull .env.production.local
   DATABASE_URL=$(grep DATABASE_URL .env.production.local | cut -d= -f2-) \
   DIRECT_URL=$(grep DIRECT_URL .env.production.local | cut -d= -f2-) \
   npx tsx scripts/create-admin.ts
   ```

### 3c. Kredensial Admin Default

| Field | Value |
|-------|-------|
| Email | `ngerjaindiri@gmail.com` |
| Password | `sekretariat` |

> ⚠️ Pastikan email ini terdaftar di `ADMIN_EMAILS` di Vercel,
> jika tidak login berhasil tapi API akan menolak akses (401).

---

## 4. Jalankan Lokal

```bash
npm install
cp .env.example .env
# Edit .env — isi DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_EMAILS
npx prisma migrate dev
npx tsx scripts/create-admin.ts
npm run dev
```

Buka `http://localhost:5173` di browser.

---

## 5. Deploy ke Vercel

1. Push ke GitHub
2. Connect repo di [Vercel Dashboard](https://vercel.com/new)
3. Set **Environment Variables** (lihat tabel di atas)
4. Deploy

### Checklist Sebelum Deploy

- [ ] `DATABASE_URL` dan `DIRECT_URL` sudah terisi
- [ ] `AUTH_SECRET` sudah di-generate dan diisi
- [ ] `AUTH_TRUST_HOST` = `true`
- [ ] `ADMIN_EMAILS` berisi email admin (harus sama dengan yang di-create-admin)
- [ ] `scripts/create-admin.ts` sudah dijalankan terhadap DB produksi

---

## 6. Troubleshooting

### "Terjadi kesalahan sistem saat login"

| Penyebab | Solusi |
|----------|--------|
| `AUTH_SECRET` kosong | Generate dan isi di Vercel env vars |
| User belum ada di database | Jalankan `create-admin.ts` (lihat #3b) |
| Email tidak di `ADMIN_EMAILS` | Tambahkan email admin ke env var |
| DB connection gagal | Cek `DATABASE_URL` dan `DIRECT_URL` |

### 401 Unauthorized setelah login

Email yang digunakan login **belum terdaftar** di `ADMIN_EMAILS`. Semua API
protected (`/api/employees`, `/api/settings`) menggunakan allowlist ini.

### Database connection error

Pastikan `sslmode=require` ada di connection string Neon. Jika error
`channel_binding`, tambahkan `&channel_binding=require`.
