# Constitution — HRD ASN

**Dokumen tertinggi** untuk pembuatan & pengembangan aplikasi ini.  
Berlaku untuk manusia (product owner, kontributor) dan **coding agent** (AI).

| Meta | |
|------|--|
| **Produk** | HRD ASN (internal, satu dinas) |
| **Status** | Berlaku — melanggar butuh amandemen tertulis di file ini |
| **Bahasa** | Indonesia (istilah teknis boleh Inggris) |
| **Hierarki** | Lihat §1 |

> Dokumen ini **bukan** tutorial coding dan **bukan** kamus hukum kepegawaian.  
> Ini adalah **aturan main** agar app tetap selaras tujuan meski pembuatnya bukan pakar HRD ASN atau web.

---

## 1. Hierarki dokumen (siapa menang jika bentrok)

```
1. constitution.md     ← prinsip & larangan (file ini)
2. specify.md         ← apa yang dibangun (produk, scope, roadmap)
3. AGENTS.md          ← bagaimana kode disusun (arsitektur, UI, API)
4. SETUP.md           ← cara jalanin / deploy
5. Kode + tes         ← kebenaran implementasi saat ini
```

| Jika… | Maka… |
|-------|--------|
| Fitur baru bertentangan dengan constitution | **Tolak** atau amandemen constitution dulu |
| Fitur ada di roadmap specify tapi detail beda | Update **specify** dulu, lalu kode |
| Cara implement beda dengan AGENTS | Ikuti **AGENTS** kecuali constitution melarang |
| Kode & docs tidak sinkron | Perbaiki yang salah; **jangan** diam-diam ubah perilaku domain |

**Coding agent wajib** membaca constitution + specify + AGENTS sebelum perubahan besar.

---

## 2. Maksud konstitusi (buat non-ahli)

Kamu tidak harus jadi ahli. Konstitusi ini menjawab empat pertanyaan:

1. **App ini untuk apa?** → bantu kepegawaian dinas kelola data & operasi harian.  
2. **Siapa yang dilayani dulu?** → Kasubbag Umpeg / admin HRD.  
3. **Apa yang boleh / tidak boleh ditambah?** → sempurnakan yang ada; jangan jadi “semua fitur HR di dunia”.  
4. **Kalau ragu, pilih yang mana?** → data benar, aman, sederhana, bisa di-maintain.

---

## 3. Identitas & tujuan produk (tidak digeser tanpa amandemen)

### 3.1 Satu kalimat

**HRD ASN** adalah aplikasi web internal **satu dinas** untuk **manajemen data dan operasional kepegawaian**, diutamakan bagi **admin HRD / Kasubbag Umpeg**.

### 3.2 Tujuan yang sah

| # | Tujuan | Contoh |
|---|--------|--------|
| 1 | **Data pegawai** andal & mudah dipakai | Cari, ubah, impor Excel, cegah duplikat NIP/NIK |
| 2 | **Pantau siklus** kepegawaian | KP, KGB, pensiun di ringkasan |
| 3 | **Cetak** dokumen operasional | Absen, DUK, cuti, usulan, bezetting, … |
| 4 | **Master pendukung** | Kop surat, kamus jabatan, peta jabatan |
| 5 | **Integrasi baca** | API key untuk app dinas lain (read-only scopes) |

### 3.3 Bukan tujuan (default ditolak)

Tanpa amandemen constitution **dan** update specify:

- Multi-dinas / multi-tenant “satu app se-kabupaten”  
- Portal login pegawai massal (self-service ASN)  
- Pengganti resmi SIASN / BKN / e-kinerja nasional  
- Payroll engine / absensi mesin sidik jari real-time  
- Chatbot / AI asisten sebagai fitur inti navigasi  
- Rewrite total stack “karena tren” tanpa alasan operasional  

### 3.4 Prioritas pemakaian

1. **Data pegawai** — gravitasi produk (paling sering dipakai)  
2. Modul lain (ringkasan, cetak, pengaturan, API) — **seimbang**, jangan dibiarkan rusak  
3. Fitur baru spekulatif — **di belakang** penyempurnaan area existing  

---

## 4. Prinsip produk (product principles)

### P1 — Operator first

Tulis dan rancang untuk **staf kepegawaian yang sibuk**, bukan untuk demo investor.

- Bahasa UI: singkat, Indonesia, kata kerja jelas (“Simpan”, “Impor”, “Cetak”).  
- Satu aksi utama per layar; aksi sekunder di “Lainnya” bila perlu.  
- Error harus bilang **apa yang salah** dan **apa yang bisa dilakukan**, bukan stack trace mentah.

### P2 — Satu sumber kebenaran

