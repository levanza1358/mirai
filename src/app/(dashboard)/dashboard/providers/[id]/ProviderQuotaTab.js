"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, ConfirmModal } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import ProviderLimitCard from "../../usage/components/ProviderLimits/ProviderLimitCard";
import {
  getConnectionLabel,
  parseQuotaData,
  getQuotaCache,
  setQuotaCache,
  REFRESH_INTERVAL_MS,
  aggregateCodeBuddyQuotas,
} from "../../usage/components/ProviderLimits/utils";

// CodeBuddy (CN/Intl) reports one row per credit package — a "Monthly" refill
// pack plus up to ~20 one-shot "Bonus Pack N" packs — which makes the card
// extremely tall. For the provider detail tab we collapse all packages of an
// account into a single line: one bar with the summed used/total, and a short
// subtitle summarising what was combined. Only this tab is affected; the
// global Quota Tracker keeps the per-package breakdown.
// (aggregateCodeBuddyQuotas lives in ProviderLimits/utils.js so it can be
// unit-tested and so the combined-quota rule is defined in one place.)

// Providers with a daily check-in (CodeBuddy CN claims a free daily credit
// allowance; intl has no claim endpoint — see the check-in service).
const CODEBUDDY_CHECKIN_PROVIDERS = new Set(["codebuddy-cn", "codebuddy-intl"]);

