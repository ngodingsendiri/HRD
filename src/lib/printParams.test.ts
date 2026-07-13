import { describe, expect, it } from "vitest";
import {
  isCutiTahunanJenis,
  parseDocParam,
  resolveBidangLabel,
} from "./printParams";

describe("parseDocParam", () => {
  it("maps absensi aliases", () => {
    expect(parseDocParam("absen")).toBe("absen_global");
    expect(parseDocParam("absensi")).toBe("absen_global");
    expect(parseDocParam("absen-global")).toBe("absen_global");
    expect(parseDocParam("absen_bidang")).toBe("absen_bidang");
  });

  it("maps layanan docs", () => {
    expect(parseDocParam("cuti")).toBe("surat_cuti");
    expect(parseDocParam("surat_cuti")).toBe("surat_cuti");
    expect(parseDocParam("model-dk")).toBe("model_dk");
    expect(parseDocParam("dk")).toBe("model_dk");
    expect(parseDocParam("duk")).toBe("duk");
    expect(parseDocParam("tanda_terima")).toBe("tanda_terima");
  });

  it("rejects unknown", () => {
    expect(parseDocParam(null)).toBeNull();
    expect(parseDocParam("")).toBeNull();
    expect(parseDocParam("xyz")).toBeNull();
  });
});

describe("isCutiTahunanJenis", () => {
  it("matches only leading 1. cuti tahunan", () => {
    expect(isCutiTahunanJenis("1. Cuti Tahunan")).toBe(true);
    expect(isCutiTahunanJenis("1 Cuti Tahunan")).toBe(true);
    expect(isCutiTahunanJenis("10. something")).toBe(false);
    expect(isCutiTahunanJenis("11. foo")).toBe(false);
    expect(isCutiTahunanJenis("2. Cuti Besar")).toBe(false);
  });
});

describe("resolveBidangLabel", () => {
  const opts = ["Sekretariat", "Infrastruktur", "Tidak Ada Bidang"];

  it("matches case-insensitively and returns canonical", () => {
    expect(resolveBidangLabel("sekretariat", opts)).toBe("Sekretariat");
    expect(resolveBidangLabel("INFRASTRUKTUR", opts)).toBe("Infrastruktur");
  });

  it("returns null for Semua / empty / unknown", () => {
    expect(resolveBidangLabel("Semua", opts)).toBeNull();
    expect(resolveBidangLabel("", opts)).toBeNull();
    expect(resolveBidangLabel("XYZ", opts)).toBeNull();
  });
});
