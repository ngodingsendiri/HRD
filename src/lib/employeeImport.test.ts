import { describe, it, expect } from "vitest";
import {
  normalizeEmployeeForImport,
  parseEmployeeImportGrid,
  buildImportTemplateAoa,
  parseStatus,
  resolveStatus,
  resolveJk,
  excelDateToIso,
  mergeEmployeePatch,
  mergeFamilyPatch,
  kamusWarningForJabatan,
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

describe("resolveStatus", () => {
  it("maps variants", () => {
    expect(resolveStatus("pppk pw")).toEqual({
      kind: "ok",
      status: "PPPKPW",
    });
    expect(resolveStatus("CPNS")).toEqual({ kind: "ok", status: "CPNS" });
    expect(resolveStatus("Honorer")).toEqual({
      kind: "ok",
      status: "Honorer",
    });
    expect(resolveStatus("PNS")).toEqual({ kind: "ok", status: "PNS" });
  });
  it("rejects garbage and near-miss PNS", () => {
    expect(resolveStatus("PEGAWAI TETAP").kind).toBe("invalid");
    expect(resolveStatus("PNSTEST").kind).toBe("invalid");
  });
  it("empty is empty", () => {
    expect(resolveStatus("").kind).toBe("empty");
  });
});

describe("parseStatus legacy", () => {
  it("still maps known", () => {
    expect(parseStatus("PPPK")).toBe("PPPK");
  });
});

describe("resolveJk", () => {
  it("accepts L/P", () => {
    expect(resolveJk("L")).toEqual({ kind: "ok", jk: "L" });
    expect(resolveJk("Perempuan")).toEqual({ kind: "ok", jk: "P" });
  });
  it("rejects garbage", () => {
    expect(resolveJk("X").kind).toBe("invalid");
  });
});

describe("normalizeGolongan / format", () => {
  it("normalizes separators", async () => {
    const { normalizeGolongan, formatGolonganDisplay } = await import(
      "./employeeUtils"
    );
    expect(normalizeGolongan("III.A")).toBe("III/A");
    expect(normalizeGolongan("ii-b")).toBe("II/B");
    expect(formatGolonganDisplay("III.A")).toBe("III/a");
  });
});

describe("normalizeEmployeeForImport", () => {
  it("extracts fields from 18-digit NIP for PNS (full/create)", () => {
    const nip = "198301112001121002";
    const row = normalizeEmployeeForImport(
      { nama: "Budi", nip, status: "PNS" },
      { full: true },
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.data.tanggalLahir).toBe("1983-01-11");
    expect(row.data.tmtKerja).toBe("2001-12-01");
    expect(row.data.jk).toBe("L");
    expect(EmployeeSchema.safeParse(row.data).success).toBe(true);
  });

  it("rejects unknown status", () => {
    const row = normalizeEmployeeForImport(
      { nama: "Siti", nik: "3201010101010001", status: "KONTRAK" },
      { full: true },
    );
    expect(row.ok).toBe(false);
    if (row.ok) return;
    expect(row.error).toMatch(/Status tidak dikenali/);
  });

  it("rejects unknown JK", () => {
    const row = normalizeEmployeeForImport(
      { nama: "Siti", nik: "3201010101010001", status: "PPPK", jk: "X" },
      { full: true },
    );
    expect(row.ok).toBe(false);
  });

  it("requires JK when NIP cannot fill (full)", () => {
    const row = normalizeEmployeeForImport(
      { nama: "Siti", nik: "3201010101010001", status: "PPPK" },
      { full: true },
    );
    expect(row.ok).toBe(false);
    if (row.ok) return;
    expect(row.error).toMatch(/JK wajib/);
  });

  it("builds family from flat spouse/child columns", () => {
    const row = normalizeEmployeeForImport(
      {
        nama: "Andi",
        nip: "198001012010011001",
        status: "PNS",
        jk: "L",
        spouseName: "Sari",
        spouseBirth: "1985-02-02",
        childName1: "Rina",
        childBirth1: "2010-01-01",
      },
      { full: true },
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    const fam = row.data.dataKeluarga as { name: string; relation: string }[];
    expect(fam).toHaveLength(2);
    expect(fam[0]!.relation).toBe("Istri");
    expect(fam[1]!.relation).toBe("Anak");
    expect(row.data.jumlahTertanggung).toBe(2);
  });

  it("computes masaKerjaGolonganRuang from tmt when empty", () => {
    const row = normalizeEmployeeForImport(
      {
        nama: "X",
        nip: "198001012010011001",
        status: "PNS",
        jk: "L",
        tmtGolonganRuang: "2020-01-01",
      },
      { full: true },
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(String(row.data.masaKerjaGolonganRuang)).toMatch(/Tahun/);
  });

  it("patch mode only includes present keys", () => {
    const row = normalizeEmployeeForImport(
      { nip: "198001012010011001", sisaCutiN: "10" },
      { mode: "patch", full: false },
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.data.sisaCutiN).toBe("10");
    expect(row.data.nip).toBe("198001012010011001");
    expect(row.data.jalanDusun).toBeUndefined();
    expect(row.presentKeys).toContain("sisaCutiN");
  });

  it("patch with NIP only does NOT inject tgl lahir/TMT/JK from NIP", () => {
    // 18-digit NIP would fill those fields in full mode — must not in patch
    const nip = "198301112001121002";
    const row = normalizeEmployeeForImport(
      { nip, sisaCutiN: "5" },
      { mode: "patch", full: false },
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.data.tanggalLahir).toBeUndefined();
    expect(row.data.tmtKerja).toBeUndefined();
    expect(row.data.jk).toBeUndefined();
    expect(row.data.sisaCutiN).toBe("5");
  });

  it("patch gol only does not set pangkatGolongan (preserve on merge)", () => {
    const row = normalizeEmployeeForImport(
      { nip: "198001012010011001", gol: "III.A" },
      { mode: "patch", full: false },
    );
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.data.gol).toBe("III/a");
    expect(row.data.pangkatGolongan).toBeUndefined();
  });
});

describe("mergeFamilyPatch", () => {
  it("updating spouse keeps children", () => {
    const existing = [
      {
        name: "Sari",
        relation: "Istri" as const,
        birthDate: "1985-01-01",
      },
      { name: "Rina", relation: "Anak" as const, birthDate: "2010-01-01" },
      { name: "Doni", relation: "Anak" as const, birthDate: "2012-01-01" },
    ];
    const merged = mergeFamilyPatch(
      existing,
      { spouseName: "Sari Baru", spouseBirth: "1986-02-02" },
      "L",
    );
    expect(merged).toHaveLength(3);
    expect(merged[0]!.name).toBe("Sari Baru");
    expect(merged[0]!.birthDate).toBe("1986-02-02");
    expect(merged[1]!.name).toBe("Rina");
    expect(merged[2]!.name).toBe("Doni");
  });

  it("updating child 1 keeps spouse and child 2", () => {
    const existing = [
      { name: "Sari", relation: "Istri" as const },
      { name: "Rina", relation: "Anak" as const },
      { name: "Doni", relation: "Anak" as const },
    ];
    const merged = mergeFamilyPatch(
      existing,
      { childName1: "Rina Update" },
      "L",
    );
    expect(merged.map((m) => m.name)).toEqual([
      "Sari",
      "Rina Update",
      "Doni",
    ]);
  });

  it("patch spouse birth only keeps name and children", () => {
    const existing = [
      {
        name: "Sari",
        relation: "Istri" as const,
        birthDate: "1985-01-01",
      },
      { name: "Rina", relation: "Anak" as const },
    ];
    const merged = mergeFamilyPatch(
      existing,
      { spouseBirth: "1986-06-06" },
      "L",
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]!.name).toBe("Sari");
    expect(merged[0]!.birthDate).toBe("1986-06-06");
    expect(merged[1]!.name).toBe("Rina");
  });
});

describe("mergeEmployeePatch", () => {
  it("keeps existing fields when patch omits them", () => {
    const merged = mergeEmployeePatch(
      {
        nama: "Budi",
        nip: "198001012010011001",
        nik: "",
        jk: "L",
        status: "PNS",
        jalanDusun: "Jl. Lama",
        sisaCutiN: "12",
        dataKeluarga: [],
        jumlahTertanggung: 0,
      },
      { sisaCutiN: "5" },
    );
    expect(merged.jalanDusun).toBe("Jl. Lama");
    expect(merged.sisaCutiN).toBe("5");
    expect(merged.nama).toBe("Budi");
  });
});

describe("parseEmployeeImportGrid", () => {
  it("parses template-like grid and skips derived columns", () => {
    const template = buildImportTemplateAoa();
    const headers = [...(template[0] as string[]), "Usia", "Masa Kerja"];
    const sample = [...(template[1] as (string | number)[]), "40", "20 Tahun"];
    const { payload, skipped } = parseEmployeeImportGrid([headers, sample]);
    expect(payload.length).toBe(1);
    expect(payload[0]!.nama).toBeTruthy();
    // Sparse raw — not yet fully normalized
    expect(payload[0]!.usia).toBeUndefined();
    expect(skipped).toBe(0);
    const norm = normalizeEmployeeForImport(payload[0]!, { full: true });
    expect(norm.ok).toBe(true);
    if (norm.ok) {
      expect(EmployeeSchema.safeParse(norm.data).success).toBe(true);
    }
  });

  it("core template has fewer columns than full", () => {
    const core = buildImportTemplateAoa("core");
    const full = buildImportTemplateAoa("full");
    expect(core[0]!.length).toBeLessThan(full[0]!.length);
    expect(core[0]).toContain("Nama");
    expect(core[0]).toContain("BUP Manual");
    expect(core[0]).not.toContain("Nama Istri/Suami");
  });

  it("returns empty payload for blank sheet", () => {
    const { payload } = parseEmployeeImportGrid([["Foo", "Bar"], ["", ""]]);
    expect(payload.length).toBe(0);
  });
});

describe("kamusWarningForJabatan", () => {
  it("warns when jabatan not in provided kamus", () => {
    const csv = "id;Analis Kebijakan;9;tinggi\n";
    const w = kamusWarningForJabatan("Jabatan Tidak Ada Sama Sekali XYZ", csv);
    expect(w).toMatch(/tidak ada di kamus/i);
  });
  it("silent when jabatan matches kamus", () => {
    const csv = "x;Analis Kebijakan;9;tinggi\n";
    expect(kamusWarningForJabatan("Analis Kebijakan", csv)).toBeNull();
  });
});

describe("patch merge + schema", () => {
  it("merged patch validates as full employee", () => {
    const existing = {
      nama: "Budi",
      nip: "198001012010011001",
      nik: "3501010101800001",
      jk: "L" as const,
      status: "PNS" as const,
      tempatLahir: "Jember",
      tanggalLahir: "1980-01-01",
      jalanDusun: "Jl. A",
      rt: "",
      rw: "",
      desaKelurahan: "",
      kecamatan: "",
      kabupaten: "",
      jabatan: "Analis",
      bidang: "Sekretariat",
      tmtKerja: "2010-01-01",
      pangkat: "",
      gol: "III/a",
      pangkatGolongan: " / III/a",
      tmtGolonganRuang: "2020-01-01",
      masaKerjaGolonganRuang: "",
      tanggalBerkalaTerakhir: "",
      bupTanggal: "",
      tmtKp: "",
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
      sisaCutiN: "12",
      sisaCutiN1: "0",
      sisaCutiN2: "0",
      skTerakhir: "",
      jumlahTertanggung: 0,
      dataKeluarga: [],
    };
    const patch = normalizeEmployeeForImport(
      { nip: "198001012010011001", sisaCutiN: "8" },
      { mode: "patch", full: false },
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    const merged = mergeEmployeePatch(existing, patch.data);
    expect(EmployeeSchema.safeParse(merged).success).toBe(true);
    expect(merged.sisaCutiN).toBe("8");
    expect(merged.jalanDusun).toBe("Jl. A");
  });
});
