# HRD ASN — Product Specification

| Meta | |
|------|--|
| **Product name** | **HRD ASN** |
| **Code / deploy** | Repo `HRD` · Vercel `sekretariatpegawai` · URL production (saat ini) `sekretariatpegawai.vercel.app` |
| **Status** | Production-capable; spesifikasi ini jadi acuan pengembangan lanjutan |
| **Audience doc** | Product owner, kontributor, coding agent |
| **Related** | [constitution.md](./constitution.md) (prinsip tertinggi) · [AGENTS.md](./AGENTS.md) · [SETUP.md](./SETUP.md) · [README.md](./README.md) |

> Brand resmi: **HRD ASN**. Cookie session: `hrdasn_session`. Prefix API key teknis tetap `hrc_…` (kompatibel; bukan label UI).

---

## 1. Vision

**HRD ASN** adalah aplikasi web internal **satu dinas** untuk **manajemen data & operasional kepegawaian ASN** (dan status terkait di unit yang sama).

Tujuan utama: memberi **Kasubbag Umum & Kepegawaian (Umpeg) / staf HRD** satu tempat untuk:

1. Menyimpan dan merawat **data pegawai** yang akurat dan mudah dicari  
2. Memantau siklus kepegawaian (**KP, KGB, pensiun**)  
3. **Mencetak** dokumen administrasi yang sering dipakai unit  
4. Mengelola **master jabatan** (kamus + peta/bezetting) dan identitas surat (kop)  
5. Menyediakan **API baca** agar aplikasi dinas lain bisa pakai data yang sama  

**Bukan** full HRIS cloud (rekrutmen massal, payroll engine, e-kinerja nasional, multi-tenant multi-OPD).

---

## 2. Problem & value

| Masalah di lapangan | Value HRD ASN |
|---------------------|---------------|
| Data pegawai di Excel / folder tercerai | Satu master record per pegawai di database |
| KP / KGB / pensiun mudah terlewat | Dasbor timeline + filter mendesak |
| Cetak absen, DUK, cuti, usulan butuh data + kop | Modul cetak terhubung ke master + pengaturan |
| Kelas jabatan / formasi beda-beda | Kamus & peta jabatan terpusat |
| App lain butuh data pegawai | API key scoped (read) |

**North star (operasional):** *staf kepegawaian bisa percaya data di sistem, pakai harian untuk data pegawai, dan selesaikan cetak/pantauan tanpa spreadsheet paralel.*

---

## 3. Context organisasi

| Item | Keputusan |
|------|-----------|
| Ruang lingkup org | **Satu dinas** (bukan multi-OPD se-kabupaten) |
| Pengguna utama | **Admin kepegawaian / HRD / Kasubbag Umpeg** |
| Pengguna sekunder | Viewer (pimpinan/staf baca), app eksternal via API |
| Domain | ASN Pemda Indonesia (NIP, golongan, KP, KGB, BUP, PPPK, DUK, anjab, bezetting, cuti) |
| Data sensitif | **Tetap in-scope** (gaji, rekening, keluarga, NPWP, dll.) — dilindungi auth + role, bukan dihapus dari model |

---

## 4. Personas & akses

### 4.1 Personas

| Persona | Peran | Kebutuhan utama |
|---------|--------|-----------------|
| **Kasubbag Umpeg / Admin HRD** | Operator harian (ADMIN) | CRUD pegawai, impor Excel, pantau KP/KGB/pensiun, cetak, pengaturan, API key |
| **Staf kepegawaian** | Operator (ADMIN) | Entri/perbarui data, cari pegawai, cetak layanan |
| **Pimpinan / pejabat baca** | VIEWER (opsional) | Lihat ringkasan & data tanpa ubah |
| **Aplikasi dinas lain** | Machine client | `GET` pegawai/stats/settings via API key |

### 4.2 Role matrix

| Aksi | ADMIN | VIEWER | API key (scope) |
|------|-------|--------|-----------------|
| Login web | ✅ | ✅ | — |
| Baca pegawai / stats / settings | ✅ | ✅ | sesuai scope |
| Tulis pegawai / settings / impor | ✅ | ❌ | ❌ |
| Buat/cabut API key | ✅ | ❌ | ❌ |
| Bootstrap write via `ADMIN_EMAILS` | ✅ (env) | — | — |

