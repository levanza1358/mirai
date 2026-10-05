import { MODEL_LOCK_PREFIX } from "open-sse/services/accountFallback.js";

/**
 * Find the earliest *active* model lock expiry on a connection, comparing every
 * flat `modelLock_*` field against the supplied `now` (ms). Returns the epoch ms
 * or null. Unlike getEarliestModelLockUntil this honours an injected clock,
 * which keeps classification deterministic in tests.
 */
function earliestActiveModelLock(conn, now) {
  if (!conn) return null;
  let earliest = null;
  for (const [key, val] of Object.entries(conn)) {
    if (!key.startsWith(MODEL_LOCK_PREFIX) || !val) continue;
    const t = new Date(val).getTime();
    if (!Number.isFinite(t) || t <= now) continue;
    if (earliest === null || t < earliest) earliest = t;
  }
  return earliest;
}

/**
 * Classify a connection row into one of the Accounts tab buckets:
 * "active", "rateLimited", or "error".
 *
 * Rate limited = the connection is enabled (isActive !== false) and either an
 * active model lock (modelLock_*) or a future rateLimitedUntil timestamp is set.
 * Error = testStatus reports error / expired (and it is not currently rate
 * limited). testStatus "unavailable" with no active cooldown counts as active.
 * Everything else is active.
 */
export function classifyConnection(conn, now = Date.now()) {
  if (!conn) return "active";
  const lockUntil = earliestActiveModelLock(conn, now);
  const rateUntil = conn.rateLimitedUntil ? new Date(conn.rateLimitedUntil).getTime() : 0;
  const inCooldown =
    conn.isActive !== false && (lockUntil !== null || (Number.isFinite(rateUntil) && rateUntil > now));
  if (inCooldown) return "rateLimited";

  const status = conn.testStatus;
  // "unavailable" is the marker markAccountUnavailable() stamps alongside a
  // temporary modelLock_* cooldown (429 / 5xx / transient). Once that cooldown
  // has expired there is no active lock left, so the account is healthy again —
  // otherwise a single transient rate limit would lock it until a manual Test.
  // "error" / "expired" (e.g. 401 invalid key) stay in the error bucket until a
  // successful request or a manual Test clears them.
  if (status === "error" || status === "expired") return "error";
  return "active";
}

/**
 * Bucket a list of connections into { active, rateLimited, error } preserving
 * the original order within each bucket.
 */
export function bucketConnections(connections, now = Date.now()) {
  const buckets = { active: [], rateLimited: [], error: [] };
  for (const conn of connections || []) {
    buckets[classifyConnection(conn, now)].push(conn);
  }
  return buckets;
}
