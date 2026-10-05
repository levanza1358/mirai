"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { Card, CardSkeleton, SegmentedControl } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { providerHealth, formatTokens, formatCost } from "@/shared/utils/dashboardHome";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

const REFRESH_MS = 15000;

const emptyStats = {
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCachedTokens: 0,
  totalCompletionTokens: 0,
  totalCost: 0,
  recentRequests: [],
};

function json(url) {
  return fetch(url, { cache: "no-store" }).then((response) => (response.ok ? response.json() : null));
}

function providerName(id) {
  return AI_PROVIDERS[id]?.name || id;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function StatusDot({ ok }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-error"}`} />;
}

StatusDot.propTypes = { ok: PropTypes.bool };

function StatCard({ label, value, hint }) {
  return (
    <Card padding="sm">
      <div className="text-xs uppercase text-text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  hint: PropTypes.string,
};

export default function DashboardHome({ machineId }) {
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState({ stats: emptyStats, providers: [], models: [], logs: [], health: null, settings: null, tunnel: null, headroom: null });
  const [loading, setLoading] = useState(true);
  // Start empty so SSR and the first client render agree; window.location is only
  // available on the client, so reading it during render caused a hydration mismatch.
  const [baseUrl, setBaseUrl] = useState("");
  const { copied, copy } = useCopyToClipboard();
  const mounted = useRef(true);

  const load = useCallback(async (selectedPeriod = period) => {
    const results = await Promise.allSettled([
      json(`/api/usage/stats?period=${selectedPeriod}`),
      json("/api/providers"),
      json("/api/models"),
      json("/api/usage/request-logs"),
      json("/api/health"),
      json("/api/settings"),
      json("/api/tunnel/status"),
      json("/api/headroom/status"),
    ]);
    if (!mounted.current) return;
    const value = (index, fallback) => results[index].status === "fulfilled" && results[index].value ? results[index].value : fallback;
    setData({
      stats: { ...emptyStats, ...value(0, {}) },
      providers: value(1, {}).connections || [],
      models: value(2, {}).models || [],
      logs: value(3, []).slice(0, 8),
      health: value(4, null),
      settings: value(5, null),
      tunnel: value(6, null),
      headroom: value(7, null),
    });
    setLoading(false);
  }, [period]);

  useEffect(() => {
    mounted.current = true;
    setBaseUrl(window.location.origin);
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [load]);

  const health = data.health?.ok !== false;
  const grouped = useMemo(() => {
    const map = {};
    for (const connection of data.providers) {
      const id = connection.provider;
      if (!id) continue;
      const counts = providerHealth([connection])[id];
      if (!map[id]) map[id] = { total: 0, active: 0, rateLimited: 0, error: 0, models: 0 };
      map[id].total += 1;
      map[id].active += counts?.active || 0;
      map[id].rateLimited += counts?.rateLimited || 0;
      map[id].error += counts?.error || 0;
    }
    for (const model of data.models) if (map[model.provider]) map[model.provider].models += 1;
    return map;
  }, [data.providers, data.models]);
  const topModels = useMemo(() => {
    const byModel = data.stats.byModel || data.stats.models || {};
    return Object.entries(byModel).sort((a, b) => (b[1].requests || 0) - (a[1].requests || 0)).slice(0, 5);
  }, [data.stats]);

  const copyUrl = () => { if (baseUrl) copy(baseUrl); };
  return <div className="flex min-w-0 flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-text-muted">Routing overview{machineId ? ` · ${machineId.slice(0, 8)}` : ""}</p></div><button type="button" onClick={() => load()} className="rounded-lg border border-border px-3 py-2 text-sm">↻ Refresh</button></div>

    <Card padding="sm"><div className="flex flex-wrap items-center gap-5 text-sm"><span className="flex items-center gap-2"><StatusDot ok={health} /> Server {health ? "OK" : "Offline"}</span><button type="button" onClick={copyUrl} className="text-primary hover:underline">{copied ? "Copied" : `Base URL: ${baseUrl || "—"}`}</button><span className="text-text-muted">Tunnel: {data.tunnel?.connected ? "Connected" : "Off"}</span><span className="text-text-muted">Headroom: {data.headroom?.available ?? "—"}</span></div></Card>

    <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Usage summary</h2><SegmentedControl options={PERIODS} value={period} onChange={setPeriod} size="sm" /></div><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Requests", data.stats.totalRequests], ["Input Tokens", data.stats.totalPromptTokens], ["Cached", data.stats.totalCachedTokens], ["Output Tokens", data.stats.totalCompletionTokens], ["Est. Cost", `~$${formatCost(data.stats.totalCost)}`]].map(([label, value]) => <Card key={label} padding="sm"><div className="text-xs uppercase text-text-muted">{label}</div><div className="mt-1 text-xl font-bold">{typeof value === "number" ? formatTokens(value) : value}</div></Card>)}</div></section>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Providers</h2><Link href="/dashboard/providers" className="text-sm text-primary">Manage all</Link></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(grouped).map(([id, healthInfo]) => <Link key={id} href={`/dashboard/providers/${encodeURIComponent(id)}`} className="rounded-xl border border-border p-4 hover:border-primary"><div className="flex items-center gap-2 font-medium"><img src={getProviderIconSrc(id) || "/providers/default.png"} alt="" className="h-6 w-6" />{providerName(id)}</div><div className="mt-3 text-xs text-text-muted">{healthInfo.active || 0} active · {healthInfo.rateLimited || 0} rate-limited · {healthInfo.error || 0} error · {healthInfo.models} models</div></Link>)}{!Object.keys(grouped).length && <Card padding="sm"><span className="text-sm text-text-muted">No provider connections yet.</span></Card>}</div></section>

    <section className="grid gap-4 lg:grid-cols-2"><Card title="Models & top usage" action={<Link href="/dashboard/providers" className="text-sm text-primary">View models</Link>} padding="sm"><div className="mb-3 text-sm text-text-muted">{data.models.length} models · {data.models.filter((m) => m.custom).length} custom</div>{topModels.length ? topModels.map(([model, stats]) => <div key={model} className="flex justify-between border-b border-border py-2 text-sm"><span className="truncate pr-3">{model}</span><span className="text-text-muted">{formatNumber(stats.requests)}</span></div>) : <div className="text-sm text-text-muted">No usage recorded.</div>}</Card><Card title="Quick actions" padding="sm"><div className="grid grid-cols-2 gap-2 text-sm"><button type="button" onClick={copyUrl} className="rounded-lg border border-border p-2 text-left">{copied ? "Copied base URL" : "Copy Base URL"}</button><Link href="/dashboard/endpoint" className="rounded-lg border border-border p-2">Endpoint</Link><Link href="/dashboard/usage" className="rounded-lg border border-border p-2">Usage</Link><Link href="/dashboard/profile" className="rounded-lg border border-border p-2">Settings / port</Link><Link href="/dashboard/providers" className="rounded-lg border border-border p-2">Test providers</Link><button type="button" onClick={async () => { if (!window.confirm("Restart Mirai now?")) return; await fetch("/api/settings/port", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ port: Number(data.settings?.port || window.location.port || 1463) }) }); }} className="rounded-lg border border-border p-2 text-left">Restart</button></div></Card></section>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent activity</h2><Link href="/dashboard/usage?tab=details" className="text-sm text-primary">View all</Link></div><Card padding="none" className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-text-muted"><th className="p-3">Status</th><th className="p-3">Model</th><th className="p-3">Provider</th><th className="p-3">Time</th></tr></thead><tbody>{data.logs.map((log, index) => <tr key={log.id || index} className="border-b border-border last:border-0"><td className="p-3"><StatusDot ok={!log.status || log.status === "ok" || log.status === "success"} /></td><td className="p-3 font-mono">{log.model || "—"}</td><td className="p-3">{log.provider || "—"}</td><td className="p-3 text-text-muted">{log.timestamp || log.time || "—"}</td></tr>)}</tbody></table>{!data.logs.length && <div className="p-6 text-center text-sm text-text-muted">No recent activity.</div>}</Card></section>
    {loading && <CardSkeleton />}
  </div>;
}

DashboardHome.propTypes = { machineId: PropTypes.string };
