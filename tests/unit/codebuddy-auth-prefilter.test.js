/**
 * auth.js pre-filter: CodeBuddy (CN/Intl) accounts whose request meter is
 * exhausted must be skipped from rotation until their base pack refreshes.
 * Exercises the real cache module + the real filter logic in getProviderCredentials.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const connections = [];
vi.mock("@/lib/localDb", () => ({
  getProviderConnections: vi.fn(async () => connections),
  getSettings: vi.fn(async () => ({ fallbackStrategy: "fill-first" })),
  getProxyPools: vi.fn(async () => []),
  validateApiKey: vi.fn(async () => ({ valid: true })),
  updateProviderConnection: vi.fn(async () => {}),
}));

import { getProviderCredentials } from "../../src/sse/services/auth.js";
import {
  recordCodeBuddyUsage,
  _resetCodeBuddyQuotaCache,
} from "../../src/sse/services/codebuddyQuota.js";

const FUTURE = new Date(Date.now() + 6 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function conn(id, extra = {}) {
  return { id, name: id, provider: "codebuddy-cn", isActive: true, ...extra };
}

beforeEach(() => {
  connections.length = 0;
  _resetCodeBuddyQuotaCache();
});

describe("CodeBuddy request-meter pre-filter", () => {
  it("skips an account whose meter is exhausted (reset in the future)", async () => {
    connections.push(conn("dead"), conn("live"));
    recordCodeBuddyUsage("dead", { requestExhausted: true, resetAt: FUTURE });
    recordCodeBuddyUsage("live", { requestExhausted: false, resetAt: null });

    const picked = await getProviderCredentials("codebuddy-cn", null, "glm-5.2");
    expect(picked.connectionId).toBe("live");
  });

  it("re-admits an exhausted account once its reset time has passed", async () => {
    connections.push(conn("revived"));
    recordCodeBuddyUsage("revived", { requestExhausted: true, resetAt: PAST });

    const picked = await getProviderCredentials("codebuddy-cn", null, "glm-5.2");
    expect(picked.connectionId).toBe("revived");
  });

  it("reports allRateLimited with the cycle reset when every account is exhausted", async () => {
    connections.push(conn("a"), conn("b"));
    recordCodeBuddyUsage("a", { requestExhausted: true, resetAt: FUTURE });
    recordCodeBuddyUsage("b", { requestExhausted: true, resetAt: FUTURE });

    const res = await getProviderCredentials("codebuddy-cn", null, "glm-5.2");
    expect(res.allRateLimited).toBe(true);
    expect(new Date(res.retryAfter).getTime()).toBe(new Date(FUTURE).getTime());
  });

  it("does not apply the CodeBuddy filter to other providers", async () => {
    connections.push({ id: "x", name: "x", provider: "codex", isActive: true });
    recordCodeBuddyUsage("x", { requestExhausted: true, resetAt: FUTURE });

    const picked = await getProviderCredentials("codex", null, "gpt-5");
    expect(picked.connectionId).toBe("x");
  });
});
