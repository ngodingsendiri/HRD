import { describe, it, expect, afterEach } from "vitest";
import { getAuthSecret, isAdminEmail, resolveAccess, normalizeRole } from "./authEnv";

describe("getAuthSecret", () => {
  const originalSecret = process.env.AUTH_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercel = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalSecret;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalVercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercel;
  });

  it("returns AUTH_SECRET when long enough", () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    process.env.NODE_ENV = "production";
    expect(getAuthSecret()).toBe("a".repeat(32));
  });

  it("throws in production when AUTH_SECRET missing", () => {
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
  });

  it("uses dev fallback outside production", () => {
    delete process.env.AUTH_SECRET;
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    expect(getAuthSecret()).toContain("dev_only");
  });
});

describe("isAdminEmail", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("matches allowlist case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com, other@test.com";
    expect(isAdminEmail("admin@example.com")).toBe(true);
    expect(isAdminEmail("OTHER@test.com")).toBe(true);
    expect(isAdminEmail("nope@test.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});

describe("normalizeRole / resolveAccess", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("normalizes roles fail-closed", () => {
    expect(normalizeRole("viewer")).toBe("VIEWER");
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole(undefined)).toBe("VIEWER");
    expect(normalizeRole("typo")).toBe("VIEWER");
  });

  it("elevates allowlist to write admin", () => {
    process.env.ADMIN_EMAILS = "boss@ex.com";
    const a = resolveAccess("boss@ex.com", "VIEWER");
    expect(a.canWrite).toBe(true);
    expect(a.role).toBe("ADMIN");
  });

  it("respects VIEWER role without allowlist", () => {
    delete process.env.ADMIN_EMAILS;
    const a = resolveAccess("user@ex.com", "VIEWER");
    expect(a.canWrite).toBe(false);
    expect(a.role).toBe("VIEWER");
  });
});
