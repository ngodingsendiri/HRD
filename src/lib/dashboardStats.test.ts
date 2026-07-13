import { describe, it, expect } from "vitest";
import {
  buildKgbList,
  buildPensiunList,
  normalizeBidangLabel,
} from "./dashboardStats";

describe("normalizeBidangLabel", () => {
  it("maps known unit keywords", () => {
    expect(normalizeBidangLabel("Bagian Sekretariat")).toBe("Sekretariat");
    expect(normalizeBidangLabel("Bidang Smart City")).toBe("Smartcity");
  });
});

describe("buildPensiunList", () => {
  it("uses BUP 60 for madya (not hard-coded 58)", () => {
    const list = buildPensiunList([
      {
        id: "1",
        nik: "",
        nama: "A",
        nip: "1",
        status: "PNS",
        gol: "IV/a",
        pangkatGolongan: "IV/a",
        tanggalLahir: "1968-03-15",
        jabatan: "JF Ahli Madya",
      },
    ]);
    expect(list).toHaveLength(1);
    // calculateBUP madya → 2028-04-01
    expect(list[0]!.nextDate).toBe("2028-04-01");
  });

  it("uses BUP 58 for ordinary jabatan", () => {
    const list = buildPensiunList([
      {
        id: "2",
        nik: "",
        nama: "B",
        nip: "2",
        status: "PNS",
        gol: "III/a",
        pangkatGolongan: "III/a",
        tanggalLahir: "1968-03-15",
        jabatan: "Pengelola Umum",
      },
    ]);
    expect(list[0]!.nextDate).toBe("2026-04-01");
  });
});

describe("buildKgbList", () => {
  it("falls back to tmtKerja when berkala empty", () => {
    const list = buildKgbList([
      {
        id: "1",
        nik: "",
        nama: "C",
        nip: "3",
        status: "PNS",
        gol: "III/a",
        pangkatGolongan: "III/a",
        tanggalBerkalaTerakhir: "",
        tmtKerja: "2020-01-01",
        tmtGolonganRuang: "2019-01-01",
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]!.isFirst).toBe(true);
    expect(list[0]!.nextDate).toBe("2022-01-01");
  });
});
