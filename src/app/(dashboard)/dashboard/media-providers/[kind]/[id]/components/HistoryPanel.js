"use client";

import { Card } from "@/shared/components";
import ResultView from "./ResultView";

/**
 * HistoryPanel — persistent generation history for a media provider + kind.
 *
 * Entries are stored in localStorage (browser-only) so they survive refreshes
 * and tab switches without any backend/DB involvement. Images in the record are
 * the provider URLs / data-URLs themselves, so replaying a record just re-renders
 * that same ResultView payload.
 */
const MAX_ITEMS = 50;

export default function HistoryPanel({ records = [], onClear, onRemove }) {
  if (records.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="size-14 rounded-2xl flex items-center justify-center bg-surface-2 text-text-muted">
            <span className="material-symbols-outlined text-[28px]">history</span>
          </div>
          <div>
            <p className="text-sm font-medium text-text-main">No history yet</p>
            <p className="text-xs text-text-muted mt-0.5">
              Generated results appear here and are kept on this device (last {MAX_ITEMS}).
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle bg-surface-2/40">
        <span className="material-symbols-outlined text-[18px] text-text-muted">history</span>
        <h3 className="text-sm font-semibold text-text-main flex-1">
          {records.length} {records.length === 1 ? "entry" : "entries"}
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-text-muted hover:text-text-main transition-colors inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
          Clear all
        </button>
      </div>

      <div className="flex flex-col">
        {records.map((rec, index) => (
          <div key={rec.id} className="flex flex-col gap-3 px-5 py-4 border-b border-border-subtle last:border-b-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-text-muted shrink-0">
                #{records.length - index}
              </span>
              <span className="text-[11px] text-text-muted shrink-0">
                {formatWhen(rec.createdAt)}
              </span>
              {rec.model && (
                <span className="text-[11px] text-text-muted truncate max-w-[200px]" title={rec.model}>
                  {rec.model}
                </span>
              )}
              {typeof rec.latency === "number" && (
                <span className="text-[11px] text-text-muted shrink-0">{rec.latency} ms</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(rec.id)}
                title="Remove entry"
                className="ml-auto text-text-muted hover:text-red-500 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <p className="text-xs text-text-main whitespace-pre-wrap break-words line-clamp-3">{rec.prompt}</p>

            {rec.result ? <ResultView result={rec.result} /> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleString();
}