Auth: session cookie HttpOnly (`hrdasn_session`), rate limit login, `AUTH_SECRET` wajib di production.

---

## 5. In scope / out of scope

### 5.1 In scope (produk sekarang + penyempurnaan)

- Autentikasi & RBAC (ADMIN / VIEWER)  
- **Master data pegawai** (CRUD, pencarian, filter, paginasi)  
- Impor / ekspor Excel + template  
- Field turunan dihitung (masa kerja, kelas/beban dari kamus, BUP/pensiun, prediksi KP/KGB)  
- Dasbor ringkasan + timeline KGB / KP / pensiun  
- Modul cetak (laporan + layanan)  
- Pengaturan identitas instansi, kop, logo  
- Kamus jabatan & peta jabatan (CSV)  
- External API read + manajemen key  
- Audit log write path (best-effort)  
- Health check, PWA ringan  
- **Polish & melengkapi** area di atas (UX, edge case, konsistensi data, rebrand, performa)

### 5.2 Out of scope (sengaja)

- Multi-dinas / multi-tenant  
- Portal self-service login ASN individu  
- Workflow approval multi-level (e-cuti digital end-to-end)  
- Integrasi resmi SIASN / BKN (kecuali diputuskan terpisah nanti)  
- Payroll / absensi mesin sidik jari real-time  
- Chat / AI assistant di navigasi  
- Mobile native (cukup PWA web)

---

## 6. Modul produk

Prioritas pemakaian harian (dari product owner):

1. **Data pegawai** — paling sering  
2. Modul lain (ringkasan, cetak, pengaturan) — **seimbang**; jangan diabaikan, tapi pengembangan tidak mengorbankan kualitas master data

### 6.1 Ringkasan (Dashboard)

- Agregat jumlah pegawai per status: PNS, CPNS, PPPK, PPPKPW, Honorer, Lainnya  
- Distribusi per bidang/unit (normalisasi label untuk chart)  
- Timeline **KGB**, **KP**, **pensiun** dengan filter: semua / overdue / ≤30 hari / ≤90 hari  
- Refresh manual (bukan full-list polling agresif)  
- Data dari `GET /api/stats` (agregasi server), bukan dump seluruh employee ke browser

### 6.2 Pegawai (core)

- Daftar: search `q`, filter status, alert KP/KGB, limit/offset  
- Detail & form: identitas, alamat, jabatan/bidang/status, pangkat/golongan, gaji & admin, cuti sisa, keluarga  
- Create / update / delete (admin); bulk upsert impor; bulk delete bila ada  
- Impor Excel: normalisasi, match NIP/NIK, max 500 baris, error per baris  
- Ekspor Excel: termasuk kolom bantu/turunan untuk operator  
- NIP 18 (PNS/CPNS): ekstrak tgl lahir / TMT / JK jika field kosong  
- **Jangan persist** field turunan (lihat §7.2)

### 6.3 Cetak

Kategori **Laporan** (contoh): absen global/bidang, tanda terima, anjab, model DK, DUK, bezetting  

Kategori **Layanan** (contoh): surat cuti, usulan KGB, usulan KP  

Prinsip:

- Ambil data dari master pegawai + settings (kop, logo, pejabat, kamus)  
- Form cuti: field default kosong (hindari data contoh tercetak ke dokumen resmi)  
- Hitung hari kerja cuti dengan kalender libur yang ada di app  
- Semua jenis cetak **tetap didukung seimbang**; quality bar sama, volume pemakaian boleh beda

### 6.4 Pengaturan

| Tab | Isi |
|-----|-----|
| Identitas | Nama pejabat, data instansi yang dipakai kop/surat |
| Cetak / kop | Baris kop, logo (≤1MB) |
| Kamus jabatan | CSV: jabatan → kelas, beban kerja |
| Peta jabatan | Formasi / kebutuhan vs aktual (bezetting) |
| API & integrasi | Generate / revoke API key (`hrc_…`), scope, origin opsional |

