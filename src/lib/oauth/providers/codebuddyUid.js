/**
 * Extract the CodeBuddy account uid from an OAuth access token.
 *
 * CodeBuddy (CN and intl) issues Keycloak-style JWTs whose `sub` claim is the
 * account uid used by the daily check-in endpoint (X-User-Id header). The token
 * is not always a JWT (API-key connections have opaque tokens), so callers must
 * treat a null result as "unknown" and fall back to providerSpecificData.uid.
 *
 * @param {string} token
 * @returns {string|null}
 */
export function uidFromJwt(token) {
  try {
    const segment = String(token || "").split(".")[1];
    if (!segment) return null;
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const sub = payload?.sub || payload?.uid;
    return sub ? String(sub) : null;
  } catch {
    return null;
  }
}
