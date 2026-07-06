# Rencana Eksekusi Peningkatan Data Pegawai

Dokumen ini berisi rencana matang (eksekusi) untuk mengimplementasikan saran-saran perbaikan pada manajemen data pegawai, baik dari sisi logika (rumus) maupun antarmuka pengguna (UI/UX).

## 1. Validasi NIP yang Lebih Ketat (Strict Validation)
**Tujuan:** Mencegah kesalahan input NIP yang menghasilkan tanggal lahir atau TMT Kerja tidak masuk akal.
**Langkah Eksekusi:**
- Memperbarui `useEffect` pada `EmployeeForm.tsx` saat memantau `nip`.
- Menambahkan regex atau fungsi validasi ekstraksi NIP (18 digit).
- Memastikan tahun lahir masuk akal (misal > 1950), bulan lahir antara 01-12, dan tanggal lahir antara 01-31.
- Memastikan bulan pada TMT CPNS (digit 13-14) valid (01-12).
- Jika kondisi tidak terpenuhi, auto-fill tidak akan dieksekusi agar tidak mengisi field dengan tanggal yang "Invalid".

## 2. Perhitungan Otomatis Batas Usia Pensiun (BUP) & TMT Pensiun
**Tujuan:** Sistem dapat menentukan kapan seorang pegawai pensiun berdasarkan tanggal lahir dan kelas/jenis jabatannya.
**Langkah Eksekusi:**
- Membuat fungsi utilitas `calculateBUP(tanggalLahir, jabatan)` di berkas terpisah atau di dalam helper.
- **Aturan Umum:**
  - 58 Tahun: Jabatan Administrasi, Pelaksana, Fungsional Keterampilan, Fungsional Ahli Pertama & Ahli Muda.
  - 60 Tahun: Eselon II (JPT Pratama), Fungsional Ahli Madya.
  - 65 Tahun: Fungsional Ahli Utama.
- **Penerapan:** Pada `EmployeeForm.tsx`, ketika `tanggalLahir` atau `jabatan` berubah, hitung dan isi nilai `pensiun` (TMT Pensiun = Ulang tahun ke-BUP, biasanya pensiun TMT awal bulan berikutnya).

## 3. Perhitungan Masa Kerja Otomatis (Masa Kerja Keseluruhan)
**Tujuan:** Menampilkan masa kerja riil secara live ("X Tahun Y Bulan").
**Langkah Eksekusi:**
- Membuat fungsi `calculateMasaKerja(tmtKerja)` menggunakan library `date-fns` (misal `differenceInYears` dan `differenceInMonths`).
- Di `EmployeeForm.tsx`, pantau perubahan field `tmtKerja`. Jika terisi, hitung masa kerja hingga hari ini.
- Update nilai pada input field `masaKerja` sesuai dengan format (contoh: "10 Tahun 5 Bulan").
- (Opsional) Pada list tabel dashboard/karyawan, buat kolom Masa Kerja terhitung live setiap render.

## 4. Peringatan / Notifikasi KP & KGB (Kenaikan Pangkat & Gaji Berkala)
**Tujuan:** Memberikan flag atau badge pengingat untuk pegawai yang sudah waktunya mengurus KP atau KGB.
**Langkah Eksekusi:**
- Menambahkan badge status (contoh: merah/kuning/hijau) di komponen baris `Employee` pada `Employees.tsx` atau detail.
- **Logika KGB (2 Tahun):** Jika `tanggalBerkalaTerakhir` + 2 Tahun <= Tanggal Hari Ini.
- **Logika KP (4 Tahun):** Jika `tmtGolonganRuang` + 4 Tahun <= Tanggal Hari Ini.
- Bisa juga diintegrasikan di dashboard agar admin SDM mendapat rekapitulasi siapa saja yang mendekati KP/KGB dalam 3 bulan ke depan.

## 5. Merombak UI Formulir Pegawai (Tab Navigation)
**Tujuan:** Mengurangi *scroll fatigue* dengan membagi form menjadi beberapa bagian (Tab/Steps) yang rapi.
**Langkah Eksekusi:**
- Memperbarui struktur antarmuka (JSX) di `EmployeeForm.tsx`.
- Menyiapkan state `activeTab` (misalnya: 1, 2, 3, 4).
- Membagi puluhan input field ke dalam 4 Tab menggunakan navigasi atas bergaya modern/flat:
  - **Tab 1: Identitas Pribadi** (Nama, NIP, NIK, JK, Tempat/Tgl Lahir, Alamat lengkap, Agama, Status Kawin, No. HP, dll).
  - **Tab 2: Jabatan & Penempatan** (Jabatan, Bidang, Status Pegawai, Pendidikan, Jurusan, Diklat Jenjang, SK Terakhir).
  - **Tab 3: Kepangkatan & Gaji** (Pangkat, Golongan, TMT Golongan, MKG, TMT Kerja, Masa Kerja, Gaji Pokok, Besaran Kotor, Rekening, NPWP, PP/SK Gaji, Tanggal Berkala, Karpeg, Pensiun).
  - **Tab 4: Keluarga & Cuti** (Data Suami/Istri, Anak 1-5, Sisa Cuti).
