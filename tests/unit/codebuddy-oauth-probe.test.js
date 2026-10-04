/**
 * CodeBuddy connection-test semantics.
 *
 * Both codebuddy-cn and codebuddy-intl validate by probing the auth-gated
 * billing meter (POST /v2/billing/meter/get-user-resource, body {}).
 *  - 401  -> token invalid (gateway/APISIX rejects before app code)
 *  - 200 + { code: 0 }       -> valid
 *  - 200 + { code: <non-0> } -> rejected (revoked / unavailable)
 */
import { describe, it, expect } from "vitest";
import { classifyOAuthProbeResult } from "../../src/app/api/providers/[id]/test/testUtils.js";

const CODEBUDDY_PROBE = {
  method: "POST",
  body: "{}",
  bodyCodePointer: "code",
  successBodyCode: 0,
};

describe("classifyOAuthProbeResult (codebuddy)", () => {
  it("treats 200 with code 0 as success", () => {
    const body = JSON.stringify({ code: 0, msg: "ok", data: { Response: { Data: { Accounts: [] } } } });
    const r = classifyOAuthProbeResult({ ok: true, status: 200 }, CODEBUDDY_PROBE, body);
    expect(r).toEqual({ valid: true, error: null, soft: false });
  });

  it("rejects 200 with a non-zero body code", () => {
    const body = JSON.stringify({ code: 11217, msg: "token expired" });
    const r = classifyOAuthProbeResult({ ok: true, status: 200 }, CODEBUDDY_PROBE, body);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/token expired/);
  });

  it("rejects 401 from the gateway", () => {
    const r = classifyOAuthProbeResult({ ok: false, status: 401 }, CODEBUDDY_PROBE, "<html>401</html>");
    expect(r).toEqual({ valid: false, error: "Token invalid or revoked", soft: false });
  });

  it("does not misjudge a non-JSON 200 body (falls back to success)", () => {
    const r = classifyOAuthProbeResult({ ok: true, status: 200 }, CODEBUDDY_PROBE, "<html>ok</html>");
    expect(r.valid).toBe(true);
  });
});