Guard: perubahan belum disimpan → konfirmasi sebelum pindah route (`useBlocker` + data router) + `beforeunload`.

### 6.5 External API

| Endpoint | Scope |
|----------|--------|
| `GET /api/v1/employees` | `employees:read` |
| `GET /api/v1/employees/:id` | `employees:read` |
| `GET /api/v1/stats` | `stats:read` |
| `GET /api/v1/settings` | `settings:read` |
| `GET /api/v1/openapi` | publik |
| Kelola key | session admin only |

- Secret hanya ditampilkan sekali; DB simpan hash SHA-256  
- Rate limit IP + per-key; max active keys (kebijakan saat ini ~25)  
- CORS untuk client browser v1; origin binding opsional per key  

---

## 7. Domain model & aturan bisnis

### 7.1 Entitas

| Entitas | Peran |
|----------|--------|
| **Employee** | Master pegawai |
| **Settings** | Singleton JSON (id `app`) — kop, logo, kamus, peta |
| **User / Session** | Auth web |
| **AuditLog** | Jejak tulis (best-effort) |
| **ApiKey** | Akses programatik |
| **RateLimitBucket** | Rate limit terdistribusi di Neon |

### 7.2 Employee — status

`PNS | CPNS | PPPK | PPPKPW | Honorer | Lainnya`

### 7.3 Field disimpan vs turunan

| Disimpan (contoh) | Dihitung saat baca (jangan di-DB) |
|-------------------|-------------------------------------|
| NIK, NIP, nama, JK, TTL, alamat | `masaKerja` |
| jabatan, bidang, status, TMT | `kelasJabatan`, `bebanKerja` (dari kamus) |
| pangkat, gol, TMT golongan, tgl berkala | prediksi **KP** / **KGB** |
| gaji, rekening, NPWP, keluarga, sisa cuti | **pensiun** / BUP |

### 7.4 Aturan prediksi (ringkas)

| Konsep | Logika (implementasi di `employeeUtils` / `dashboardStats`) |
|--------|---------------------------------------------------------------|
| **KGB** | ~+2 tahun dari tanggal berkala terakhir (fallback TMT kerja/golongan) |
| **KP** | ~+4 tahun dari TMT golongan ruang (ada kasus khusus PNS golongan tertentu) |
| **BUP / pensiun** | Default 58 th; madya / eselon II / kepala dinas·badan → 60; “utama” → 65; TMT pensiun = awal bulan setelah ulang tahun BUP |

Perubahan aturan BUP/KP/KGB di masa depan **harus** di-spec-kan di sini dan diuji unit — jangan hanya ubah UI.

### 7.5 Identitas & unik

- NIK: kosong atau 16 digit  
- NIP: kosong atau 8–25 digit (canonical digits-only)  
- Unik NIP/NIK non-kosong: partial unique di DB + cek aplikasi  
- Import: match existing by NIP/NIK untuk upsert  

### 7.6 Keluarga

JSON array: hubungan `Istri | Suami | Anak` + metadata opsional.

---

## 8. Arsitektur & constraints (wajib dihormati)

```
Browser (src/)  →  /api/*  →  Vercel 1 function (api/index.ts)
                         →  handlers (src/server/handlers/**)
                         →  Prisma  →  Neon
```

| Aturan | Alasan |
|--------|--------|
| UI tidak import Prisma / `queries` / `db` | Batas trust & bundle |
| Hanya lewat `src/lib/api.ts` ke backend | Satu client gateway |
| Satu Serverless Function | Vercel Hobby ≤12 functions |
| Tidak menambah `api/foo.ts` top-level baru | Daftarkan di router `api/index.ts` |
| List default 50, max 500 | Performa |
| Zod ketat di write; read path mapper cepat | Latency |
| xlsx dynamic import | Bundle settings/employees |
| Lazy route pages | First load |
| Design tokens `src/lib/ui.ts` | Konsistensi flat UI |
| Feedback: `notify`, `ConfirmDialog` — bukan `alert`/`confirm` | UX |

