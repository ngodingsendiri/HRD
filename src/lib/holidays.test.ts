import { describe, expect, it } from "vitest";
import { countWorkingDays } from "./holidays";

describe("countWorkingDays", () => {
  it("returns 0 when start > end", () => {
    expect(countWorkingDays("2026-07-10", "2026-07-01")).toBe(0);
  });

  it("returns 0 for invalid dates", () => {
    expect(countWorkingDays("bukan-tanggal", "2026-07-01")).toBe(0);
  });

  it("counts a single weekday", () => {
    // 2026-07-13 is a Monday
    expect(countWorkingDays("2026-07-13", "2026-07-13")).toBe(1);
  });

  it("excludes weekend", () => {
    // Fri 2026-07-10 .. Mon 2026-07-13 → Fri + Mon = 2
    expect(countWorkingDays("2026-07-10", "2026-07-13")).toBe(2);
  });

  it("excludes known national holiday", () => {
    // 2026-08-17 is Monday (Independence Day) — alone = 0 working days
    expect(countWorkingDays("2026-08-17", "2026-08-17")).toBe(0);
  });

  it("parses YYYY-MM-DD as local (no UTC shift)", () => {
    // Full week Mon–Fri without holidays in mid-July 2026
    expect(countWorkingDays("2026-07-13", "2026-07-17")).toBe(5);
  });
});
