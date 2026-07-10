import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "./http";

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
