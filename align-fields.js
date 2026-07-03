const fs = require('fs');

const internalFields = [
  "nik", "nama", "nip", "jk", "tempatLahir", "tanggalLahir", "jalanDusun", "rt", "rw", "desaKelurahan", 
  "kecamatan", "kabupaten", "kelasJabatan", "bebanKerja", "tmtKerja", "masaKerja", "pensiun", 
  "tmtGolonganRuang", "masaKerjaGolonganRuang", "noRekeningBank", "npwp", "pangkat", "gol", 
  "pangkatGolongan", "tanggalBerkalaTerakhir", "gajiPokok", "besaranGajiKotor", "digajiMenurut", 
  "jabatan", "bidang", "status", "nomorKarpeg", "pendidikan", "jurusan", "diklatJenjang", "tahunDiklat", 
  "statusKawin", "agama", "nomorHp", "sisaCutiN", "sisaCutiN1", "sisaCutiN2", "skTerakhir", "jumlahTertanggung"
];

// we want to list all of them
console.log(internalFields.join(", "));