- **Database app** = sumber kebenaran data pegawai untuk dinas ini.  
- Excel = pintu masuk/keluar, **bukan** master paralel jangka panjang.  
- Cetak & dasbor **wajib** membaca master + pengaturan, bukan angka hardcode di template.

### P3 — Hitung, jangan menimbun turunan

Field yang **bisa dihitung** dari data lain **tidak disimpan** sebagai sumber:

- masa kerja, kelas jabatan, beban kerja, tanggal pensiun (BUP), prediksi KP/KGB  

Disimpan: data dasar (NIP, TMT, jabatan, tgl lahir, tgl berkala, …).  
Dihitung: saat baca / cetak / stats.

**Alasan:** mencegah data turunan basi saat aturan atau input berubah.

### P4 — Keamanan data sensitif non-negotiable

Data gaji, rekening, keluarga, NIK, dll. **tetap ada** (kebutuhan kepegawaian) tetapi:

- Hanya lewat auth (session atau API key)  
- VIEWER tidak boleh menulis  
- Secret (password DB, `AUTH_SECRET`, API key plaintext) **tidak** pernah di commit / di chat publik / di screenshot docs  
- Production **wajib** `AUTH_SECRET` + DB URL yang benar  

### P5 — Sederhana menang dari “lengkap tapi rapuh”

Lebih baik:

- satu alur impor yang andal, daripada lima mode impor setengah jadi  
- satu API function yang terawat, daripada 20 endpoint terpisah yang sulit di-deploy  

### P6 — Sempurnakan dulu, perluas kemudian

Roadmap default: **rapikan modul yang sudah ada** (data, ringkasan, cetak, settings, API, brand).  
Fitur besar baru hanya setelah specify bilang “masuk scope” dan constitution tidak dilanggar.

### P7 — Domain kepegawaian: hormati, jangan mengarang

Pemilik produk **boleh** bukan ahli HRD ASN. Karena itu:

| Boleh | Tidak boleh |
|-------|-------------|
| Implement aturan yang **sudah tertulis** di specify / kode teruji | Mengarang aturan BUP/KP/KGB “karena kelihatannya benar” |
| Menanya / menandai `TBD` di specify | Mengubah rumus pensiun diam-diam tanpa tes & catatan |
| Menyalin istilah resmi yang sudah dipakai dinas | Menjanjikan kepatuhan hukum 100% tanpa verifikasi pejabat |

**Aturan default jika ragu soal HRD:**  
simpan data mentah + tampilkan apa adanya; **jangan** otomatisasi keputusan kepegawaian yang berisiko (mis. “hapus pegawai karena prediksi pensiun”).

Verifikasi aturan penting (BUP, KP, KGB, cuti) dengan **Kasubbag Umpeg / pejabat berwenang** sebelum dianggap final.

### P8 — Bisa dioperasikan orang non-DevOps

Deploy & recovery harus terdokumentasi di SETUP:

- env yang wajib  
- migrasi DB  
- buat admin  
- cek `/api/health`  

Jangan menambah langkah “rahasia hanya di kepala developer”.

---

## 5. Prinsip teknis (web app) — ringkas & wajib

Detail path/file ada di **AGENTS.md**. Di sini hanya **hukum** yang tidak boleh dilanggar.

### T1 — Arsitektur berlapis

```
Browser (UI) → /api/* → 1 Serverless Function → handlers → Prisma → Neon
```

| Larangan | Alasan |
|----------|--------|
| UI import Prisma / DB langsung | Bocor data & merusak batas keamanan |
| Bypass `src/lib/api.ts` untuk call API ad-hoc tanpa pola | Inkonsistensi auth/error |
| Menambah banyak file `api/*.ts` sebagai function terpisah | Batas Vercel Hobby; proyek ini sengaja **1 function** |
| Dynamic import handler yang mudah gagal di serverless | Deploy rapuh |

### T2 — Auth & otorisasi di server

- Cek role di **handler server**, bukan hanya sembunyikan tombol di UI.  
- UI boleh menyembunyikan aksi write untuk VIEWER; **server tetap menolak** (403).  
- API key: scope ketat, hash di DB, tidak ada wildcard scope.

### T3 — Performa sebagai fitur

- List pegawai: paginasi (jangan tarik ribuan baris “sekali untuk berjaga”).  
- Dasbor: agregasi di server (`/api/stats`).  
- Library berat (`xlsx`, charts): load saat dibutuhkan.  
- Route page: lazy-load.

### T4 — Validasi di tempat yang tepat

- **Write path:** schema (Zod) + aturan bisnis.  
- **Read path:** cepat; jangan Zod berat per baris list.  
- Import: normalize + error per baris yang bisa dibaca manusia.

### T5 — UI konsisten

