/**
 * CodeBuddy (CN / International) request-quota exhaustion cache — in-memory.
 *
 * CodeBuddy's base/refill pack ("体验版") is a request meter: once the cycle
 * balance reaches 0 the upstream answers 429/403 ("rate limited") for every
 * call until the next cycle refresh (CycleEndTime). Without this cache the
 * router keeps picking the dead account and every request burns a retry.
 *
 * Mirrors src/sse/services/antigravityQuota.js: the usage API result is
 * cached per connection and consulted by the auth.js pre-filter, and a
 * rate-limit error path refreshes the cache so exhaustion is learned even if
 * the operator never opens the Quota tab.
 */

import { getUsageForProvider } from "open-sse/services/usage.js";
import * as log from "../utils/logger.js";

// connectionId → { exhausted: boolean, resetAt: string|null, checkedAt: number }
const quotaCache = new Map();
// connectionId → last refresh timestamp (ms)
const lastRefreshAt = new Map();
// connectionId → in-flight refresh promise (dedup concurrent calls)
const inflight = new Map();

// Re-check at most once a minute per connection; the reset date only moves on a
// cycle boundary, so this is plenty and keeps a rate-limited provider cheap.
const MIN_REFRESH_INTERVAL_MS = 60_000;

export const CODEBUDDY_QUOTA_PROVIDERS = new Set(["codebuddy-cn", "codebuddy-intl"]);

export function isCodeBuddyQuotaProvider(provider) {
  return CODEBUDDY_QUOTA_PROVIDERS.has(provider);
}

/** Read-only reference for the auth.js pre-filter. */
export function getCodeBuddyQuotaCache() {
  return quotaCache;
}

/**
 * Record an exhaustion reading from an already-fetched usage payload.
 * No-op (returns null) when the payload has no request-meter signal.
 */
export function recordCodeBuddyUsage(connectionId, usage) {
  if (!connectionId || !usage || typeof usage !== "object") return null;
  if (usage.message) return null; // auth/quota API error, not a reading
  if (usage.requestExhausted === undefined) return null;

  const exhausted = usage.requestExhausted === true;
  const resetAt = exhausted ? usage.resetAt || null : null;
  const entry = { exhausted, resetAt, checkedAt: Date.now() };
  quotaCache.set(connectionId, entry);
  return entry;
}

/**
 * Refresh the cached reading for one connection from the live usage API.
 * Coalesces concurrent calls and throttles repeats. Returns the cache entry
 * or null when the reading is unavailable.
 */
export async function refreshCodeBuddyQuota(connectionId, connection, proxyOptions = null) {
  if (!connectionId || !connection) return null;
  if (!isCodeBuddyQuotaProvider(connection.provider)) return null;

  const now = Date.now();
  const pending = inflight.get(connectionId);
  if (pending) return pending;

  const last = lastRefreshAt.get(connectionId) || 0;
  if (now - last < MIN_REFRESH_INTERVAL_MS) {
    return quotaCache.get(connectionId) || null;
  }
  lastRefreshAt.set(connectionId, now);

  const promise = (async () => {
    try {
      const usage = await getUsageForProvider(connection, proxyOptions);
      const entry = recordCodeBuddyUsage(connectionId, usage);
      if (entry?.exhausted) {
        log.info(
          "CBCN_QUOTA",
          `${connectionId.slice(0, 8)} | request meter exhausted — block until ${entry.resetAt || "cycle refresh"}`
        );
      }
      return entry;
    } catch (e) {
      log.warn("CBCN_QUOTA", `${connectionId.slice(0, 8)} | refresh failed: ${e.message}`);
      return null;
    } finally {
      inflight.delete(connectionId);
    }
  })();

  inflight.set(connectionId, promise);
  return promise;
}

/**
 * Handler for a CodeBuddy rate-limit error (429/402/403).
 * Refreshes the cache and returns the reset timestamp (ms) when the base pack
 * is exhausted, so the chat handler can lock the account with a precise reset.
 * @returns {number|null} resetAt ms or null when unavailable
 */
export async function handleCodeBuddyQuotaError(connectionId, connection, status, proxyOptions = null) {
  if (!connectionId || !connection) return null;
  const entry = await refreshCodeBuddyQuota(connectionId, connection, proxyOptions);
  if (!entry?.exhausted || !entry.resetAt) {
    log.info("CBCN_QUOTA", `${connectionId.slice(0, 8)} | ${status} but no exhausted meter reading`);
    return null;
  }
  const resetMs = new Date(entry.resetAt).getTime();
  return Number.isFinite(resetMs) && resetMs > Date.now() ? resetMs : null;
}

/** Test helper: drop all cached state. */
export function _resetCodeBuddyQuotaCache() {
  quotaCache.clear();
  lastRefreshAt.clear();
  inflight.clear();
}