Stack acuan: React 19, Vite 6, Tailwind 4, Motion, Recharts, Prisma 6, Neon, Vercel, PWA.

Detail kontributor: **[AGENTS.md](./AGENTS.md)**. Deploy/env: **[SETUP.md](./SETUP.md)**.

---

## 9. Non-functional requirements

| Area | Target |
|------|--------|
| **Keamanan** | Session HttpOnly; RBAC; secret env; API key hashed; rate limit; tidak commit secret |
| **Data sensitif** | Hanya user terautentikasi; VIEWER read-only; audit write |
| **Performa** | Stats server-side; paginasi; kamus cache singkat; hindari full dump ke client untuk dashboard |
| **Ketersediaan** | `/api/health` → `db: up` sebagai smoke production |
| **UX** | Bahasa operator ID; mobile bottom nav; desktop sidebar; empty/loading states jelas |
| **Observability** | `x-response-time`; audit best-effort; error generik ke client |
| **Kualitas** | `npm run lint`, `npm test` hijau untuk perubahan domain |

---

## 10. Roadmap pengembangan lanjutan

Fokus product owner: **menyempurnakan area yang sudah ada**, bukan fitur besar baru.

### 10.1 P0 — Stabilitas & brand

- [x] Rebrand **HRCube → HRD ASN** (title, login, sidebar, PWA manifest, docs user-facing)  
- [ ] Pastikan Settings / router / guard dirty form stabil di production  
- [ ] Checklist go-live berulang: env, migrate, admin, `/api/health`  
- [ ] Samakan copy error login & empty state ke bahasa operator

### 10.2 P1 — Data pegawai (prioritas pemakaian)

- [ ] Perhalus form (validasi, NIP auto-fill, UX tab, dirty save)  
- [ ] Perkuat impor Excel (pesan error, partial success, mapping kolom)  
- [ ] Filter/alert KP-KGB di list lebih jelas & konsisten dengan dasbor  
- [ ] Performa list (lean mode, kolom yang ditampilkan)  
- [ ] Review field wajib vs opsional sesuai praktik Umpeg di dinas

### 10.3 P1 — Ringkasan

- [ ] Kejelasan overdue / H-30 / H-90  
- [ ] Label bidang selaras dengan struktur dinas aktual  
- [ ] Deep-link dari item timeline ke detail pegawai (jika belum lengkap)

### 10.4 P1 — Cetak

- [ ] Audit setiap template vs dokumen resmi dinas (kop, pejabat, urutan kolom)  
- [ ] Hindari hardcoded placeholder berbahaya  
- [ ] Print CSS / preview konsisten  
- [ ] Cuti: stok cuti & pengurangan sisa (jika diinginkan sebagai penyempurnaan alur)

### 10.5 P2 — Pengaturan & master

- [ ] Kamus/peta: validasi baris, import/export andal  
- [ ] Default kamus/bidang disesuaikan dinas (bukan sisa template generik jika beda)  
- [ ] API keys UX (scope, expiry, last used) jelas untuk admin

### 10.6 P2 — Platform

- [ ] Audit log viewer (read-only) di UI admin — opsional  
- [ ] Hardening rate limit / CORS origin  
- [ ] Test coverage domain (KP/KGB/BUP, import, schemas)  
- [ ] Rename cookie/session branding jika rebrand full

### 10.7 Explicit non-goals periode ini

Fitur baru besar (multi-dinas, SIASN, portal pegawai, chat AI) **tidak** masuk sprint sampai area §10.1–10.5 dirasa cukup matang.

---

## 11. User stories acuan (penyempurnaan)

### Data pegawai

- Sebagai Kasubbag Umpeg, saya ingin mencari pegawai by nama/NIP agar bisa perbarui data dalam hitungan detik.  
- Sebagai staf HRD, saya ingin impor Excel tanpa mengetik ulang ratusan baris, dengan error per baris yang bisa diperbaiki.  
- Sebagai admin, saya ingin sistem menolak NIK/NIP tidak valid dan mencegah duplikat.

### Ringkasan

- Sebagai Kasubbag Umpeg, saya ingin melihat siapa yang mendekati KGB/KP/pensiun minggu ini agar bisa siapkan usulan.

