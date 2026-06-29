export interface FamilyMember {
  name: string;
  relation: "Istri" | "Suami" | "Anak";
  birthDate?: string;
  marriageDate?: string;
  occupation?: string;
  description?: string;
}

export interface Employee {
  id?: string;
  nik: string;
  nama: string;
  nip: string;
  jk: "L" | "P";
  tempatLahir: string;
  tanggalLahir: string;
  jalanDusun: string;
  rt: string;
  rw: string;
  desaKelurahan: string;
  kecamatan: string;
  kabupaten: string;
  kelasJabatan: string;
  bebanKerja: string;
  tmtKerja: string;
  masaKerja: string;
  pensiun: string;
  tmtGolonganRuang: string;
  masaKerjaGolonganRuang: string;
  noRekeningBank: string;
  npwp: string;
  pangkat: string;
  gol: string;
  pangkatGolongan: string;
  tanggalBerkalaTerakhir: string;
  gajiPokok: string;
  besaranGajiKotor: string;
  digajiMenurut: string;
  jabatan: string;
  bidang: string;
  status: "PNS" | "CPNS" | "PPPK" | "PPPKPW";
  nomorKarpeg: string;
  pendidikan: string;
  jurusan: string;
  diklatJenjang: string;
  tahunDiklat: string;
  statusKawin: string;
  agama: string;
  nomorHp: string;
  sisaCutiN: string;
  sisaCutiN1: string;
  sisaCutiN2: string;
  skTerakhir: string;
  jumlahTertanggung: number;
  dataKeluarga: FamilyMember[];
  createdAt?: number;
  updatedAt?: number;
}

export interface AppSettings {
  sekdaNama: string;
  sekdaNip: string;
  bupatiNama: string;
  kopLine1?: string;
  kopLine2?: string;
  kopLine3?: string;
  kopLine4?: string;
  logoBase64?: string;
  jabatanKamusCsv?: string;
}
