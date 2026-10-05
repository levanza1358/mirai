import { describe, it, expect } from "vitest";
import { classifyConnection, bucketConnections } from "@/shared/utils/accountBuckets";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const FUTURE = "2026-01-01T13:00:00.000Z";
const PAST = "2026-01-01T11:00:00.000Z";

describe("classifyConnection", () => {
  it("classifies a healthy enabled connection as active", () => {
    expect(classifyConnection({ testStatus: "active", isActive: true }, NOW)).toBe("active");
  });

  it("classifies error/expired test statuses as error", () => {
    expect(classifyConnection({ testStatus: "error" }, NOW)).toBe("error");
    expect(classifyConnection({ testStatus: "expired" }, NOW)).toBe("error");
  });

  it("treats 'unavailable' with no active cooldown as active (auto-recover after cooldown)", () => {
    expect(classifyConnection({ testStatus: "unavailable" }, NOW)).toBe("active");
    expect(classifyConnection({ testStatus: "unavailable", isActive: true }, NOW)).toBe("active");
  });

  it("treats 'unavailable' with an active cooldown as rate limited", () => {
    expect(
      classifyConnection({ testStatus: "unavailable", isActive: true, modelLock_gpt: FUTURE }, NOW),
    ).toBe("rateLimited");
  });

  it("treats a future rateLimitedUntil as rate limited", () => {
    expect(classifyConnection({ testStatus: "active", isActive: true, rateLimitedUntil: FUTURE }, NOW)).toBe(
      "rateLimited",
    );
  });

  it("treats a past rateLimitedUntil as not rate limited", () => {
    expect(classifyConnection({ testStatus: "active", isActive: true, rateLimitedUntil: PAST }, NOW)).toBe("active");
  });

  it("treats an active modelLock_* field as rate limited", () => {
    expect(classifyConnection({ testStatus: "active", isActive: true, modelLock_gpt: FUTURE }, NOW)).toBe(
      "rateLimited",
    );
  });

  it("does not mark a disabled connection as rate limited", () => {
    // A disabled connection with a cooldown falls back to its test status bucket.
    expect(classifyConnection({ testStatus: "active", isActive: false, rateLimitedUntil: FUTURE }, NOW)).toBe(
      "active",
    );
    expect(classifyConnection({ testStatus: "error", isActive: false, rateLimitedUntil: FUTURE }, NOW)).toBe("error");
  });

  it("prefers rateLimited over an error test status", () => {
    expect(classifyConnection({ testStatus: "error", isActive: true, rateLimitedUntil: FUTURE }, NOW)).toBe(
      "rateLimited",
    );
  });

  it("returns active for null/undefined input", () => {
    expect(classifyConnection(null, NOW)).toBe("active");
    expect(classifyConnection(undefined, NOW)).toBe("active");
  });
});

describe("bucketConnections", () => {
  it("splits connections into active/rateLimited/error preserving order", () => {
    const conns = [
      { id: "a", testStatus: "active", isActive: true },
      { id: "b", testStatus: "active", isActive: true, rateLimitedUntil: FUTURE },
      { id: "c", testStatus: "error" },
      { id: "d", testStatus: "active", isActive: true },
    ];
    const buckets = bucketConnections(conns, NOW);
    expect(buckets.active.map((c) => c.id)).toEqual(["a", "d"]);
    expect(buckets.rateLimited.map((c) => c.id)).toEqual(["b"]);
    expect(buckets.error.map((c) => c.id)).toEqual(["c"]);
  });

  it("handles empty / missing input", () => {
    expect(bucketConnections([])).toEqual({ active: [], rateLimited: [], error: [] });
    expect(bucketConnections(null)).toEqual({ active: [], rateLimited: [], error: [] });
  });
});
