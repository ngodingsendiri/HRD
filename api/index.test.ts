import { describe, it, expect } from "vitest";
import { matchRoute, resolveApiPath } from "./index";
import type { VercelRequest } from "@vercel/node";

function fakeReq(partial: {
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string>;
}): VercelRequest {
  return {
    url: partial.url ?? "/api",
    query: partial.query ?? {},
    headers: { host: "localhost", ...(partial.headers || {}) },
  } as VercelRequest;
}

describe("resolveApiPath", () => {
  it("reads path from rewrite query", () => {
    expect(
      resolveApiPath(fakeReq({ url: "/api?path=auth/login", query: { path: "auth/login" } })),
    ).toBe("auth/login");
  });

  it("parses full /api/... url", () => {
    expect(
      resolveApiPath(fakeReq({ url: "/api/auth/login", query: {} })),
    ).toBe("auth/login");
  });

  it("parses nested v1 path", () => {
    expect(
      resolveApiPath(
        fakeReq({ url: "/api?path=v1/employees/abc", query: { path: "v1/employees/abc" } }),
      ),
    ).toBe("v1/employees/abc");
  });
});

describe("matchRoute", () => {
  it("matches auth/login", () => {
    expect(matchRoute("auth/login")).not.toBeNull();
  });

  it("matches employees/:id", () => {
    const m = matchRoute("employees/clxyz");
    expect(m).not.toBeNull();
    expect(m!.params.id).toBe("clxyz");
  });

  it("returns null for unknown", () => {
    expect(matchRoute("nope/missing")).toBeNull();
  });
});
