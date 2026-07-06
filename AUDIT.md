# Rekap Audit & Perbaikan HRCube

> Tanggal: 7 Juli 2026
> Branch: `main`
> Status: `npm run lint` ✅ **0 error**

---

## Ringkasan Eksekusi

Hari ini dilakukan **audit menyeluruh** terhadap aplikasi HRCube, diikuti perbaikan kode dan pembersihan file. Total: **11 temuan audit diperbaiki**, **3 file yatim dihapus**, **2 dokumen baru dibuat**.

---

## 1. Perbaikan Bug & Kode

### 🔴 Kritis — Login Gagal

| # | File | Masalah | Perbaikan |
|---|------|---------|-----------|
| 1 | `api/_lib/auth-config.ts` | `NextAuth(authOptions)` mengembalikan `NextAuthResult` (bukan fungsi), tapi dipanggil sebagai `Auth(req, res)` → runtime crash | Rewrite: gunakan `handlers.GET/POST` dari NextAuth v5 + tulis adapter `(VercelRequest → Web Request)` dan `(Web Response → VercelResponse)` |
| 2 | `api/auth/[...auth].ts` | `export default Auth` mengekspor object, bukan handler `(req, res)` → semua route auth crash | Diganti jadi handler fungsi yang mendelegasi ke `authGet()`/`authPost()` |
| 3 | `api/_lib/auth.ts` | `requireAdmin` bergantung pada `getServerSession` yang rusak | Diadaptasi ke signature `getServerSession` baru + null guard pada `session.user` |

### 🟡 Sedang — TypeScript & Robustness

| # | File | Masalah | Perbaikan |
|---|------|---------|-----------|
| 4 | `api/_lib/auth-config.ts` | Callbacks `jwt`/`session` punya tipe `any` implisit | Gunakan `NextAuthConfig` type — TS infer otomatis |
| 5 | `src/lib/auth.tsx` | `fetchSession` langsung `.json()` tanpa cek response — crash diam jika handler error | Guard `!r.ok`, parse manual `text` → `JSON.parse`, `console.warn` untuk debugging |
| 6 | `src/lib/queries.ts:116` | Parameter `r` implisit `any` | Tambah tipe eksplisit `PrismaEmployee` |
| 7 | `src/pages/Print.tsx` | `<strike>` bukan elemen JSX valid; sort function tidak return di semua cabang | `<strike>` → `<s>`; tambah `return localeCompare()` sebagai default |
| 8 | `src/pages/Employees.tsx:1639` | `error.message` pada tipe `never` (narrowing bingung) | Cast `(error as Error).message` |

---

## 2. Fitur Baru (dari plan.md)

| Fitur | File | Deskripsi |
|-------|------|-----------|
| Auto-hitung MKG | `EmployeeForm.tsx` | `masaKerjaGolonganRuang` otomatis terisi saat `tmtGolonganRuang` diubah |
| Badge KP/KGB | `employeeUtils.ts`, `Employees.tsx` | Fungsi `checkKGBandKP` diperkaya (overdue/due/daysLeft). Badge kuning (H-90) & merah (lewat) ditampilkan di tabel desktop dan kartu mobile |
| Kolom Peringatan | `Employees.tsx` | Kolom baru "Peringatan" di tabel desktop setelah Nama, menampilkan badge KP/KGB |

---

## 3. File Dihapus (Yatim/Redundan)

| File | Alasan |
|------|--------|
| `src/pages/Ecosystem.tsx` | Tidak terdaftar di routing `App.tsx`, tidak di-import mana pun |
| `src/components/PrintTemplates.tsx` | Tidak di-import di mana pun — komponen `Print.tsx` punya template cetak sendiri |
| `scripts/add-column.ts` | Redundan — kolom `password` sudah didefinisikan di `prisma/schema.prisma:107`. Migrasi sudah ditangani oleh `prisma migrate` |

---

## 4. Dokumen Baru

| File | Isi |
|------|-----|
| `SETUP.md` | Panduan setup env vars, database, dan pembuatan akun admin. Termasuk troubleshooting |
| `AUDIT.md` | Laporan detail 11 temuan audit awal (sebelum perbaikan) |

---

## 5. File Tidak Diubah (Sudah Benar)

| File | Status |
|------|--------|
| `api/employees.ts`, `api/employees/[id].ts` | Handler sudah benar, pakai `requireAdmin` |
| `api/settings.ts` | Handler sudah benar |
| `api/auth/register.ts` | Registrasi credentials sudah benar |
| `src/lib/db.ts` | Prisma singleton pattern sudah tepat |
| `src/lib/schemas.ts` | Zod schemas sudah konsisten |
| `src/lib/kamus.ts`, `excelMapping.ts`, `employeeExport.ts` | Digunakan dan berfungsi |
| `src/lib/api.ts` | Client API gateway sudah benar |
| `src/lib/error.ts` | Centralized error handling sudah tepat |
| `src/lib/holidays.ts` | Digunakan di `Print.tsx` |
| `src/lib/utils.ts` | Digunakan di 4 komponen |
| `src/constants.ts` | Digunakan di 4 file |
| `scripts/create-admin.ts` | Masih diperlukan untuk setup admin |
| `scripts/fetch-fonts.md` | Masih relevan (di-referensi `index.css:3`) |
| `prisma/seed.ts` | Terdaftar di `npm run db:seed` |
| `prisma/schema.prisma` | Skema sudah lengkap |

---

## 6. Yang Perlu Dilakukan Pengguna

Sebelum deploy, pastikan:

1. **`AUTH_SECRET`** di-generate dan diset di Vercel
2. **`AUTH_TRUST_HOST=true`** diset di Vercel
3. **`ADMIN_EMAILS`** menyertakan email admin
4. **`scripts/create-admin.ts`** dijalankan terhadap DB produksi (Neon)

Detail lengkap di [`SETUP.md`](./SETUP.md).

```
Email    : ngerjaindiri@gmail.com
Password : sekretariat
```

---

## 7. Daftar File yang Berubah

```
Modified:
  api/_lib/auth-config.ts    — rewrite total (adapter NextAuth v5)
  api/_lib/auth.ts           — adaptasi getServerSession + null guard
  api/auth/[...auth].ts      — handler fungsi baru (authGet/authPost)
  src/lib/auth.tsx           — fetchSession robust
  src/lib/queries.ts         — fix implicit any
  src/lib/employeeUtils.ts   — KP/KGB badges + formatKPLabel
  src/components/EmployeeForm.tsx — auto-hitung MKG + placeholder
  src/pages/Employees.tsx    — kolom Peringatan + badge KP/KGB + error.message fix
  src/pages/Print.tsx        — <s> tag + sort return fix

Deleted:
  src/pages/Ecosystem.tsx
  src/components/PrintTemplates.tsx
  scripts/add-column.ts

New:
  AUDIT.md
  SETUP.md
```

---

*Sudah cukup untuk hari ini. Push dan deploy ke Vercel, lalu ikuti langkah di SETUP.md untuk menyelesaikan setup admin.*
