import { describe, it, expect, vi, afterEach } from "vitest";
import { handleApiError, OperationType } from "./error";

describe("handleApiError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces intentional Indonesian API messages", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = handleApiError(
      new Error("NIP atau NIK sudah terdaftar"),
      OperationType.CREATE,
      "/api/employees",
    );
    expect(e.message).toBe("NIP atau NIK sudah terdaftar");
  });

  it("maps Unauthorized to session message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = handleApiError(
      new Error("Unauthorized"),
      OperationType.GET,
      "/api/employees",
    );
    expect(e.message).toMatch(/masuk/i);
  });

  it("maps bare network failure to friendly list message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const e = handleApiError(
      new Error("Failed to fetch"),
      OperationType.LIST,
      "/api/employees",
    );
    expect(e.message).toBe("Gagal memuat data.");
  });
});
