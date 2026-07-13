import { describe, it, expect } from "vitest";
import {
  calculateBUP,
  checkKGBandKP,
  getBupYears,
  resolveKgbCycle,
  validateAndExtractNIP,
} from "./employeeUtils";

describe("getBupYears / calculateBUP", () => {
  it("defaults to 58", () => {
    expect(getBupYears("Staf Administrasi")).toBe(58);
  });

  it("uses 60 for madya / kepala dinas", () => {
    expect(getBupYears("JF Perencana Ahli Madya")).toBe(60);
    expect(getBupYears("Kepala Dinas Kominfo")).toBe(60);
  });

  it("uses 65 for utama", () => {
    expect(getBupYears("Ahli Utama")).toBe(65);
  });

  it("returns TMT pensiun as start of month after BUP birthday", () => {
    // birth 1968-03-15 → BUP 58 → 2026-03-15 → TMT 2026-04-01
    expect(calculateBUP("1968-03-15", "Staf")).toBe("2026-04-01");
  });

  it("madya BUP 60 shifts target later", () => {
    // birth 1968-03-15 → BUP 60 → 2028-03-15 → TMT 2028-04-01
    expect(calculateBUP("1968-03-15", "Ahli Madya")).toBe("2028-04-01");
  });

  it("returns null for empty birth", () => {
    expect(calculateBUP("", "Staf")).toBeNull();
  });

  it("prefers manual BUP override", () => {
    expect(calculateBUP("1968-03-15", "Staf", "2030-06-01")).toBe("2030-06-01");
  });
});

describe("formatGolonganDisplay", () => {
  it("normalizes separators and letter case", async () => {
    const { formatGolonganDisplay } = await import("./employeeUtils");
    expect(formatGolonganDisplay("III.A")).toBe("III/a");
    expect(formatGolonganDisplay("ii-b")).toBe("II/b");
  });
});

describe("checkKGBandKP tmtKp override", () => {
  it("uses tmtKp as KP base when set", () => {
    const r = checkKGBandKP("2010-01-01", "2024-01-01", {
      tmtKp: "2022-01-01",
    });
    expect(r.kp.targetDate).toBe("2026-01-01");
  });
});

describe("resolveKgbCycle", () => {
  it("uses berkala + 2 years when present", () => {
    const r = resolveKgbCycle({
      tanggalBerkalaTerakhir: "2024-01-01",
      tmtKerja: "2010-01-01",
    });
    expect(r.baseDate).toBe("2024-01-01");
    expect(r.cycleYears).toBe(2);
    expect(r.isFirst).toBe(false);
  });

  it("falls back to tmtKerja for first cycle", () => {
    const r = resolveKgbCycle({
      tmtKerja: "2023-06-01",
      status: "PNS",
      gol: "III/a",
    });
    expect(r.baseDate).toBe("2023-06-01");
    expect(r.cycleYears).toBe(2);
    expect(r.isFirst).toBe(true);
  });

  it("first cycle PNS II/A uses 1 year", () => {
    const r = resolveKgbCycle({
      tmtKerja: "2023-06-01",
      status: "PNS",
      gol: "II/A",
    });
    expect(r.cycleYears).toBe(1);
  });

  it("does not treat III/A as II/A (substring trap)", () => {
    const r = resolveKgbCycle({
      tmtKerja: "2023-06-01",
      status: "PNS",
      gol: "III/a",
    });
    expect(r.cycleYears).toBe(2);
  });
});

describe("checkKGBandKP", () => {
  it("flags overdue KP when tmt golongan old", () => {
    const r = checkKGBandKP("2010-01-01", "2024-01-01");
    expect(r.warningKP).toBe(true);
    expect(r.kp.overdue).toBe(true);
  });

  it("uses tmtKerja for KGB when berkala empty", () => {
    const r = checkKGBandKP("2015-01-01", "", {
      tmtKerja: "2010-01-01",
      status: "PNS",
      gol: "III/c",
    });
    expect(r.kgb.targetDate).toBeTruthy();
    // 2010 + 2y = 2012 → overdue
    expect(r.warningKGB).toBe(true);
  });

  it("clear when dates far in future", () => {
    const future = `${new Date().getFullYear() + 1}-01-01`;
    const r = checkKGBandKP(future, future);
    expect(r.clear).toBe(true);
  });
});

describe("validateAndExtractNIP", () => {
  it("extracts birth, TMT, JK from 18-digit NIP for PNS", () => {
    // YYYYMMDD YYYYMM J NNN — 19800101 201001 1 001
    const r = validateAndExtractNIP("198001012010011001", "PNS");
    expect(r.tanggalLahir).toBe("1980-01-01");
    expect(r.tmtKerja).toBe("2010-01-01");
    expect(r.jk).toBe("L");
  });

  it("ignores non-18 NIP", () => {
    const r = validateAndExtractNIP("12345", "PNS");
    expect(r.tanggalLahir).toBeNull();
  });
});
