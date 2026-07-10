import { describe, it, expect } from "vitest";
import {
  normalizeEmployeeForImport,
  parseEmployeeImportGrid,
  buildImportTemplateAoa,
  parseStatus,
  excelDateToIso,
} from "./employeeImport";
import { EmployeeSchema } from "./schemas";

describe("excelDateToIso", () => {
  it("parses DD/MM/YYYY", () => {
    expect(excelDateToIso("11/01/1983")).toBe("1983-01-11");
  });
  it("keeps ISO", () => {
    expect(excelDateToIso("1983-01-11")).toBe("1983-01-11");
  });
});

describe("parseStatus", () => {
  it("maps variants", () => {
    expect(parseStatus("pppk pw")).toBe("PPPKPW");
    expect(parseStatus("CPNS")).toBe("CPNS");
    expect(parseStatus("Honorer")).toBe("Honorer");
  });
});

describe("normalizeEmployeeForImport", () => {
  it("extracts fields from 18-digit NIP for PNS", () => {
    // NIP layout: YYYYMMDD (lahir) + YYYYMM (tmt) + J + NNN
    // 19830111 200112 1 002
    const nip = "198301112001121002";
    const row = normalizeEmployeeForImport({
      nama: "Budi",
      nip,
      status: "PNS",
    });
    expect(row.tanggalLahir).toBe("1983-01-11");
    expect(row.tmtKerja).toBe("2001-12-01");
    expect(row.jk).toBe("L");
    expect(EmployeeSchema.safeParse(row).success).toBe(true);
  });

  it("ignores missing derived fields and fills defaults", () => {
    const row = normalizeEmployeeForImport({
      nama: "Siti",
      nik: "3201010101010001",
      status: "PPPK",
    });
    expect(row.jk).toBe("L");
    expect(row.dataKeluarga).toEqual([]);
    expect(row.jumlahTertanggung).toBe(0);
    expect(EmployeeSchema.safeParse(row).success).toBe(true);
  });

  it("builds family from flat spouse/child columns", () => {
    const row = normalizeEmployeeForImport({
      nama: "Andi",
      nip: "198001012010011001",
      status: "PNS",
      jk: "L",
      spouseName: "Sari",
      spouseBirth: "1985-02-02",
      childName1: "Rina",
      childBirth1: "2010-01-01",
    });
    const fam = row.dataKeluarga as { name: string; relation: string }[];
    expect(fam).toHaveLength(2);
    expect(fam[0]!.relation).toBe("Istri");
    expect(fam[1]!.relation).toBe("Anak");
    expect(row.jumlahTertanggung).toBe(2);
  });

  it("computes masaKerjaGolonganRuang from tmt when empty", () => {
    const row = normalizeEmployeeForImport({
      nama: "X",
      tmtGolonganRuang: "2020-01-01",
    });
    expect(String(row.masaKerjaGolonganRuang)).toMatch(/Tahun/);
  });
});

describe("parseEmployeeImportGrid", () => {
  it("parses template-like grid and skips derived columns", () => {
    const template = buildImportTemplateAoa();
    // Inject a legacy derived column
    const headers = [...(template[0] as string[]), "Usia", "Masa Kerja"];
    const sample = [...(template[1] as (string | number)[]), "40", "20 Tahun"];
    const { payload, skipped } = parseEmployeeImportGrid([headers, sample]);
    expect(payload.length).toBe(1);
    expect(payload[0]!.nama).toBeTruthy();
    expect(EmployeeSchema.safeParse(payload[0]).success).toBe(true);
    expect(skipped).toBe(0);
  });

  it("returns empty payload for blank sheet", () => {
    const { payload } = parseEmployeeImportGrid([["Foo", "Bar"], ["", ""]]);
    expect(payload.length).toBe(0);
  });
});
