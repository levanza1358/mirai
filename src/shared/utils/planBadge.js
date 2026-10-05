/**
 * Subscription-plan badges for connected accounts.
 *
 * Providers expose their plan/tier under different keys, and the raw values
 * differ per provider (Codex: "plus"/"pro"/"free"; Antigravity: tier ids like
 * "free-tier" or display names like "Google AI Pro"). This module normalises
 * them into a single { label, className } shape the UI can render as a Badge.
 */

// Canonical rank → tone. Higher rank = "better" plan.
// Classnames are hand-picked (Tailwind) because the shared Badge has no
// purple/gold variants; we pass them straight through as className.
const TIER_STYLES = {
  free: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  plus: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pro: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  ultra: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function styleFor(key) {
  return TIER_STYLES[key] || "bg-surface-2 text-text-muted";
}

/**
 * Turn a raw plan string into a canonical key: free | plus | pro | ultra | null.
 * Order matters: check the strongest match first (an "ultra" tier may be
 * described as "Ultra Pro").
 */
export function canonicalPlanKey(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  if (v.includes("ultra")) return "ultra";
  if (v.includes("pro")) return "pro";
  if (v.includes("plus")) return "plus";
  if (
    v.includes("free") ||
    v.includes("basic") ||
    v.includes("trial") ||
    // Antigravity's entry tier reports its quota bucket as e.g.
    // "Antigravity Starter Quota" — that is the free plan, not a paid one.
    v.includes("starter") ||
    // Legacy Antigravity connections stored the generic product label as the
    // tier name; that only ever came from a free-tier account.
    v === "antigravity"
  ) {
    return "free";
  }
  // Unknown but non-empty tier — keep it visible as a "other" bucket.
  return "other";
}

/**
 * Build a display object for a plan value.
 * @param {string|null|undefined} raw
 * @returns {{ key: string, label: string, className: string } | null}
 */
export function getPlanBadge(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const key = canonicalPlanKey(text);
  if (!key) return null;
  if (key === "other") {
    return { key, label: text.toUpperCase(), className: "bg-surface-2 text-text-muted" };
  }
  return { key, label: key.toUpperCase(), className: styleFor(key) };
}

/**
 * Extract a plan string from a connection object.
 * Codex stores `chatgptPlanType`; Antigravity stores `tierName` / `tierId`.
 * @param {object} connection
 * @returns {string|null}
 */
export function getConnectionPlan(connection) {
  const psd = connection?.providerSpecificData || {};
  return (
    psd.tierName ||
    psd.planName ||
    psd.chatgptPlanType ||
    psd.plan ||
    psd.tierId ||
    null
  );
}
