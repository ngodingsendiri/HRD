import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  parseScopes,
  hasScope,
  normalizeScopes,
  normalizeOrigins,
  originAllowed,
  pathParamId,
  API_SCOPES,
  MAX_API_KEY_LENGTH,
  type ApiKeyPrincipal,
} from "./apiKey";

describe("hashApiKey / generateApiKey", () => {
  it("hashes deterministically", () => {
    const a = hashApiKey("hrc_test");
    const b = hashApiKey("hrc_test");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates hrc_ prefix and matching hash/prefix", () => {
    const { key, hash, prefix } = generateApiKey();
    expect(key.startsWith("hrc_")).toBe(true);
    expect(prefix).toBe(key.slice(0, 12));
    expect(hash).toBe(hashApiKey(key));
    expect(key.length).toBeGreaterThan(20);
    expect(key.length).toBeLessThanOrEqual(MAX_API_KEY_LENGTH);
  });

  it("generates unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("parseScopes", () => {
  it("parses array", () => {
    expect(parseScopes(["employees:read", "stats:read"])).toEqual([
      "employees:read",
      "stats:read",
    ]);
  });

  it("parses JSON string", () => {
    expect(parseScopes('["employees:read"]')).toEqual(["employees:read"]);
  });

  it("parses comma list", () => {
    expect(parseScopes("employees:read, stats:read")).toEqual([
      "employees:read",
      "stats:read",
    ]);
  });

  it("defaults when empty-ish", () => {
    expect(parseScopes(null)).toEqual(["employees:read", "stats:read"]);
  });
});

describe("normalizeScopes", () => {
  it("filters unknown and wildcard", () => {
    expect(normalizeScopes(["employees:read", "*", "evil", "stats:read"])).toEqual([
      "employees:read",
      "stats:read",
    ]);
  });

  it("dedupes", () => {
    expect(normalizeScopes(["stats:read", "stats:read"])).toEqual(["stats:read"]);
  });

  it("defaults when empty", () => {
    expect(normalizeScopes([])).toEqual(["employees:read", "stats:read"]);
  });
});

describe("hasScope", () => {
  const principal = (scopes: string[]): ApiKeyPrincipal => ({
    id: "1",
    name: "t",
    keyPrefix: "hrc_x",
    scopes,
    allowedOrigins: [],
  });

  it("matches exact scope", () => {
    expect(hasScope(principal(["employees:read"]), "employees:read")).toBe(true);
    expect(hasScope(principal(["employees:read"]), "stats:read")).toBe(false);
  });

  it("does not grant wildcard", () => {
    expect(hasScope(principal(["*"]), "stats:read")).toBe(false);
  });

  it("API_SCOPES is non-empty", () => {
    expect(API_SCOPES.length).toBeGreaterThanOrEqual(2);
  });
});

describe("pathParamId", () => {
  it("accepts string", () => {
    expect(pathParamId("abc")).toBe("abc");
  });

  it("accepts array first element", () => {
    expect(pathParamId(["xyz", "nope"])).toBe("xyz");
  });

  it("rejects empty", () => {
    expect(pathParamId("")).toBeNull();
    expect(pathParamId(undefined)).toBeNull();
    expect(pathParamId([])).toBeNull();
  });
});

describe("normalizeOrigins / originAllowed", () => {
  it("normalizes and dedupes origins", () => {
    expect(
      normalizeOrigins([
        "https://app.example.com/",
        "https://app.example.com",
        "not-a-url",
        "ftp://x.com",
      ]),
    ).toEqual(["https://app.example.com"]);
  });

  it("allows any when list empty", () => {
    const p: ApiKeyPrincipal = {
      id: "1",
      name: "t",
      keyPrefix: "hrc_",
      scopes: [],
      allowedOrigins: [],
    };
    expect(originAllowed(p, "https://evil.com")).toBe(true);
    expect(originAllowed(p, null)).toBe(true);
  });

  it("enforces list for browser Origin", () => {
    const p: ApiKeyPrincipal = {
      id: "1",
      name: "t",
      keyPrefix: "hrc_",
      scopes: [],
      allowedOrigins: ["https://app.example.com"],
    };
    expect(originAllowed(p, "https://app.example.com")).toBe(true);
    expect(originAllowed(p, "https://evil.com")).toBe(false);
    expect(originAllowed(p, null)).toBe(true); // server-to-server
  });
});
