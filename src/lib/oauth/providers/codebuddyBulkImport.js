import { uidFromJwt } from "./codebuddyUid";

/**
 * Normalize one raw CodeBuddy bulk-import entry into createProviderConnection
 * input. Shared by POST /api/oauth/codebuddy/bulk-import and its unit tests.
 *
 * Pure (no DB / no network) so it can be unit-tested. Throws when the entry is
 * not a usable object.
 *
 * `usedNames` (a lower-cased Set, mutated in place) is used to gap-fill a
 * collision-free "Key N" name for api_key-only rows — the backend upserts
 * apikey connections by name, so a reused name would overwrite an existing key.
 *
 * @param {object} raw
 * @param {{usedNames?: Set<string>}} [opts]
 */
export function normalizeCodeBuddyAccount(raw, opts = {}) {
  const usedNames = opts.usedNames instanceof Set ? opts.usedNames : new Set();

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Item is not an object");
  }

  const accessToken = raw.access_token || raw.accessToken || null;
  const refreshToken = raw.refresh_token || raw.refreshToken || null;
  const apiKey = raw.api_key || raw.apiKey || raw.key || raw.accessKey || null;
  const uid = raw.uid != null ? String(raw.uid) : uidFromJwt(accessToken);
  const email = raw.email || null;

  const hasOauth = !!accessToken;
  const hasApiKey = !!apiKey;

  if (!hasOauth && !hasApiKey) {
    throw new Error("Missing access_token/accessToken or api_key");
  }

  // OAuth is the only path that can perform the daily check-in, so when an
  // access_token is present we register the connection as OAuth. The API key
  // (when present) is still kept on the row: exported accounts often ship an
  // already-expired access_token with no refresh_token, and the api_key keeps
  // plain API calls working after that token lapses.
  const authType = hasOauth ? "oauth" : "apikey";

  let expiresAt = raw.expires_at || raw.expiresAt || null;
  const expiresIn = raw.expires_in || raw.expiresIn;
  if (!expiresAt && typeof expiresIn === "number" && expiresIn > 0) {
    expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  }

  const providerSpecificData = {
    ...(raw.providerSpecificData || {}),
    ...(uid ? { uid } : {}),
    ...(email ? { email } : {}),
    ...(hasOauth ? { authMethod: "device_code" } : {}),
    ...(hasApiKey && hasOauth ? { hasApiKeyFallback: true } : {}),
  };

  // OAuth rows get an auto name from the repo ("Account N"); api_key-only rows
  // need an explicit collision-free "Key N" (see usedNames note above).
  let name = raw.name || raw.displayName || raw.label || undefined;
  if (!name && hasApiKey && !hasOauth) {
    let idx = 1;
    while (usedNames.has(`key ${idx}`)) idx += 1;
    name = `Key ${idx}`;
    usedNames.add(name.toLowerCase());
  }

  return {
    authType,
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    apiKey: apiKey || null,
    expiresAt,
    email,
    name,
    displayName: raw.displayName || raw.name || undefined,
    providerSpecificData,
    testStatus: "active",
    isActive: true,
    hasOauth,
    hasApiKey,
  };
}
