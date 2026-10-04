/**
 * Regression test: CodeBuddy CN / intl could not be listed by the Fetch Models
 * modal because neither provider was present in PROVIDER_MODELS_CONFIG, so
 * GET /api/providers/[id]/models returned 400
 * "Provider codebuddy-cn does not support models listing".
 *
 * CodeBuddy's server exposes no public model-listing route (every /v2/*
 * catalog path 404s; only /v2/chat/completions and the billing meter answer),
 * so the bundled registry catalog IS the contract. Both providers now serve
 * that catalog statically — the same pattern used by kimchi/cursor/cline.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getModelsByProviderId } from "../../open-sse/config/providerModels.js";

const routeSrc = fs.readFileSync(
  path.resolve("../src/app/api/providers/[id]/models/route.js"),
  "utf-8"
);

describe("CodeBuddy models listing", () => {
  it("bundles a static model catalog for codebuddy-cn", () => {
    const models = getModelsByProviderId("codebuddy-cn");
    expect(models.length).toBeGreaterThan(0);
    expect(models.map((m) => m.id)).toContain("glm-5.3");
  });

  it("bundles a static model catalog for codebuddy-intl", () => {
    const models = getModelsByProviderId("codebuddy-intl");
    expect(models.length).toBeGreaterThan(0);
    expect(models.map((m) => m.id)).toContain("glm-5.2");
  });

  it('PROVIDER_MODELS_CONFIG has a "codebuddy-cn" entry serving the static catalog', () => {
    expect(routeSrc).toMatch(
      /"codebuddy-cn"\s*:\s*\{[\s\S]*?getStaticProviderModels\("codebuddy-cn"\)/
    );
  });

  it('PROVIDER_MODELS_CONFIG has a "codebuddy-intl" entry serving the static catalog', () => {
    expect(routeSrc).toMatch(
      /"codebuddy-intl"\s*:\s*\{[\s\S]*?getStaticProviderModels\("codebuddy-intl"\)/
    );
  });

  it("both entries surface an informational warning (never a silent zero list)", () => {
    const idx = routeSrc.indexOf('"codebuddy-cn": {');
    const block = routeSrc.slice(idx, idx + 800);
    expect(block).toContain("warning");
    expect(block).toContain("bundled catalog");
  });
});
