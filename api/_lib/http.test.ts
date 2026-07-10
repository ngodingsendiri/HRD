import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyPublicApiCors, rateLimit } from "./http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

describe("rateLimit", () => {
  const key = `test-${Math.random()}`;

  beforeEach(() => {
    // each test uses a unique key via random suffix in body
  });

  it("allows requests under the limit", () => {
    const k = `${key}-under`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(k, { limit: 5, windowMs: 60_000 }).ok).toBe(true);
    }
  });

  it("blocks after limit is reached", () => {
    const k = `${key}-block`;
    for (let i = 0; i < 3; i++) {
      rateLimit(k, { limit: 3, windowMs: 60_000 });
    }
    const blocked = rateLimit(k, { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("applyPublicApiCors", () => {
  function mockRes() {
    const headers: Record<string, string> = {};
    return {
      headers,
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    } as unknown as VercelResponse & { headers: Record<string, string> };
  }

  it("sets CORS and handles OPTIONS", () => {
    const req = { method: "OPTIONS", headers: {} } as VercelRequest;
    const res = mockRes();
    expect(applyPublicApiCors(req, res)).toBe(true);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("sets CORS on GET without ending", () => {
    const req = { method: "GET", headers: {} } as VercelRequest;
    const res = mockRes();
    expect(applyPublicApiCors(req, res)).toBe(false);
    expect(res.headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });

  it("echoes allowed origin when list provided", () => {
    const req = {
      method: "GET",
      headers: { origin: "https://app.example.com" },
    } as VercelRequest;
    const res = mockRes();
    applyPublicApiCors(req, res, ["https://app.example.com"]);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe(
      "https://app.example.com",
    );
  });
});
