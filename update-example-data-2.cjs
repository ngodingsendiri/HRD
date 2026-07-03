const fs = require('fs');

let content = fs.readFileSync('src/pages/Employees.tsx', 'utf8');

const oldStr = `    const exampleData = [
      [
        "Regar Jeane Dealen Nangka, S.STP., M.Si.",
        "198301112001121002",
        "3509191101830005",
        "L",
        "Bondowoso",
        "11 Januari 1983",
        "Perum Muktisari Blok BF No. 6",
        "004",
        "003",
        "Tegal Besar",
        "Kaliwates",
        "Jember",
        "10",
        "Tinggi",
        "02 Januari 2026",
        "24 Tahun 4 Bulan",
        "2041-01-11",
        "01/10/2025",
        "Pembina Tk. I",
        "IV.b",
        "01/10/2025",
        "4.672.800",
        "7.236.979",
        "Kepala Dinas",
        "Sekretariat",
        "PNS",
        "L.066441",
        "S2",
        "Ilmu Pemerintahan",
        "PIM II",
        "2020",
        "Kawin",
        "Islam",
        "081252748226",
        "12",
        "0",
        "0",
        "Bupati Jember",
        "-",
        "Sekda Jember",
        "-",
        "SK Bupati No. 123",
        "Nama Pasangan",
        "1985-01-01",
        "2010-01-01",
        "Wiraswasta",
        "Aktif",
        "Anak Pertama",
        "2012-05-10",
        "-",
        "Sekolah",
        "Tertanggung",
        "Anak Kedua",
        "2017-08-20",
        "-",
        "Belum Sekolah",
        "Tertanggung",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "2",
      ],
    ];`;

const newExampleData = `    const exampleData = [
      [
        "Regar Jeane Dealen Nangka, S.STP., M.Si.",
        "198301112001121002",
        "3509191101830005",
        "L",
        "Bondowoso",
        "1983-01-11", // Tanggal Lahir
        "43", // Usia
        "Perum Muktisari Blok BF No. 6",
        "004",
        "003",
        "Tegal Besar",
        "Kaliwates",
        "Jember",
        "10",
        "Tinggi",
        "2002-01-01", // TMT Kerja
        "24", // Masa Kerja
        "2041-01-11", // Pensiun (BUP)
        "2021-10-01", // TMT Golongan Ruang
        "20", // Masa Kerja Golongan Ruang
        "2025-10-01", // Prediksi Kenaikan Pangkat (KP)
        "1234567890", // No. Rekening Bank
        "12.345.678.9-012.000", // NPWP
        "Pembina Tk. I", // Pangkat
        "IV.b", // Gol
        "2023-10-01", // Tanggal Berkala Terakhir
        "2025-10-01", // Prediksi Kenaikan Gaji Berkala (KGB)
        "4.672.800", // Gaji Pokok
        "7.236.979", // Besaran Gaji Kotor
        "Kepala Dinas", // Digaji Menurut PP/SK
        "Kepala Dinas Pendidikan", // Jabatan
        "Sekretariat", // Bidang
        "PNS", // Status
        "L.066441", // Nomor Karpeg
        "S2", // Pendidikan
        "Ilmu Pemerintahan", // Jurusan
        "PIM II", // Diklat Jenjang
        "2020", // Tahun Diklat
        "Kawin", // Status Kawin
        "Islam", // Agama
        "081252748226", // Nomor HP
        "12", // Sisa Cuti N
        "0", // Sisa Cuti N-1
        "0", // Sisa Cuti N-2
        "SK Bupati No. 123", // SK Terakhir
        "Nama Pasangan", // Pasangan
        "1985-01-01",
        "2010-01-01",
        "Wiraswasta",
        "Aktif",
        "Anak Pertama", // Anak 1
        "2012-05-10",
        "",
        "Pelajar",
        "Tanggungan",
        "", "", "", "", "", // Anak 2
        "", "", "", "", "", // Anak 3
        "", "", "", "", "", // Anak 4
        "", "", "", "", "", // Anak 5
        "2", // Jumlah Tertanggung
      ],
    ];`;

if (!content.includes(oldStr)) {
  console.log("old string not found");
} else {
  content = content.replace(oldStr, newExampleData);
  fs.writeFileSync('src/pages/Employees.tsx', content);
  console.log("exampleData updated");
}

