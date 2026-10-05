"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RequestLogger, CardSkeleton, SegmentedControl } from "@/shared/components";
import UsageStats from "@/shared/components/UsageStats";
import RequestDetailsTab from "./components/RequestDetailsTab";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
];

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [period, setPeriod] = useState("today");

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && ["overview", "logs", "details"].includes(tabFromUrl)
    ? tabFromUrl
    : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
  };

  const tabs = [
    { value: "overview", label: "Overview", icon: "insights" },
    { value: "logs", label: "Request logs", icon: "list_alt" },
    { value: "details", label: "Details", icon: "manage_search" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-5 px-1 sm:px-0">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <span className="material-symbols-outlined text-[17px]">monitoring</span>
              Analytics
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">Usage overview</h1>
            <p className="mt-1 max-w-xl text-sm text-text-muted">Track requests, token flow, provider health, and estimated spend in one place.</p>
          </div>
          {activeTab === "overview" && (
            <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} size="sm" className="w-full lg:w-auto" />
          )}
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-bg-subtle p-1" aria-label="Usage sections">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab.value)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.value ? "bg-surface text-text shadow-sm" : "text-text-muted hover:bg-surface/60 hover:text-text"}`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <Suspense fallback={<CardSkeleton />}>
          <UsageStats period={period} setPeriod={setPeriod} hidePeriodSelector />
        </Suspense>
      )}
      {activeTab === "logs" && <RequestLogger />}
      {activeTab === "details" && <RequestDetailsTab />}
    </div>
  );
}