- Token dari `src/lib/ui.ts` (flat, slate, border, bukan gradient/indigo acak).  
- Feedback: toast `notify`, konfirmasi destruktif `ConfirmDialog`.  
- Jangan `window.alert` / `window.confirm`.  
- Motion ringan (durasi pendek); jangan animasi yang menghalangi kerja.

### T6 — Data router & navigasi

- App memakai **data router** (`createBrowserRouter`) agar fitur seperti guard “ada perubahan belum disimpan” aman.  
- Jangan kembali ke `BrowserRouter` murni jika masih ada `useBlocker`.

### T7 — Observability minimal

- Health: `/api/health` harus bisa jawab DB up/down.  
- Write penting: audit log best-effort (gagal audit **tidak** boleh menggagalkan bisnis utama tanpa alasan kuat).  
- Error ke user: aman; detail teknis di log server.

### T8 — Tes untuk domain, bukan untuk gengsi

Wajib pertimbangkan unit test saat mengubah:

- `schemas`, import pegawai, KP/KGB/BUP, auth helpers  

Tidak wajib 100% coverage UI; **wajib** tidak merusak logika yang sudah diuji.

### T9 — Lingkungan & secret

| Env | Wajib production |
|-----|------------------|
| `DATABASE_URL` | ✅ (pooled) |
| `DIRECT_URL` | ✅ (migrate) |
| `AUTH_SECRET` | ✅ (≥ 16 char) |
| `ADMIN_EMAILS` | sangat disarankan |

Jangan hardcode password admin di repo. Pakai `create-admin` + env.

---

## 6. Standar kualitas perubahan (Definition of Ready / Done)

### 6.1 Sebelum kerja (Ready)

- [ ] Jelas **masalah operator** yang diselesaikan (1–2 kalimat)  
- [ ] Cocok §3–4 constitution + ada di specify (atau specify di-update dulu)  
- [ ] Diketahui modul mana: Pegawai / Ringkasan / Cetak / Settings / API / Platform  
- [ ] Diketahui dampak role ADMIN vs VIEWER  

### 6.2 Sesudah kerja (Done)

- [ ] Perilaku sesuai specify  
- [ ] Tidak melanggar §5 (arsitektur, auth server-side, derived fields)  
- [ ] Tidak ada secret di diff  
- [ ] `npm run lint` lulus; tes terkait domain lulus  
- [ ] Copy UI mengarah ke bahasa operator; brand mengarah **HRD ASN** pada layar yang disentuh (setelah rebrand dimulai)  
- [ ] Jika API berubah: handler + client + (v1) OpenAPI selaras  
- [ ] SETUP/specify di-update jika alur operasi berubah  

### 6.3 “Selesai” yang ditolak

- “Jalan di laptop saya” tapi health production `db: down`  
- Tombol disembunyikan tapi API write masih terbuka  
- Fitur demoware tanpa empty/error state  
- Migrasi schema diubah tanpa `prisma migrate` yang bisa di-deploy  

---

## 7. Cara memutuskan saat ragu (playbook non-ahli)

Gunakan **secara berurutan**:

### Langkah 1 — Apakah ini urusan kepegawaian harian Umpeg?

- **Ya** → lanjut.  
- **Tidak / spekulatif** → masuk backlog ide; jangan kerjakan sekarang.

### Langkah 2 — Apakah memperkuat data pegawai atau modul existing?

- **Ya** → prioritas tinggi.  
- **Hanya fitur baru mengkilap** → tunda.

### Langkah 3 — Apakah butuh mengarang aturan ASN?

- **Ya** → tulis asumsi di specify sebagai `TBD`; implement flag/aman; minta konfirmasi Umpeg.  
- **Tidak** (hanya UI/teknis) → kerjakan dengan constraints AGENTS.

### Langkah 4 — Apakah menambah kompleksitas infrastruktur?

- Contoh: service baru, DB kedua, auth provider baru, banyak serverless function.  
- **Default: tidak.** Cari solusi di stack sekarang (Vite + 1 API function + Neon).

### Langkah 5 — Pilih opsi yang mudah di-rollback

- Migrasi kecil, fitur di belakang flag/perilaku backward compatible, commit terfokus.

### Matriks cepat

| Situasi | Keputusan default |
|---------|-------------------|
| Konflik “fitur keren” vs “data benar” | **Data benar** |
| Konflik “otomatis penuh” vs “operator kontrol” | **Operator kontrol** (konfirmasi destruktif) |
| Konflik “generik multi-dinas” vs “satu dinas pas” | **Satu dinas pas** |
| Konflik “optimize prematur” vs “jelas & terukur” | **Jelas dulu**; optimize yang terukur (list/stats) |
| Tidak yakin breaking API | **Jangan break**; version atau field baru |

---

## 8. Aturan kolaborasi dengan coding agent (AI)

