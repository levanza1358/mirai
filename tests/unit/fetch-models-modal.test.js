/**
 * Regression test: generic "Fetch Models" flow.
 *
 * Requirements (user-approved):
 *  - A "Fetch Models" button exists for EVERY provider (not just qoder/cline).
 *  - It opens a popup that lists the provider's live model catalog with checkboxes.
 *  - Models already in the list are pre-checked and LOCKED (cannot be unchecked)
 *    and labelled "existing".
 *  - New models are pre-checked and CAN be toggled; checked ones are added as
 *    new custom models.
 *
 * The page and modal are Next.js client components that cannot be imported
 * directly in a unit test, so these are source-text assertions.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const modalSrc = fs.readFileSync(
  path.resolve("../src/app/(dashboard)/dashboard/providers/[id]/FetchModelsModal.js"),
  "utf-8"
);
const pageSrc = fs.readFileSync(
  path.resolve("../src/app/(dashboard)/dashboard/providers/[id]/page.js"),
  "utf-8"
);

describe("FetchModelsModal component", () => {
  it("fetches the provider model catalog from the models API", () => {
    expect(modalSrc).toContain("/models");
    expect(modalSrc).toMatch(/fetch\(.*\/api\/providers\//);
  });

  it("renders a checkbox per model", () => {
    expect(modalSrc).toContain('type="checkbox"');
  });

  it("locks existing models: checked + disabled + 'existing' label", () => {
    // existing set is derived from existingModelIds prop
    expect(modalSrc).toContain("existingModelIds");
    // the checkbox is disabled for existing rows
    expect(modalSrc).toContain("disabled={existing}");
    // existing rows render an "existing" badge
    expect(modalSrc).toContain("existing");
    // toggling an existing model is a no-op (locked)
    expect(modalSrc).toMatch(/if \(isExisting\(id\)\) return/);
  });

  it("lets new models be toggled and reports a selected count", () => {
    expect(modalSrc).toContain("newSelectedCount");
    expect(modalSrc).toMatch(/Add Selected/);
  });

  it("surfaces provider fetch errors as a friendly notice (not a raw throw)", () => {
    expect(modalSrc).toContain("setFetchError");
    expect(modalSrc).toMatch(/does not support|no models/i);
  });
});

describe("provider page wires the Fetch Models flow", () => {
  it("imports and renders FetchModelsModal", () => {
    expect(pageSrc).toContain('import FetchModelsModal from "./FetchModelsModal"');
    expect(pageSrc).toContain("<FetchModelsModal");
  });

  it("shows the Fetch Models button for all providers (no qoder/cline gating)", () => {
    expect(pageSrc).toContain("handleOpenFetchModels");
    expect(pageSrc).toContain("translate(\"Fetch Models\")");
    // old provider-specific buttons are gone
    expect(pageSrc).not.toContain("Fetch Qoder Models");
    expect(pageSrc).not.toContain("handleImportQoderModels");
    expect(pageSrc).not.toContain("handleImportClineModels");
  });

  it("computes the set of existing models (built-in + custom + aliases) at component scope", () => {
    expect(pageSrc).toContain("const existingModelIds = (() => {");
    expect(pageSrc).toContain("for (const m of models)");
    expect(pageSrc).toContain("for (const m of kiloFreeModels)");
    expect(pageSrc).toContain("for (const entry of customModels)");
    expect(pageSrc).toContain("for (const full of Object.values(modelAliases))");
  });

  it("persists selected models via the existing custom-model endpoint", () => {
    expect(pageSrc).toContain("handleSaveFetchedModels");
    expect(pageSrc).toContain("onSaveSelected={handleSaveFetchedModels}");
    expect(pageSrc).toContain("handleAddCustomModel(modelId, \"llm\", providerStorageAlias)");
  });
});