function getCodexResetCreditCount(quotaEntry) {
  const value = quotaEntry?.raw?.resetCredits?.availableCount;
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

/**
 * Show a bottom-right toast for a single-connection daily check-in result.
 * Mirrors the status codes returned by the codebuddy-checkin service.
 */
function notifyCheckinResult(notify, label, state) {
  if (!notify || !state) return;
  const title = `Daily check-in · ${label}`;
  const extra = state.streakDays ? ` (streak ${state.streakDays}d)` : "";
  switch (state.status) {
    case "checked-in":
      notify.success(
        `Checked in successfully${extra}${state.credit ? ` — +${state.credit} credits` : ""}.`,
        title,
      );
      break;
    case "already":
      notify.info(`Already checked in today${extra}.`, title);
      break;
    case "session-ok":
      notify.success(state.message || "Active session registered.", title);
      break;
    case "apikey-only":
      notify.warning(
        state.message ||
          "Check-in needs an OAuth (login) connection; API-key connections can only read status.",
        title,
      );
      break;
    case "unsupported":
      notify.info(state.message || "No daily check-in endpoint for this provider.", title);
      break;
    case "inactive":
      notify.warning(state.message || "Check-in activity is not open right now.", title);
      break;
    default:
      notify.error(state.message || "Check-in failed.", title);
  }
}

function formatCreditDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "N/A";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRemaining(value) {
  if (!value) return "N/A";
  const diffMs = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return "N/A";
  if (diffMs <= 0) return "Expired";
  const totalHours = Math.ceil(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

/**
 * Provider-scoped Quota tab.
 *
 * Shows only the quota / usage limits for the connections that belong to the
 * provider currently being viewed (unlike the global Quota page, which lists
 * every provider). Reuses the same quota fetching + card rendering as the
 * global page so the data stays consistent.
 */
export default function ProviderQuotaTab({ providerId, connections = [] }) {
  const notify = useNotificationStore();
  const [quotaData, setQuotaData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState("list");
  const [countdown, setCountdown] = useState(
    Math.round(REFRESH_INTERVAL_MS / 1000),
  );
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [resettingLimitId, setResettingLimitId] = useState(null);
  const [resetConfirmState, setResetConfirmState] = useState(null);
  const [resetCreditsState, setResetCreditsState] = useState(null);
  // Per-connection daily check-in status: { loading, checkedIn, status, message }.
  const [checkinState, setCheckinState] = useState({});
  const [checkinAllBusy, setCheckinAllBusy] = useState(false);
  const [checkinNotice, setCheckinNotice] = useState(null);

  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const connectionIds = useMemo(
    () => connections.map((c) => c.id),
    [connections],
  );

  const fetchQuota = useCallback(
    async (connectionId, provider, { force = false } = {}) => {
      setLoading((prev) => ({ ...prev, [connectionId]: true }));
      setErrors((prev) => ({ ...prev, [connectionId]: null }));

      try {
        const url = `/api/usage/${connectionId}${force ? "?force=1" : ""}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || response.statusText;

          // "No quota endpoint" style responses are informational, not errors.
          if (response.status === 404 || response.status === 401) {
            const quotaEntry = { quotas: [], message: errorMsg };
            setQuotaData((prev) => ({ ...prev, [connectionId]: quotaEntry }));
            setQuotaCache(connectionId, quotaEntry);
            return;
          }

          throw new Error(`HTTP ${response.status}: ${errorMsg}`);
        }

        const data = await response.json();
        const parsedQuotas = parseQuotaData(provider, data);

        const quotaEntry = {
          quotas: parsedQuotas,
          plan: data.plan || null,
          message: data.message || null,
          raw: data,
        };

        setQuotaData((prev) => ({ ...prev, [connectionId]: quotaEntry }));
        setQuotaCache(connectionId, quotaEntry);
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          [connectionId]: error.message || "Failed to fetch quota",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [connectionId]: false }));
      }
    },
    [],
  );

  // Seed from cache and fetch every connection for this provider.
  const fetchAll = useCallback(
    async ({ force = false } = {}) => {
      if (connectionIds.length === 0) return;

      // Hydrate cached entries immediately to avoid a flash of spinners.
      const cache = getQuotaCache();
      const seeded = {};
      for (const id of connectionIds) {
        if (cache[id]) seeded[id] = cache[id];
      }
      if (Object.keys(seeded).length > 0) {
        setQuotaData((prev) => ({ ...seeded, ...prev }));
      }

      setRefreshingAll(true);
      try {
        await Promise.all(
          connections.map((conn) => fetchQuota(conn.id, providerId, { force })),
        );
      } finally {
        setRefreshingAll(false);
      }
    },
    [connectionIds, connections, fetchQuota, providerId],
  );

  // Initial load + reload whenever the connection set changes.
  useEffect(() => {
    if (connectionIds.length === 0) {
      setQuotaData({});
      return;
    }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionIds.join(",")]);

  // Auto-refresh loop (mirrors the global quota page cadence).
  useEffect(() => {
    if (!autoRefresh || connectionIds.length === 0) return undefined;

    const resetCountdown = () =>
      setCountdown(Math.round(REFRESH_INTERVAL_MS / 1000));

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    intervalRef.current = setInterval(() => {
      fetchAll({ force: false });
      resetCountdown();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, connectionIds.join(",")]);

  // Redeem one Codex rate-limit reset credit, then refresh that account.
  const handleResetCodexLimit = useCallback(
    async (connectionId) => {
      if (resettingLimitId) return;

      setResettingLimitId(connectionId);
      setErrors((prev) => ({ ...prev, [connectionId]: null }));

      try {
        const response = await fetch(
          `/api/usage/${connectionId}/codex-reset-credits`,
          { method: "POST" },
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.message || result.error || result.code || "Failed to reset limit",
          );
        }

        await fetchQuota(connectionId, providerId, { force: true });
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          [connectionId]: error.message || "Failed to reset limit",
        }));
      } finally {
        setResettingLimitId(null);
      }
    },
    [fetchQuota, providerId, resettingLimitId],
  );

  // Load the list of Codex reset credits (with expiry) for the details modal.
  const handleViewResetCredits = useCallback(async (connection) => {
    setResetCreditsState({ connection, loading: true, error: null, data: null });
    try {
      const response = await fetch(
        `/api/usage/${connection.id}/codex-reset-credits`,
        { cache: "no-store" },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to load reset credits");
      }
      const credits = Array.isArray(result.credits) ? [...result.credits] : [];
      credits.sort((a, b) => {
        const aTime = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
      setResetCreditsState({
        connection,
        loading: false,
        error: null,
        data: { ...result, credits },
      });
    } catch (error) {
      setResetCreditsState({
        connection,
        loading: false,
        error: error.message || "Failed to load reset credits",
        data: null,
      });
    }
  }, []);

  // Perform (or refresh) the daily check-in for one CodeBuddy connection.
  // `silent` suppresses the toast for the "Check-in all" loop (it shows one
  // aggregated toast instead).
  const handleCheckin = useCallback(
    async (connection, { silent = false } = {}) => {
      const label = getConnectionLabel(connection) || connection.provider || "account";
      setCheckinState((prev) => ({
        ...prev,
        [connection.id]: { ...(prev[connection.id] || {}), loading: true },
      }));
      let next;
      try {
        const response = await fetch(
          `/api/usage/${connection.id}/codebuddy-checkin`,
          { method: "POST" },
        );
        const result = await response.json().catch(() => ({}));
        next = {
          loading: false,
          checkedIn: Boolean(result.checkedIn),
          alreadyCheckedIn: Boolean(result.alreadyCheckedIn),
          status: result.status || (response.ok ? "checked-in" : "failed"),
          message: result.message || result.error || "",
          streakDays: result.streakDays,
          credit: result.credit,
        };
      } catch (error) {
        next = {
          loading: false,
          checkedIn: false,
          alreadyCheckedIn: false,
          status: "failed",
          message: error.message || "Check-in failed",
        };
      }
      setCheckinState((prev) => ({ ...prev, [connection.id]: next }));
      if (!silent) notifyCheckinResult(notify, label, next);
      return next;
    },
    [notify],
  );

  // Load read-only check-in status for each CodeBuddy connection so the button
  // reflects the current day (checked in / streak) before the user acts.
  useEffect(() => {
    if (!CODEBUDDY_CHECKIN_PROVIDERS.has(providerId) || connectionIds.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const conn of connections) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(`/api/usage/${conn.id}/codebuddy-checkin`, {
            cache: "no-store",
          });
          // eslint-disable-next-line no-await-in-loop
          const result = await response.json().catch(() => ({}));
          if (cancelled) return;
          setCheckinState((prev) => {
            if (prev[conn.id]?.loading) return prev;
            return {
              ...prev,
              [conn.id]: {
                ...(prev[conn.id] || {}),
                loading: false,
                checkedIn: Boolean(result.todayCheckedIn) || Boolean(prev[conn.id]?.checkedIn),
                streakDays: result.streakDays,
                dailyCredit: result.dailyCredit,
                status: result.todayCheckedIn ? "already" : prev[conn.id]?.status,
              },
            };
          });
        } catch {
          // Status is best-effort.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, connectionIds.join(",")]);

  // Check every connected account in (sequentially, to be polite to upstream).
  const handleCheckinAll = useCallback(async () => {
    if (checkinAllBusy) return;
    setCheckinAllBusy(true);
    setCheckinNotice(null);
    let checked = 0;
    let already = 0;
    let unsupported = 0;
    let failed = 0;
    for (const conn of connections) {
      // eslint-disable-next-line no-await-in-loop
      const state = await handleCheckin(conn, { silent: true });
      if (state?.checkedIn) checked += 1;
      else if (state?.alreadyCheckedIn) already += 1;
      else if (state?.status === "apikey-only" || state?.status === "unsupported") unsupported += 1;
      else failed += 1;
    }
    setCheckinAllBusy(false);
    setCheckinNotice({ checked, already, unsupported, failed });

    // Aggregated toast (bottom-right) — mirrors the inline summary banner.
    const parts = [`${checked} checked in`];
    if (already > 0) parts.push(`${already} already done`);
    if (unsupported > 0) parts.push(`${unsupported} need OAuth login`);
    if (failed > 0) parts.push(`${failed} failed`);
    const summary = `Daily check-in: ${parts.join(", ")}.`;
    if (failed > 0) notify.warning(summary, "Daily check-in");
    else if (checked > 0) notify.success(summary, "Daily check-in");
    else notify.info(summary, "Daily check-in");
  }, [checkinAllBusy, connections, handleCheckin, notify]);

  if (connectionIds.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted opacity-20">
            data_usage
          </span>
          <p className="mt-2 text-sm text-text-muted">
            No accounts connected for this provider yet.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Add an account in the Accounts tab to see its quota here.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              autoRefresh
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-surface-2 text-text-muted hover:text-text-main"
            }`}
            title="Toggle automatic quota refresh"
          >
            <span className="material-symbols-outlined text-[16px]">
              {autoRefresh ? "autorenew" : "pause_circle"}
            </span>
            {autoRefresh ? `Auto ${countdown}s` : "Auto off"}
          </button>
          <span className="text-xs text-text-muted">
            {connectionIds.length} account{connectionIds.length === 1 ? "" : "s"}
          </span>
          {CODEBUDDY_CHECKIN_PROVIDERS.has(providerId) && (
            <button
              type="button"
              onClick={handleCheckinAll}
              disabled={checkinAllBusy}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              title="Check in every account now"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  checkinAllBusy ? "animate-spin" : ""
                }`}
              >
                {checkinAllBusy ? "progress_activity" : "event_available"}
              </span>
              {checkinAllBusy ? "Checking in…" : "Check-in all"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle: list (default) or grid */}
          <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="List view"
              aria-pressed={viewMode === "list"}
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "grid"
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-main"
              }`}
              title="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              Grid
            </button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={refreshingAll ? "hourglass_empty" : "refresh"}
            disabled={refreshingAll}
            onClick={() => fetchAll({ force: true })}
          >
            {refreshingAll ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {checkinNotice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${
            checkinNotice.failed > 0
              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">
              {checkinNotice.failed > 0 ? "info" : "check_circle"}
            </span>
            Daily check-in finished: {checkinNotice.checked} checked in
            {checkinNotice.already > 0 ? `, ${checkinNotice.already} already done` : ""}
            {checkinNotice.unsupported > 0
              ? `, ${checkinNotice.unsupported} need OAuth login`
              : ""}
            {checkinNotice.failed > 0 ? `, ${checkinNotice.failed} failed` : ""}.
          </span>
          <button
            type="button"
            onClick={() => setCheckinNotice(null)}
            className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Dismiss check-in summary"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* One card per connected account */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
            : "flex flex-col gap-4"
        }
      >
        {connections.map((conn) => {
          const entry = quotaData[conn.id];
          const aggregated = aggregateCodeBuddyQuotas(providerId, entry?.quotas || []);
          const resetCreditCount = getCodexResetCreditCount(entry);
          const isCodex = providerId === "codex";
          const isCheckin = CODEBUDDY_CHECKIN_PROVIDERS.has(providerId);
          const cbState = checkinState[conn.id];
          const cbRateLimited =
            entry?.raw?.requestExhausted === true &&
            (!entry?.raw?.resetAt ||
              new Date(entry.raw.resetAt).getTime() > Date.now())
              ? entry.raw.resetAt || "cycle refresh"
              : null;
          const cbLabel = cbState?.loading
            ? "Checking in…"
            : cbState?.checkedIn
              ? cbState?.streakDays
                ? `Checked in · ${cbState.streakDays}d`
                : "Checked in"
              : "Daily check-in";
          return (
            <ProviderLimitCard
              key={conn.id}
              provider={providerId}
              name={getConnectionLabel(conn) || providerId}
              plan={entry?.plan}
              quotas={aggregated.quotas}
              message={entry?.message || null}
              loading={!!loading[conn.id] && !entry}
              error={errors[conn.id] || null}
              onRefresh={() => fetchQuota(conn.id, providerId, { force: true })}
              availableResetCredits={isCodex ? resetCreditCount : null}
              resetting={resettingLimitId === conn.id}
              onResetCredit={() =>
                setResetConfirmState({ connection: conn, resetCreditCount })
              }
              onViewResetCredits={
                isCodex ? () => handleViewResetCredits(conn) : undefined
              }
              checkinState={
                isCheckin
                  ? {
                      loading: cbState?.loading,
                      checkedIn: cbState?.checkedIn,
                      label: cbLabel,
                      title:
                        cbState?.message ||
                        (cbState?.streakDays
                          ? `Current streak: ${cbState.streakDays} day(s)`
                          : "Claim the CodeBuddy daily check-in credit"),
                    }
                  : null
              }
              onCheckin={isCheckin ? () => handleCheckin(conn) : undefined}
              rateLimitedUntil={cbRateLimited}
            />
          );
        })}
      </div>

      <ConfirmModal
        isOpen={Boolean(resetConfirmState)}
        onClose={() => {
          if (!resettingLimitId) setResetConfirmState(null);
        }}
        onConfirm={async () => {
          const connection = resetConfirmState?.connection;
          if (!connection) return;
          await handleResetCodexLimit(connection.id);
          setResetConfirmState(null);
        }}
        title="Reset Codex limit?"
        message={`Use 1 Codex reset credit for ${
          getConnectionLabel(resetConfirmState?.connection || {}) || "this account"
        }. This cannot be undone. Remaining credits: ${
          resetConfirmState?.resetCreditCount ?? 0
        }.`}
        confirmText="Reset limit"
        cancelText="Cancel"
        variant="danger"
        loading={Boolean(resettingLimitId)}
      />

      {resetCreditsState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-black/15 bg-white shadow-2xl ring-1 ring-black/10 dark:border-white/15 dark:bg-neutral-950 dark:ring-white/10">
            <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text-primary">
                  Codex Reset Credit Expiry
                </h3>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {getConnectionLabel(resetCreditsState.connection) || "Codex account"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetCreditsState(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
                aria-label="Close reset credit expiry modal"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto bg-white p-4 dark:bg-neutral-950">
              {resetCreditsState.loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    progress_activity
                  </span>
                  Loading reset credits...
                </div>
              ) : resetCreditsState.error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
                  {resetCreditsState.error}
                </div>
              ) : resetCreditsState.data?.credits?.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                    <span>
                      {resetCreditsState.data.credits.length} reset credit
                      {resetCreditsState.data.credits.length === 1 ? "" : "s"}
                    </span>
                    <span>{resetCreditsState.data.availableCount ?? 0} available</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="bg-black/[0.03] text-xs uppercase tracking-wide text-text-muted dark:bg-white/[0.04]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Granted At</th>
                          <th className="px-3 py-2 font-medium">Expires At</th>
                          <th className="px-3 py-2 font-medium">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resetCreditsState.data.credits.map((credit, index) => (
                          <tr
                            key={`${credit.status}-${credit.expiresAt || index}`}
                            className="border-t border-black/5 dark:border-white/5"
                          >
                            <td className="px-3 py-2">
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {credit.status || "unknown"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-text-muted">
                              {formatCreditDate(credit.grantedAt)}
                            </td>
                            <td className="px-3 py-2 text-text-primary">
                              {formatCreditDate(credit.expiresAt)}
                            </td>
                            <td className="px-3 py-2 font-medium text-text-primary">
                              {formatTimeRemaining(credit.expiresAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-black/10 bg-black/[0.02] px-3 py-8 text-center text-sm text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                  No reset credit details returned for this account.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
