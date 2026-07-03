const fs = require('fs');

let content = fs.readFileSync('src/pages/Employees.tsx', 'utf8');

const regex = /const exampleData = \[\s*\[[\s\S]*?\]\s*\];/;

const newExampleData = `const exampleData = [
      [
        "Regar Jeane Dealen Nangka, S.STP., M.Si.", // Nama
        "198301112001121002", // N I P
        "3509191101830005", // N I K
        "L", // JK
        "Bondowoso", // Tempat Lahir
        "1983-01-11", // Tanggal Lahir (ISO format for easier import)
        "43", // Usia
        "Perum Muktisari Blok BF No. 6", // Jalan
        "004", // RT
        "003", // RW
        "Tegal Besar", // Desa/Kelurahan
        "Kaliwates", // Kecamatan
        "Jember", // Kabupaten
        "10", // kelas jabatan
        "Tinggi", // beban kerja
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

if (!regex.test(content)) {
  console.log('REGEX FAILED for exampleData');
} else {
  content = content.replace(regex, newExampleData);
  fs.writeFileSync('src/pages/Employees.tsx', content);
  console.log('exampleData updated');
}
