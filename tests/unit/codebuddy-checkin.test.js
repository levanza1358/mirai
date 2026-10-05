/**
 * CodeBuddy daily check-in — pure helpers.
 *
 * Covers status classification (idempotent "already", inactive campaign,
 * OAuth-only rejection for API-key connections) plus the uid/JWT decoding used
 * for the X-User-Id header.
 */
import { describe, it, expect } from "vitest";
import {
  mapCheckinStatus,
  resolveUid,
  decodeJwt,
  dayKey,
  isCodeBuddyCheckinProvider,
} from "../../open-sse/services/checkin/codebuddy-checkin.js";
import { uidFromJwt } from "../../src/lib/oauth/providers/codebuddyUid.js";

function makeJwt(payload) {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

describe("mapCheckinStatus", () => {
  it("treats a 2xx as a fresh check-in", () => {
    expect(mapCheckinStatus({ httpStatus: 200, code: 0 })).toBe("checked-in");
    expect(mapCheckinStatus({ httpStatus: 204 })).toBe("checked-in");
  });

  it("detects idempotent replays by code", () => {
    expect(mapCheckinStatus({ httpStatus: 400, code: 10001 })).toBe("already");
    expect(mapCheckinStatus({ httpStatus: 400, code: 14001 })).toBe("already");
  });

  it("detects idempotent replays by message", () => {
    expect(mapCheckinStatus({ httpStatus: 400, msg: "今天已签到" })).toBe("already");
    expect(mapCheckinStatus({ httpStatus: 409, msg: "already checked in" })).toBe("already");
  });

  it("flags the OAuth-only rejection for API-key connections", () => {
    expect(mapCheckinStatus({ httpStatus: 403, msg: "API key not allowed for this path or method" })).toBe(
      "apikey-only",
    );
  });

  it("flags an inactive/closed campaign", () => {
    expect(mapCheckinStatus({ httpStatus: 200, code: 1003 })).toBe("checked-in");
    expect(mapCheckinStatus({ httpStatus: 400, code: 1003 })).toBe("inactive");
    expect(mapCheckinStatus({ httpStatus: 400, msg: "活动未开启" })).toBe("inactive");
  });

  it("falls back to failed for unknown responses", () => {
    expect(mapCheckinStatus({ httpStatus: 500, code: 10000 })).toBe("failed");
  });
});

describe("resolveUid", () => {
  it("reads the JWT sub claim when present", () => {
    const accessToken = makeJwt({ sub: "1234567890", iss: "https://www.codebuddy.cn" });
    expect(resolveUid({ accessToken })).toBe("1234567890");
  });

  it("falls back to providerSpecificData.uid", () => {
    expect(resolveUid({ accessToken: "not-a-jwt", providerSpecificData: { uid: "42" } })).toBe("42");
  });

  it("falls back to the connection id", () => {
    expect(resolveUid({ apiKey: "abc", id: "conn-7" })).toBe("conn-7");
  });
});

describe("uidFromJwt (OAuth mapTokens helper)", () => {
  it("extracts the sub claim", () => {
    expect(uidFromJwt(makeJwt({ sub: "069db94b-0ffa-4d2e-b362-df9ae75e9f9f" }))).toBe(
      "069db94b-0ffa-4d2e-b362-df9ae75e9f9f",
    );
  });

  it("returns null for an opaque (non-JWT) token", () => {
    expect(uidFromJwt("ck_fu4vk7n8edj4.GjjJVA2zbcPOdaSHznhGvxWWWSzFbRxOSUhGa9n9zZM")).toBeNull();
    expect(uidFromJwt("")).toBeNull();
    expect(uidFromJwt(undefined)).toBeNull();
  });
});

describe("decodeJwt / dayKey / provider guard", () => {
  it("decodes a JWT payload", () => {
    const claims = decodeJwt(makeJwt({ sub: "s1", iss: "x" }));
    expect(claims).toMatchObject({ sub: "s1", iss: "x" });
  });

  it("returns null for a malformed token", () => {
    expect(decodeJwt("garbage")).toBeNull();
    expect(decodeJwt(undefined)).toBeNull();
  });

  it("formats a local day key", () => {
    expect(dayKey(new Date(2026, 9, 5).getTime())).toBe("2026-10-05");
  });

  it("guards on CodeBuddy providers only", () => {
    expect(isCodeBuddyCheckinProvider("codebuddy-cn")).toBe(true);
    expect(isCodeBuddyCheckinProvider("codebuddy-intl")).toBe(true);
    expect(isCodeBuddyCheckinProvider("codex")).toBe(false);
  });
});
