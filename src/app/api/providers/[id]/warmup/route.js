import { NextResponse } from "next/server";
import { getProviderConnectionById, updateProviderConnection } from "@/lib/localDb";
import { getProviderModels, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { UPDATER_CONFIG } from "@/shared/constants/config";
import { pingModelByKind } from "@/app/api/models/test/ping";

// Providers whose first registry model is not a safe/supported warm-up target.
// The registry order is otherwise a good default: entry #0 is the cheapest,
// fastest model a provider exposes.
const WARMUP_MODEL_OVERRIDES = {
  claude: "claude-haiku-4-5-20251001",
  codex: "gpt-5.5",
};

function baseUrl() {
  return `http://127.0.0.1:${process.env.PORT || UPDATER_CONFIG.appPort}`;
}

function pickWarmupModel(providerId, alias) {
  if (WARMUP_MODEL_OVERRIDES[providerId]) return WARMUP_MODEL_OVERRIDES[providerId];
  const models = getProviderModels(alias);
  const llm = models.find((m) => (m.kind || m.type || "llm") === "llm");
  return llm?.id || models[0]?.id || null;
}

/**
 * POST /api/providers/[id]/warmup
 *
 * On-demand warm-up for a single connection: send a tiny real chat request
 * through the app's own /v1 endpoint so the account's session/quota window is
 * actually "warmed" (unlike the credential-only test endpoint). The result is
 * persisted to testStatus/lastError so the dashboard reflects it immediately.
 *
 * Response: { valid, error, model, latencyMs }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const providerId = connection.provider;
    const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
    const isCompatible =
      isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

    let modelId = pickWarmupModel(providerId, alias);

    // Compatible providers (custom base URLs) have no registry model list — ask
    // the app's own live-models endpoint for the first entry.
    if (!modelId && isCompatible) {
      try {
        const res = await fetch(`${baseUrl()}/api/providers/${id}/models`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const first = (data.models || [])[0];
          modelId = first?.id || first?.name || null;
        }
      } catch {
        /* fall through to the "no model" branch below */
      }
    }

    if (!modelId) {
      return NextResponse.json(
        { error: "No warm-up model available for this provider" },
        { status: 400 },
      );
    }

    const qualified = `${alias}/${modelId}`;
    const result = await pingModelByKind(qualified, "llm", baseUrl(), "hi");
    const valid = !!result.ok;

    await updateProviderConnection(id, {
      testStatus: valid ? "active" : "error",
      lastError: valid ? null : (result.error || "Warm-up failed"),
      lastErrorAt: valid ? null : new Date().toISOString(),
      lastWarmupAt: new Date().toISOString(),
    });

    return NextResponse.json({
      valid,
      error: valid ? null : (result.error || "Warm-up failed"),
      model: qualified,
      latencyMs: result.latencyMs || 0,
    });
  } catch (error) {
    console.log("Error warming up connection:", error);
    return NextResponse.json({ error: "Warm-up failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
