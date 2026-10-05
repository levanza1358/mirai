/**
 * CodeBuddy bulk-import normalizer.
 *
 * Guards the OAuth-migration import format (access_token + refresh_token + uid,
 * optionally alongside a legacy api_key) and the api_key-only naming rule that
 * avoids the backend's by-name upsert clobbering an existing key.
 */
import { describe, it, expect } from "vitest";
import { normalizeCodeBuddyAccount } from "../../src/lib/oauth/providers/codebuddyBulkImport.js";

function makeJwt(payload) {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

describe("normalizeCodeBuddyAccount: OAuth entries", () => {
  it("classifies an access_token entry as oauth and keeps refresh token", () => {
    const out = normalizeCodeBuddyAccount({
      access_token: "at-1",
      refresh_token: "rt-1",
      uid: "u-1",
    });
    expect(out.authType).toBe("oauth");
    expect(out.hasOauth).toBe(true);
    expect(out.accessToken).toBe("at-1");
    expect(out.refreshToken).toBe("rt-1");
    expect(out.apiKey).toBeNull();
    expect(out.providerSpecificData.uid).toBe("u-1");
    expect(out.providerSpecificData.authMethod).toBe("device_code");
    expect(out.isActive).toBe(true);
    expect(out.testStatus).toBe("active");
  });

  it("accepts camelCase field names", () => {
    const out = normalizeCodeBuddyAccount({
      accessToken: "at-2",
      refreshToken: "rt-2",
      uid: 12345,
    });
    expect(out.authType).toBe("oauth");
    expect(out.accessToken).toBe("at-2");
    expect(out.refreshToken).toBe("rt-2");
    expect(out.providerSpecificData.uid).toBe("12345");
  });

  it("derives uid from the JWT sub when uid is absent", () => {
    const out = normalizeCodeBuddyAccount({
      access_token: makeJwt({ sub: "069db94b-0ffa-4d2e-b362-df9ae75e9f9f" }),
      refresh_token: "rt",
    });
    expect(out.providerSpecificData.uid).toBe("069db94b-0ffa-4d2e-b362-df9ae75e9f9f");
  });

  it("keeps a legacy api_key as a fallback when an access_token is present", () => {
    // Real exports (warpize) ship both an already-expired access_token and an
    // api_key; the row must stay OAuth (for check-in) but not lose the key.
    const out = normalizeCodeBuddyAccount({
      access_token: "at-3",
      api_key: "ck_legacy",
      uid: "u-3",
    });
    expect(out.authType).toBe("oauth");
    expect(out.apiKey).toBe("ck_legacy");
    expect(out.providerSpecificData.hasApiKeyFallback).toBe(true);
  });

  it("computes expiresAt from expires_in seconds", () => {
    const before = Date.now();
    const out = normalizeCodeBuddyAccount({
      access_token: "at-4",
      expires_in: 3600,
    });
    const at = new Date(out.expiresAt).getTime();
    expect(at).toBeGreaterThanOrEqual(before + 3599 * 1000);
    expect(at).toBeLessThanOrEqual(before + 3601 * 1000);
  });

  it("preserves an explicit expires_at over expires_in", () => {
    const out = normalizeCodeBuddyAccount({
      access_token: "at-5",
      expires_at: "2030-01-01T00:00:00.000Z",
      expires_in: 3600,
    });
    expect(out.expiresAt).toBe("2030-01-01T00:00:00.000Z");
  });
});

describe("normalizeCodeBuddyAccount: api_key-only entries", () => {
  it("classifies an api_key-only entry as apikey and auto-names it Key N", () => {
    const out = normalizeCodeBuddyAccount({ api_key: "ck_1", uid: "u-9" });
    expect(out.authType).toBe("apikey");
    expect(out.hasApiKey).toBe(true);
    expect(out.accessToken).toBeNull();
    expect(out.name).toBe("Key 1");
    expect(out.providerSpecificData.uid).toBe("u-9");
  });

  it("gap-fills around existing names so a key name is never reused", () => {
    const used = new Set(["key 1", "key 3"]);
    const a = normalizeCodeBuddyAccount({ api_key: "ck_a" }, { usedNames: used });
    const b = normalizeCodeBuddyAccount({ api_key: "ck_b" }, { usedNames: used });
    expect([a.name, b.name]).toEqual(["Key 2", "Key 4"]);
  });

  it("honours an explicit name and does not consume an auto slot", () => {
    const used = new Set(["key 1"]);
    const out = normalizeCodeBuddyAccount(
      { api_key: "ck_c", name: "Production" },
      { usedNames: used }
    );
    expect(out.name).toBe("Production");
    expect(used.has("key 2")).toBe(false);
  });
});

describe("normalizeCodeBuddyAccount: validation", () => {
  it("throws when neither token nor key is present", () => {
    expect(() => normalizeCodeBuddyAccount({ uid: "u" })).toThrow(
      /Missing access_token/
    );
  });

  it("throws for non-object entries", () => {
    expect(() => normalizeCodeBuddyAccount(null)).toThrow(/not an object/);
    expect(() => normalizeCodeBuddyAccount([])).toThrow(/not an object/);
    expect(() => normalizeCodeBuddyAccount("ck_x")).toThrow(/not an object/);
  });
});