### 8.1 Agent boleh

- Refactor terukur dalam scope tugas  
- Menambah tes domain  
- Memperbaiki bug & UX sesuai specify  
- Menyarankan opsi + trade-off dalam bahasa sederhana  

### 8.2 Agent wajib

- Mengikuti constitution → specify → AGENTS  
- Menjelaskan perubahan dalam bahasa non-ahli bila diminta  
- Tidak menghapus/merusak data production  
- Tidak menaruh secret di kode/docs  
- Bertanya bila tugas mengubah **aturan KP/KGB/BUP**, model data besar, atau auth  

### 8.3 Agent dilarang (tanpa izin eksplisit manusia)

- Force-push, hapus branch production, drop database  
- Deploy production dengan credential baru yang tidak dikonfirmasi  
- Rebrand massal / migrasi besar di luar scope permintaan  
- Menambah dependensi besar (auth provider, ORM kedua, UI kit penuh) tanpa alasan di specify  
- Menulis exploit, backdoor, atau menonaktifkan auth “sementara”  

### 8.4 Komunikasi ke product owner non-teknis

Saat selesai tugas, ringkas dalam format:

1. **Apa yang berubah** (bahasa sehari-hari)  
2. **Apa yang perlu dicoba** di browser  
3. **Risiko / yang belum**  
4. **Langkah deploy** bila perlu (push, env, migrate)  

---

## 9. Keamanan & etika data (ringkas)

1. Data pegawai = data pribadi pejabat/ASN dinas — perlakukan serius.  
2. Akun: password kuat; rotate jika bocor; `REVOKE_SESSIONS` saat ganti password massal.  
3. API key: scope minimum; cabut jika tidak dipakai; jangan commit key.  
4. Jangan log password, isi cookie session, atau full API key.  
5. Audit trail untuk aksi tulis penting — usahakan tetap hidup.  
6. Dilarang memakai data production untuk demo publik tanpa sanitasi.

---

## 10. Proses amandemen constitution

Constitution **sengaja kaku**. Mengubahnya adalah keputusan produk.

1. Tulis usulan: pasal mana, mengapa, dampak.  
2. Pastikan tidak bertentangan dengan kenyataan hukum/internal dinas (bila relevan).  
3. Update file ini (tanggal + ringkas “Changelog constitution”).  
4. Selaraskan specify (dan AGENTS bila perlu).  
5. Baru implement kode.

### Changelog constitution

| Tanggal | Perubahan |
|---------|-----------|
| 2026-07-13 | Versi awal — prinsip produk & teknis untuk HRD ASN, satu dinas, fokusurnakan existing |

---

## 11. Peta cepat “dokumen mana yang dibuka”

| Kebutuhan | Buka |
|-----------|------|
| Boleh nggak bikin fitur X? | **constitution** §3–4 + **specify** scope |
| Aturan KP/KGB/modul | **specify** |
| Folder mana, pola API/UI | **AGENTS** |
| Env, migrate, admin, Vercel | **SETUP** |
| Cara agent/AI harus bersikap | **constitution** §8 |

---

## 12. Sumpah ringkas (bisa ditempel di PR / prompt agent)

```
Saya membangun HRD ASN untuk Kasubbag Umpeg / admin kepegawaian satu dinas.
Saya utamakan data pegawai yang benar dan aman.
Saya sempurnakan yang ada sebelum menambah yang spekulatif.
Saya tidak menyimpan field turunan; saya hitung saat baca.
Saya jaga batas UI ↔ API ↔ DB; auth ditegakkan di server.
Saya tidak mengarang hukum kepegawaian; aturan domain tertulis & teruji.
Saya tidak commit secret.
Saya patuh constitution.md → specify.md → AGENTS.md.
```

---

## 13. Rekomendasi pemakaian untuk pemilik non-ahli

1. **Setiap minta fitur ke AI**, tempel atau sebut: “patuh `constitution.md` + `specify.md`”.  
2. **Jangan** mulai dari “bikin seperti SAP/HRIS besar” — mulai dari pain harian Umpeg.  
3. **Uji sendiri** dengan skenario: login → cari pegawai → edit → simpan → cek ringkasan → cetak satu dokumen.  
4. **Untuk aturan ASN** (pensiun, KP, cuti): catat keputusan pejabat di specify, baru minta AI mengubah rumus.  
5. **Rebrand / fitur besar**: satu gelombang terkontrol, bukan campur aduk dengan bugfix acak.  
6. Review PR/diff dengan checklist §6.2 — kamu tidak perlu paham semua baris kode.

---

*Akhir constitution. Jika ragu: pilih yang membuat data lebih benar, sistem lebih aman, dan operator lebih cepat selesai kerjanya.*
