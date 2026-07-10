import { describe, it, expect } from "vitest";
import {
  EmployeeSchema,
  AppSettingsSchema,
  isValidNik,
  isValidNip,
} from "./schemas";

describe("isValidNik", () => {
  it("allows empty", () => {
    expect(isValidNik("")).toBe(true);
  });
  it("accepts 16 digits", () => {
    expect(isValidNik("3201010101010001")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidNik("123")).toBe(false);
    expect(isValidNik("32010101010100012")).toBe(false);
  });
});

describe("isValidNip", () => {
  it("allows empty", () => {
    expect(isValidNip("")).toBe(true);
  });
  it("accepts classic 18-digit NIP with spaces", () => {
    expect(isValidNip("19800101 201001 1 001")).toBe(true);
  });
  it("rejects too short", () => {
    expect(isValidNip("1234567")).toBe(false);
  });
});

describe("EmployeeSchema", () => {
  const base = {
    nik: "3201010101010001",
    nama: "Budi Santoso",
    nip: "198001012010011001",
    jk: "L" as const,
    tempatLahir: "Jakarta",
    tanggalLahir: "1980-01-01",
    jalanDusun: "",
    rt: "",
    rw: "",
    desaKelurahan: "",
    kecamatan: "",
    kabupaten: "",
    jabatan: "Analis",
    bidang: "Sekretariat",
    status: "PNS" as const,
    tmtKerja: "2010-01-01",
    pangkat: "",
    gol: "",
    pangkatGolongan: "",
    tmtGolonganRuang: "",
    masaKerjaGolonganRuang: "",
    tanggalBerkalaTerakhir: "",
    gajiPokok: "",
    besaranGajiKotor: "",
    digajiMenurut: "",
    noRekeningBank: "",
    npwp: "",
    nomorKarpeg: "",
    pendidikan: "",
    jurusan: "",
    diklatJenjang: "",
    tahunDiklat: "",
    statusKawin: "",
    agama: "",
    nomorHp: "",
    sisaCutiN: "",
    sisaCutiN1: "",
    sisaCutiN2: "",
    skTerakhir: "",
    jumlahTertanggung: 0,
    dataKeluarga: [],
  };

  it("accepts a valid employee", () => {
    const r = EmployeeSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nama).toBe("Budi Santoso");
  });

  it("rejects empty nama", () => {
    const r = EmployeeSchema.safeParse({ ...base, nama: "   " });
    expect(r.success).toBe(false);
  });

  it("rejects invalid NIK", () => {
    const r = EmployeeSchema.safeParse({ ...base, nik: "12345" });
    expect(r.success).toBe(false);
  });

  it("allows empty nip/nik", () => {
    const r = EmployeeSchema.safeParse({ ...base, nip: "", nik: "" });
    expect(r.success).toBe(true);
  });

  it("trims nama", () => {
    const r = EmployeeSchema.safeParse({ ...base, nama: "  Budi  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.nama).toBe("Budi");
  });
});

describe("AppSettingsSchema", () => {
  it("accepts empty settings", () => {
    const r = AppSettingsSchema.safeParse({
      sekdaNama: "",
      sekdaNip: "",
      bupatiNama: "",
    });
    expect(r.success).toBe(true);
  });

  it("rejects oversized logoBase64", () => {
    const r = AppSettingsSchema.safeParse({
      sekdaNama: "",
      sekdaNip: "",
      bupatiNama: "",
      logoBase64: "x".repeat(1_500_001),
    });
    expect(r.success).toBe(false);
  });
});