### Cetak

- Sebagai staf kepegawaian, saya ingin mencetak absensi / DUK / surat cuti / usulan KGB-KP dengan data dan kop yang sama dengan master.

### Pengaturan

- Sebagai admin, saya ingin ubah kop & logo sekali dan semua cetakan ikut.  
- Sebagai admin, saya ingin kelola API key untuk app dinas lain tanpa berbagi password login.

---

## 12. API surface (kontrak ringkas)

### Session (web)

| Method | Path | Akses |
|--------|------|--------|
| POST | `/api/auth/login` | publik (rate limit) |
| POST | `/api/auth/logout` | publik / session |
| GET | `/api/auth/me` | publik (null jika belum login) |
| GET | `/api/employees` | staff |
| POST/PUT/DELETE | `/api/employees` … | admin |
| GET | `/api/stats` | staff |
| GET/PUT | `/api/settings` | staff / admin |
| GET | `/api/health` | publik |

### External (`/api/v1/*`)

Lihat §6.5. Auth: `Authorization: Bearer hrc_…` atau `X-API-Key`.

Perubahan breaking pada kontrak API **wajib** dicatat di changelog / OpenAPI.

---

## 13. Glosarium

| Istilah | Arti di produk ini |
|---------|-------------------|
| **ASN** | Aparatur Sipil Negara (dan data status terkait di dinas) |
| **Umpeg** | Umum & Kepegawaian (Kasubbag / unit pengelola) |
| **NIP / NIK** | Nomor Induk Pegawai / Kependudukan |
| **KP** | Kenaikan Pangkat (prediksi ~4 tahun) |
| **KGB** | Kenaikan Gaji Berkala (prediksi ~2 tahun) |
| **BUP** | Batas Usia Pensiun |
| **DUK** | Daftar Urut Kepangkatan |
| **Anjab** | Analisis Jabatan (dokumen/cetakan terkait) |
| **Bezetting** | Kesesuaian formasi vs pejabat aktual |
| **Kamus jabatan** | Master jabatan → kelas & beban kerja |
| **Peta jabatan** | Peta formasi / kebutuhan personel |
| **PPPK / PPPKPW** | Pegawai Pemerintah dengan Perjanjian Kerja (+ PW bila dipakai dinas) |
| **Lean list** | Response pegawai dipangkas field berat untuk list/cetak batch |

---

## 14. Definition of Done (perubahan fitur)

Perubahan dianggap selesai jika:

1. Sesuai scope §5 dan constraints §8  
2. Role ADMIN/VIEWER dihormati  
3. Field turunan tidak di-persist  
4. UI pakai pola feedback & design tokens yang ada  
5. `npm run lint` (+ test relevan) lulus  
6. Jika API berubah: handler + client `api.ts` + (bila v1) OpenAPI selaras  
7. Copy user-facing mengarah ke brand **HRD ASN** (untuk layar yang disentuh)

---

## 15. Keputusan terbuka (isi nanti bila perlu)

| Topik | Status |
|-------|--------|
| Domain production final (custom domain dinas) | TBD |
| Apakah cuti mengurangi `sisaCutiN` otomatis setelah cetak | Belum diputuskan — kandidat penyempurnaan |
| Apakah VIEWER boleh lihat gaji/rekening | Saat ini ya (read all staff); batasi field = keputusan terpisah |
| Integrasi SIASN / BKN | Out of scope sampai P0–P1 matang |

---

## 16. Ringkasan satu paragraf

**HRD ASN** adalah sistem web internal **satu dinas** untuk **manajemen kepegawaian**, diutamakan bagi **admin HRD / Kasubbag Umpeg**: master data pegawai (paling sering dipakai), pantauan KP/KGB/pensiun, cetak dokumen, master jabatan & kop surat, serta API baca untuk app lain. Pengembangan lanjutan memprioritaskan **melengkapi dan merapikan modul yang sudah ada**, dengan kualitas data pegawai sebagai pusat gravitasi produk—bukan ekspansi multi-OPD atau HRIS generik.
