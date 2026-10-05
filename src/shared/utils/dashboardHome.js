// Pure helpers for the dashboard home. Kept free of JSX so they can be unit-tested.

import { bucketConnections } from "@/shared/utils/accountBuckets";

/** Compact token formatter: 1500 -> "1.5K", 24000 -> "24K", 1000000 -> "1M". */
export function formatTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${trim(v / 1000000)}M`;
  if (v >= 1000) return `${trim(v / 1000)}K`;
  return String(v);
}

/** Compact cost formatter with ~ prefix handled by caller. */
export function formatCost(n) {
  const v = Number(n) || 0;
  if (v === 0) return "0.00";
  if (v < 0.0001) return "<0.0001";
  if (v < 0.01) return v.toFixed(4);
  if (v < 1) return v.toFixed(3);
  return v.toFixed(2);
}

/** "~$1.23" / "~$0.0041" — shared cost label so the tilde is never forgotten. */
export function formatCostLabel(n) {
  return `~$${formatCost(n)}`;
}

function trim(n) {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/**
 * Parse one usage log line, tolerating the variants written by usageDb:
 * "04-10-2026 23:50:28 | model | PROVIDER | acct | in | out | status"
 * "04-10-2026 23:50:28 | model | PROVIDER | acct | in | out | cache | status"
 * The final field is treated as the status; everything from index 4 is numeric.
 */
export function parseLogLine(line) {
  if (typeof line !== "string" || !line.includes("|")) return null;
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length < 7) return null;
  const status = parts[parts.length - 1];
  const numbers = parts.slice(4, parts.length - 1).map((p) => Number(p) || 0);
  return {
    time: parts[0],
    model: parts[1],
    provider: parts[2],
    account: parts[3],
    inTokens: numbers[0] || 0,
    outTokens: numbers[1] || 0,
    cachedTokens: numbers[2] || 0,
    status,
  };
}

/**
 * Normalize usage stats regardless of which keys the API returns, so the home
 * page renders identically for /api/usage/stats shapes.
 */
export function normalizeStats(raw) {
  const s = raw || {};
  const requests = s.totalRequests ?? s.requests ?? s.total?.requests ?? 0;
  const prompt = s.totalPromptTokens ?? s.promptTokens ?? s.total?.promptTokens ?? 0;
  const cached = s.totalCachedTokens ?? s.cachedTokens ?? s.cached ?? s.total?.cachedTokens ?? 0;
  const completion = s.totalCompletionTokens ?? s.completionTokens ?? s.total?.completionTokens ?? 0;
  const cost = s.totalCost ?? s.cost ?? s.total?.cost ?? 0;
  const byModel = s.byModel || s.models || s.total?.byModel || {};
  const byProvider = s.byProvider || s.providers || s.total?.byProvider || {};
  return {
    totalRequests: Number(requests) || 0,
    totalPromptTokens: Number(prompt) || 0,
    totalCachedTokens: Number(cached) || 0,
    totalCompletionTokens: Number(completion) || 0,
    totalCost: Number(cost) || 0,
    byModel,
    byProvider,
  };
}

/** Total tokens (prompt + completion) — handy for hints and sorting. */
export function totalTokens(stats) {
  return (Number(stats?.totalPromptTokens) || 0) + (Number(stats?.totalCompletionTokens) || 0);
}

/** Cache hit rate as an integer percent: cached / (cached + prompt). */
export function cacheHitRate(stats) {
  const cached = Number(stats?.totalCachedTokens) || 0;
  const prompt = Number(stats?.totalPromptTokens) || 0;
  const denom = cached + prompt;
  if (!denom) return 0;
  return Math.round((cached / denom) * 100);
}

/** Average cost per request, formatted as a plain number string. */
export function averageCost(stats) {
  const requests = Number(stats?.totalRequests) || 0;
  if (!requests) return "0.00";
  return formatCost((Number(stats?.totalCost) || 0) / requests);
}

/** Aggregate connections into per-provider { total, active, rateLimited, error } counts. */
export function providerHealth(connections) {
  const map = {};
  for (const conn of connections || []) {
    const id = conn.provider;
    if (!id) continue;
    if (!map[id]) map[id] = { total: 0, active: 0, rateLimited: 0, error: 0 };
    map[id].total += 1;
  }
  const bucket = bucketConnections(connections || []);
  for (const [name, list] of Object.entries(bucket)) {
    for (const conn of list) {
      const id = conn.provider;
      if (map[id]) map[id][name] = (map[id][name] || 0) + 1;
    }
  }
  return map;
}

/**
 * Group a flat connection list into per-provider health plus a model count map.
 * `modelCount` is `{ providerId: number }` derived from the models API.
 */
export function groupProviders(connections, modelCount = {}) {
  const health = providerHealth(connections || []);
  const grouped = {};
  for (const [id, counts] of Object.entries(health)) {
    grouped[id] = { ...counts, models: Number(modelCount[id]) || 0 };
  }
  return grouped;
}

/** Statuses that should render as a failure dot in recent activity. */
const FAILURE_STATUSES = new Set(["error", "failed", "fail", "rate_limited", "rate-limited", "429", "401", "403", "500"]);

/** True when a log status should be shown as success. */
export function isLogSuccess(status) {
  const s = String(status || "ok").toLowerCase();
  return !FAILURE_STATUSES.has(s);
}

/** Sort by-model usage entries descending and keep the top N. */
export function topModels(byModel, limit = 5) {
  return Object.entries(byModel || {})
    .map(([model, stats]) => [model, stats && typeof stats === "object" ? stats : { requests: Number(stats) || 0 }])
    .sort((a, b) => (b[1].requests || 0) - (a[1].requests || 0))
    .slice(0, limit);
}
