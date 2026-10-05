import { NextResponse } from "next/server";
import { createProviderConnection } from "@/models";
import { getProviderConnections } from "@/lib/localDb";
import { normalizeCodeBuddyAccount } from "@/lib/oauth/providers/codebuddyBulkImport";

/**
 * POST /api/oauth/codebuddy/bulk-import
 * Bulk import CodeBuddy (CN / International) accounts in one call.
 *
 * The product is moving away from plain API keys towards OAuth sessions
 * (access_token + refresh_token) so accounts can also run the daily check-in.
 * A single file may mix both kinds of entries (as exported by tooling such as
 * warpize): OAuth rows carry `access_token`/`refresh_token`, legacy rows carry
 * `api_key`.
 *
 * Body accepts any of:
 *   - Array:    [{...}, {...}]
 *   - Single:   {...}
 *   - Wrapped:  { accounts: [{...}, ...] }
 *
 * Each item accepts snake_case or camelCase:
 *   access_token / accessToken
 *   refresh_token / refreshToken
 *   api_key / apiKey / key
 *   uid
 *   email
 *   expires_in / expiresIn / expires_at / expiresAt
 *
 * Query/body `provider` selects the target provider id:
 *   codebuddy-cn (default) | codebuddy-intl
 */

const ALLOWED_PROVIDERS = new Set(["codebuddy-cn", "codebuddy-intl"]);

function resolveProvider(body, request) {
  const url = new URL(request.url);
  const raw =
    url.searchParams.get("provider") ||
    (body && !Array.isArray(body) && typeof body === "object"
      ? body.provider
      : null) ||
    "codebuddy-cn";
  return ALLOWED_PROVIDERS.has(raw) ? raw : "codebuddy-cn";
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid JSON body: ${err.message}` },
      { status: 400 }
    );
  }

  const provider = resolveProvider(body, request);

  let accounts;
  if (Array.isArray(body)) {
    accounts = body;
  } else if (body && typeof body === "object" && Array.isArray(body.accounts)) {
    accounts = body.accounts;
  } else if (body && typeof body === "object") {
    accounts = [body];
  } else {
    accounts = null;
  }

  if (!Array.isArray(accounts) || accounts.length === 0) {
    return NextResponse.json({ error: "No accounts provided" }, { status: 400 });
  }

  const results = [];
  let success = 0;
  let failed = 0;
  let oauthCount = 0;
  let apikeyCount = 0;

  // Existing connection names, so auto-generated "Key N" names for api_key-only
  // rows gap-fill instead of colliding (the backend upserts apikey rows by name).
  let existingNames = [];
  try {
    const existing = await getProviderConnections({ provider });
    existingNames = existing
      .map((c) => c.name)
      .filter((n) => typeof n === "string" && n.length > 0);
  } catch {
    existingNames = [];
  }
  const usedNames = new Set(existingNames.map((n) => n.toLowerCase()));

  // Serial loop: createProviderConnection reads max(priority)/scans the pool
  // inside a transaction, so parallel calls would race and collide.
  for (let i = 0; i < accounts.length; i++) {
    const raw = accounts[i];
    try {
      const normalized = normalizeCodeBuddyAccount(raw, { usedNames });
      const { hasOauth, hasApiKey: _hasApiKey, ...fields } = normalized;

      const created = await createProviderConnection({
        provider,
        ...fields,
      });

      if (hasOauth) oauthCount++;
      else apikeyCount++;
      success++;
      results.push({
        index: i,
        ok: true,
        id: created.id,
        authType: fields.authType,
        hasRefreshToken: !!fields.refreshToken,
        email: created.email || fields.email || null,
      });
    } catch (err) {
      failed++;
      results.push({ index: i, ok: false, error: err.message });
    }
  }

  return NextResponse.json({
    provider,
    total: accounts.length,
    success,
    failed,
    oauthCount,
    apikeyCount,
    results,
  });
}