- Mengintegrasikan style flat tab yang bersih (misal *border-bottom* atau pill-shaped tab) sesuai dengan tema `AGENTS.md`.

---
*Rencana di atas siap dieksekusi secara berurutan sesuai arahan selanjutnya.*

## Langkah-Langkah Eksekusi (Step-by-Step Execution Plan)

Agar proses pembaruan berjalan mulus, terstruktur, dan tidak mengganggu fungsionalitas yang ada, kita akan membaginya ke dalam 4 tahap (Phase):

### Tahap 1: Pembuatan Utilitas Logika (`src/lib/employeeUtils.ts`)
*Kita akan memisahkan fungsi-fungsi rumit dari komponen UI agar kode lebih bersih dan mudah diuji.*
1. Buat file baru (atau gunakan yang ada) untuk menampung fungsi utilitas.
2. Buat fungsi `validateAndExtractNIP(nip: string)`:
   - Validasi panjang (18 digit angka).
   - Ekstrak Tanggal Lahir (digit 1-8). Validasi bulan (01-12), tanggal (01-31), tahun masuk akal.
   - Ekstrak TMT CPNS (digit 9-14). Validasi bulan (01-12) dan tahun masuk akal.
   - Ekstrak Jenis Kelamin (digit 15 = 1/2).
3. Buat fungsi `calculateBUP(tglLahir: string, jabatan: string)`:
   - Menghitung TMT Pensiun berdasarkan aturan umur (58/60/65).
4. Buat fungsi `calculateMasaKerja(tmtDate: string)`:
   - Menggunakan `date-fns` untuk menghitung selisih tahun dan bulan dari TMT hingga hari ini.

### Tahap 2: Integrasi Logika Pintar ke `EmployeeForm.tsx`
*Memasukkan kecerdasan otomatis (auto-fill) ke dalam form yang ada.*
1. Perbarui `useEffect` untuk `nip`: Gunakan fungsi `validateAndExtractNIP` yang lebih aman.
2. Tambahkan `useEffect` untuk memantau `tanggalLahir` & `jabatan`: Otomatis isi field `pensiun` (TMT Pensiun).
3. Tambahkan `useEffect` untuk memantau `tmtKerja`: Otomatis isi field `masaKerja` dengan output dari fungsi `calculateMasaKerja`.
4. (Opsional) Tambahkan auto-hitung untuk `masaKerjaGolonganRuang` jika `tmtGolonganRuang` diisi.

### Tahap 3: Perombakan UI Formulir (Sistem Tab)
*Meningkatkan UX dengan memecah form panjang menjadi 4 bagian.*
1. Tambahkan state `const [activeTab, setActiveTab] = useState(1);` di `EmployeeForm.tsx`.
2. Buat komponen navigasi Tab (Header Tab) bergaya *flat* dan modern sesuai panduan tema (tanpa bayangan berlebih, garis bawah bersih untuk tab aktif).
3. Kelompokkan input JSX yang ada ke dalam 4 blok kondisi (hanya me-render bagian dari tab yang sedang aktif):
   - **Tab 1:** Identitas Pribadi.
   - **Tab 2:** Jabatan & Penempatan.
   - **Tab 3:** Kepangkatan & Gaji.
   - **Tab 4:** Keluarga & Cuti.
4. Tambahkan tombol **Kembali** dan **Selanjutnya** di bagian bawah untuk navigasi tab, dengan tombol **Simpan** berada di Tab terakhir (atau selalu tampil).

### Tahap 4: Penambahan Indikator KP & KGB (`Employees.tsx`)
*Memberikan peringatan visual untuk Kenaikan Pangkat dan Gaji Berkala.*
1. Buat fungsi helper kecil untuk mengecek selisih waktu `tmtGolonganRuang` (Target 4 tahun) dan `tanggalBerkalaTerakhir` (Target 2 tahun).
2. Di komponen Tabel `Employees.tsx`, tambahkan logic pemantauan.
3. Tambahkan *Badge* Peringatan (misal warna kuning/merah) di dekat nama atau kolom khusus pada tabel, jika waktunya sudah mendekati (misal H-90 hari) atau sudah terlewat.
