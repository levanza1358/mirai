/**
 * Regression test for #4232
 *
 * codebuddy-intl was missing from OAUTH_TEST_CONFIG, so the test route returned
 * {"valid":false,"error":"Provider test not supported"} for every
 * codebuddy-intl account regardless of token validity.
 *
 * Later hardening: both codebuddy-cn and codebuddy-intl used to short-circuit
 * with tokenExists: true, which always reported "valid" and never contacted the
 * provider. They now probe the auth-gated Tencent billing meter — the same
 * endpoint the usage view uses — which returns HTTP 401 for a bad token and
 * HTTP 200 { code: 0 } for a good one.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// testUtils.js is a Next.js server file, so inspect the source text rather than
// importing it (avoids next/server bootstrap requirements).
const src = fs.readFileSync(
  path.resolve("../src/app/api/providers/[id]/test/testUtils.js"),
  "utf-8"
);

describe("OAUTH_TEST_CONFIG for CodeBuddy providers", () => {
  it('contains "codebuddy-intl" entry', () => {
    expect(src).toContain('"codebuddy-intl"');
  });

  it('contains "codebuddy-cn" entry', () => {
    expect(src).toContain('"codebuddy-cn"');
  });

  it('"codebuddy-cn" probes the Tencent billing meter (no tokenExists stub)', () => {
    expect(src).toMatch(
      /"codebuddy-cn"\s*:\s*\{[\s\S]*?copilot\.tencent\.com\/v2\/billing\/meter\/get-user-resource/
    );
  });

  it('"codebuddy-intl" probes the codebuddy.ai billing meter (no tokenExists stub)', () => {
    expect(src).toMatch(
      /"codebuddy-intl"\s*:\s*\{[\s\S]*?www\.codebuddy\.ai\/v2\/billing\/meter\/get-user-resource/
    );
  });

  it("no longer short-circuits CodeBuddy with tokenExists", () => {
    // cursor legitimately still uses the tokenExists stub (protobuf API), but
    // CodeBuddy must not.
    expect(src).not.toMatch(/"codebuddy-(cn|intl)"\s*:\s*\{\s*tokenExists\s*:\s*true\s*\}/);
  });
});

// API-key connections take a different code path (testApiKeyConnection), which
// used to fall through to default and report "Provider test not supported".
describe("testApiKeyConnection covers CodeBuddy providers", () => {
  it('has a case for "codebuddy-cn" / "codebuddy-intl"', () => {
    // Anchor on the switch-case label (indented), not the OAUTH_TEST_CONFIG key.
    const idx = src.indexOf('case "codebuddy-cn":');
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 2000);
    expect(block).toContain('case "codebuddy-intl":');
    expect(block).toContain("billing/meter/get-user-resource");
    expect(block).toContain("connection.apiKey");
    expect(block).toContain("parsed.code !== 0");
  });
});
