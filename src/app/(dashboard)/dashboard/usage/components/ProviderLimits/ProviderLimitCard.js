"use client";

import { useState } from "react";
import Card from "@/shared/components/Card";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Badge from "@/shared/components/Badge";
import QuotaProgressBar from "./QuotaProgressBar";
import { calculatePercentage } from "./utils";

const planVariants = {
  free: "default",
  pro: "primary",
  ultra: "success",
  enterprise: "info",
};

// "in 3d 2h" style countdown for a future ISO timestamp (null when past/invalid).
function formatUntil(iso) {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const totalHours = Math.ceil(diffMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default function ProviderLimitCard({
  provider,
  name,
  plan,
  quotas = [],
  message = null,
  loading = false,
  error = null,
  onRefresh,
  // Optional rate-limit reset credits (Codex). When provided, a reset button
  // is rendered in the header. `availableResetCredits` is the number of credits
  // left; `onResetCredit` redeems one; `onViewResetCredits` opens a details view.
  availableResetCredits = null,
  resetting = false,
  onResetCredit,
  onViewResetCredits,
  // Optional daily check-in (CodeBuddy CN/Intl). When `onCheckin` is provided a
  // check-in button is rendered in the header. `checkinState` carries the
  // per-account status: { loading, checkedIn, label, title }.
  checkinState = null,
  onCheckin,
  // Optional request-meter exhaustion (CodeBuddy CN/Intl). When `rateLimited` is
  // a truthy ISO timestamp, a "rate limited until" banner is shown — the base
  // pack is used up and upstream refuses requests until it refreshes.
  rateLimitedUntil = null,
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const hasResetCredits = typeof availableResetCredits === "number";
  const resetCreditCount = hasResetCredits ? Math.max(0, availableResetCredits) : 0;

  // Get provider info from config
  const getProviderColor = () => {
    const colors = {
      github: "#000000",
      antigravity: "#4285F4",
      codex: "#10A37F",
      kiro: "#FF9900",
      qoder: "#EC4899",
      "qoder-cn": "#EC4899",
      claude: "#D97757",
    };
    return colors[provider?.toLowerCase()] || "#6B7280";
  };

  const providerColor = getProviderColor();
  const planVariant = planVariants[plan?.toLowerCase()] || "default";

  return (
    <Card padding="md" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Provider Logo */}
          <div
            className="size-10 rounded-lg flex items-center justify-center p-1.5"
            style={{ backgroundColor: `${providerColor}15` }}
          >
            <ProviderIcon
              src={`/providers/${provider}.png`}
              alt={provider || "Provider"}
              size={40}
              className="object-contain rounded-lg"
              fallbackText={provider?.slice(0, 2).toUpperCase() || "PR"}
              fallbackColor={providerColor}
            />
          </div>

          <div>
            <h3 className="font-semibold text-text-primary">
              {name || provider}
            </h3>
            {plan && (
              <Badge
                variant={planVariants[plan?.toLowerCase()] || "default"}
                size="xs"
              >
                {plan}
              </Badge>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-1">
          {onCheckin && (
            <button
              type="button"
              onClick={() => onCheckin()}
              disabled={checkinState?.loading || loading}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                checkinState?.checkedIn
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
              }`}
              title={checkinState?.title || "Daily check-in"}
              aria-label={checkinState?.label || "Daily check-in"}
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  checkinState?.loading ? "animate-spin" : ""
                }`}
              >
                {checkinState?.loading
                  ? "progress_activity"
                  : checkinState?.checkedIn
                    ? "check_circle"
                    : "event_available"}
              </span>
              <span>{checkinState?.label || "Check-in"}</span>
            </button>
          )}
          {hasResetCredits && (
            <button
              type="button"
              onClick={() => onResetCredit?.()}
              disabled={resetCreditCount <= 0 || resetting || loading}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                resetCreditCount > 0
                  ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                  : "border-border bg-surface-2 text-text-muted"
              }`}
              title={
                resetCreditCount > 0
                  ? `Use one reset credit. Available: ${resetCreditCount}`
                  : "No reset credits available"
              }
              aria-label={
                resetCreditCount > 0
                  ? `Use one reset credit. ${resetCreditCount} available.`
                  : "No reset credits available"
              }
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  resetting ? "animate-spin" : ""
                }`}
              >
                {resetting ? "progress_activity" : "restart_alt"}
              </span>
              <span>{resetCreditCount}</span>
            </button>
          )}
          {hasResetCredits && onViewResetCredits && (
            <button
              type="button"
              onClick={() => onViewResetCredits()}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="View reset credit expiry"
              aria-label="View reset credit expiry"
            >
              <span className="material-symbols-outlined text-[20px] text-text-muted">
                event_upcoming
              </span>
            </button>
          )}
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh quota"
          >
            <span
              className={`material-symbols-outlined text-[20px] text-text-muted ${
                refreshing || loading ? "animate-spin" : ""
              }`}
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
            <div className="h-2 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
            <div className="h-2 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-red-500 text-[20px]">
              error
            </span>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Info Message (for providers without API) */}
      {!loading && !error && message && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-500 text-[20px]">
              info
            </span>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {message}
            </p>
          </div>
        </div>
      )}

      {/* Rate-limited banner (CodeBuddy request meter exhausted) */}
      {!loading && !error && rateLimitedUntil && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[20px]">
              speed
            </span>
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Rate limited — request quota exhausted</p>
              <p className="text-xs opacity-90">
                Skipped by the router
                {formatUntil(rateLimitedUntil)
                  ? ` until it resets in ${formatUntil(rateLimitedUntil)}`
                  : ""}
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quota Progress Bars */}
      {!loading && !error && !message && quotas?.length > 0 && (
        <div className="space-y-4">
          {quotas.map((quota, index) => {
            // For Antigravity, use remainingPercentage if available, otherwise calculate
            const percentage =
              quota.remainingPercentage !== undefined
                ? Math.round(((quota.total - quota.used) / quota.total) * 100)
                : calculatePercentage(quota.used, quota.total);
            const unlimited = quota.total === 0 || quota.total === null;

            return (
              <QuotaProgressBar
                key={`${quota.name}-${index}`}
                label={quota.name}
                used={quota.used}
                total={quota.total}
                percentage={percentage}
                unlimited={unlimited}
                resetTime={quota.resetAt}
                recurring={quota.recurring !== false}
              />
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !message && quotas?.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          <span className="material-symbols-outlined text-[48px] opacity-20">
            data_usage
          </span>
          <p className="text-sm mt-2">No quota data available</p>
        </div>
      )}
    </Card>
  );
}
