/**
 * CodeBuddy request-meter cache (src/sse/services/codebuddyQuota.js).
 *
 * The router (auth.js) reads this cache to skip accounts whose base pack is
 * exhausted. It is populated from the usage API payload (Quota tab read) and
 * from the rate-limit error path. Guards the record/throttle/exhausted rules.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("open-sse/services/usage.js", () => ({
  getUsageForProvider: vi.fn(),
}));

import { getUsageForProvider } from "open-sse/services/usage.js";
import {
  recordCodeBuddyUsage,
  refreshCodeBuddyQuota,
  getCodeBuddyQuotaCache,
  isCodeBuddyQuotaProvider,
  handleCodeBuddyQuotaError,
  _resetCodeBuddyQuotaCache,
} from "../../src/sse/services/codebuddyQuota.js";

beforeEach(() => {
  _resetCodeBuddyQuotaCache();
  vi.clearAllMocks();
});

describe("isCodeBuddyQuotaProvider", () => {
  it("recognises both CodeBuddy variants", () => {
    expect(isCodeBuddyQuotaProvider("codebuddy-cn")).toBe(true);
    expect(isCodeBuddyQuotaProvider("codebuddy-intl")).toBe(true);
    expect(isCodeBuddyQuotaProvider("codex")).toBe(false);
  });
});

describe("recordCodeBuddyUsage", () => {
  it("records an exhausted reading with its reset time", () => {
    const entry = recordCodeBuddyUsage("c1", {
      requestExhausted: true,
      resetAt: "2026-11-01T00:00:00.000Z",
    });
    expect(entry).toEqual({
      exhausted: true,
      resetAt: "2026-11-01T00:00:00.000Z",
      checkedAt: expect.any(Number),
    });
    expect(getCodeBuddyQuotaCache().get("c1").exhausted).toBe(true);
  });

  it("clears a previous exhaustion when the pack is healthy again", () => {
    recordCodeBuddyUsage("c2", { requestExhausted: true, resetAt: "2026-11-01T00:00:00.000Z" });
    recordCodeBuddyUsage("c2", { requestExhausted: false, resetAt: null });
    expect(getCodeBuddyQuotaCache().get("c2")).toMatchObject({
      exhausted: false,
      resetAt: null,
    });
  });

  it("ignores error payloads and payloads without the signal", () => {
    expect(recordCodeBuddyUsage("c3", { message: "credential invalid" })).toBeNull();
    expect(recordCodeBuddyUsage("c3", { plan: "x", quotas: {} })).toBeNull();
    expect(getCodeBuddyQuotaCache().has("c3")).toBe(false);
  });
});

describe("refreshCodeBuddyQuota", () => {
  const conn = { id: "cx", provider: "codebuddy-cn", accessToken: "t" };

  it("populates the cache from the live usage API", async () => {
    getUsageForProvider.mockResolvedValue({
      requestExhausted: true,
      resetAt: "2026-11-01T00:00:00.000Z",
    });
    const entry = await refreshCodeBuddyQuota("cx", conn);
    expect(entry.exhausted).toBe(true);
    expect(getUsageForProvider).toHaveBeenCalledTimes(1);
  });

  it("throttles repeat calls within the refresh interval", async () => {
    getUsageForProvider.mockResolvedValue({ requestExhausted: false, resetAt: null });
    await refreshCodeBuddyQuota("cx", conn);
    await refreshCodeBuddyQuota("cx", conn);
    expect(getUsageForProvider).toHaveBeenCalledTimes(1);
  });

  it("returns null for non-CodeBuddy providers without calling the API", async () => {
    const res = await refreshCodeBuddyQuota("cz", { id: "cz", provider: "codex" });
    expect(res).toBeNull();
    expect(getUsageForProvider).not.toHaveBeenCalled();
  });
});

describe("handleCodeBuddyQuotaError", () => {
  const conn = { id: "ce", provider: "codebuddy-cn", accessToken: "t" };

  it("returns the reset timestamp when the meter is exhausted", async () => {
    const reset = new Date(Date.now() + 3_600_000).toISOString();
    getUsageForProvider.mockResolvedValue({ requestExhausted: true, resetAt: reset });
    const ms = await handleCodeBuddyQuotaError("ce", conn, 429);
    expect(ms).toBe(new Date(reset).getTime());
  });

  it("returns null when the pack is healthy despite the error", async () => {
    getUsageForProvider.mockResolvedValue({ requestExhausted: false, resetAt: null });
    expect(await handleCodeBuddyQuotaError("ce", conn, 429)).toBeNull();
  });
});
