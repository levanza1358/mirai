"use client";

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { CapacityBadges } from "@/shared/components";

// Small inline alias editor: shows existing alias with edit/remove buttons, or
// a "+ Alias" affordance when none is set. Saving/removing is delegated up.
function AliasCell({ alias, onSetAlias, onDeleteAlias }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alias || "");

  useEffect(() => { setValue(alias || ""); }, [alias]);

  const save = () => {
    const next = value.trim();
    if (!next) { setEditing(false); return; }
    if (next === alias) { setEditing(false); return; }
    onSetAlias(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(alias || ""); setEditing(false); }
          }}
          placeholder="alias name"
          className="w-28 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs focus:border-primary focus:outline-none"
        />
        <button
          onClick={save}
          title="Save alias"
          className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary"
        >
          <span className="material-symbols-outlined text-sm">check</span>
        </button>
        <button
          onClick={() => { setValue(alias || ""); setEditing(false); }}
          title="Cancel"
          className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-red-500"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>
    );
  }

  if (alias) {
    return (
      <div className="flex items-center gap-1">
        <code className="rounded bg-sidebar px-1.5 py-0.5 font-mono text-xs text-primary">{alias}</code>
        <button
          onClick={() => setEditing(true)}
          title="Edit alias"
          className="rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-sidebar hover:text-primary group-hover/row:opacity-100"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
        <button
          onClick={() => onDeleteAlias()}
          title="Remove alias"
          className="rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover/row:opacity-100"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
    );
  }

  if (!onSetAlias) return <span className="text-xs text-text-muted/40">—</span>;

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-0.5 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] text-text-muted transition-colors hover:border-primary/40 hover:text-primary"
    >
      <span className="material-symbols-outlined text-[13px]">add</span>
      Alias
    </button>
  );
}

AliasCell.propTypes = {
  alias: PropTypes.string,
  onSetAlias: PropTypes.func,
  onDeleteAlias: PropTypes.func,
};

function StatusCell({ status, isDisabled }) {
  if (isDisabled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
        <span className="material-symbols-outlined text-sm">block</span>
        Disabled
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <span className="material-symbols-outlined text-sm">check_circle</span>
        OK
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500">
        <span className="material-symbols-outlined text-sm">cancel</span>
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted/60">
      <span className="material-symbols-outlined text-sm">radio_button_unchecked</span>
      Untested
    </span>
  );
}

StatusCell.propTypes = {
  status: PropTypes.oneOf(["ok", "error"]),
  isDisabled: PropTypes.bool,
};

// Compact token-count formatter: 1000000 -> "1M", 200000 -> "200k".
function formatTokens(n) {
  if (!n || typeof n !== "number") return "—";
  if (n >= 1000000) {
    const m = n / 1000000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return String(n);
}

// Table view of a provider's models. Rows are pre-built by the parent so this
// component stays presentational (sorting/segmenting is done upstream).
export default function ModelsTable({ rows, copied, onCopy }) {
  const headers = ["Model", "Name", "Context", "Max Out", "Capabilities", "Alias", "Status", "Actions"];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-sidebar/60">
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const copiedNow = copied === `model-${row.id}`;
            return (
              <tr
                key={row.key}
                className="group/row border-b border-border/60 last:border-b-0 hover:bg-sidebar/40"
              >
                {/* Model */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-xs text-text-main">{row.displayModel}</code>
                    {row.isFree && (
                      <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[10px] font-medium text-emerald-500">
                        free
                      </span>
                    )}
                    {row.isCustom && (
                      <span className="rounded bg-blue-500/10 px-1 py-0.5 text-[10px] font-medium text-blue-500">
                        custom
                      </span>
                    )}
                  </div>
                </td>

                {/* Name */}
                <td className="px-3 py-2">
                  <span className="text-xs italic text-text-muted">{row.name || "—"}</span>
                </td>

                {/* Context window */}
                <td className="whitespace-nowrap px-3 py-2">
                  {(() => {
                    const ctx = row.contextWindow ?? row.caps?.contextWindow;
                    return (
                      <span
                        className="font-mono text-xs text-text-muted"
                        title={ctx ? `${ctx.toLocaleString()} tokens` : "Unknown"}
                      >
                        {formatTokens(ctx)}
                      </span>
                    );
                  })()}
                </td>

                {/* Max output tokens */}
                <td className="whitespace-nowrap px-3 py-2">
                  {(() => {
                    const out = row.maxOutput ?? row.caps?.maxOutput;
                    return (
                      <span
                        className="font-mono text-xs text-text-muted"
                        title={out ? `${out.toLocaleString()} tokens` : "Unknown"}
                      >
                        {formatTokens(out)}
                      </span>
                    );
                  })()}
                </td>

                {/* Capabilities */}
                <td className="px-3 py-2">
                  <CapacityBadges caps={row.caps} colorOverride="text-text-muted/70" size={14} />
                </td>

                {/* Alias */}
                <td className="px-3 py-2">
                  <AliasCell
                    alias={row.alias}
                    onSetAlias={row.onSetAlias}
                    onDeleteAlias={row.onDeleteAlias}
                  />
                </td>

                {/* Status */}
                <td className="px-3 py-2">
                  <StatusCell status={row.testStatus} isDisabled={row.isDisabled} />
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {row.onTest && (
                      <button
                        onClick={row.onTest}
                        disabled={row.isTesting}
                        title={row.isTesting ? "Testing..." : "Test model"}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-sidebar hover:text-primary disabled:opacity-60"
                      >
                        <span
                          className={`material-symbols-outlined text-base ${row.isTesting ? "animate-spin" : ""}`}
                        >
                          {row.isTesting ? "progress_activity" : "science"}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => onCopy(row.displayModel, `model-${row.id}`)}
                      title={copiedNow ? "Copied!" : "Copy model id"}
                      className="rounded p-1 text-text-muted transition-colors hover:bg-sidebar hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-base">
                        {copiedNow ? "check" : "content_copy"}
                      </span>
                    </button>
                    {row.isDisabled ? (
                      <button
                        onClick={row.onEnable}
                        title="Restore model"
                        className="rounded p-1 text-text-muted transition-colors hover:bg-emerald-500/10 hover:text-emerald-500"
                      >
                        <span className="material-symbols-outlined text-base">restart_alt</span>
                      </button>
                    ) : (
                      <button
                        onClick={row.isCustom ? row.onDeleteCustom : row.onDisable}
                        title={row.isCustom ? "Remove custom model" : "Disable this model"}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <span className="material-symbols-outlined text-base">
                          {row.isCustom ? "delete" : "block"}
                        </span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

ModelsTable.propTypes = {
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      displayModel: PropTypes.string.isRequired,
      name: PropTypes.string,
      caps: PropTypes.object,
      contextWindow: PropTypes.number,
      maxOutput: PropTypes.number,
      alias: PropTypes.string,
      testStatus: PropTypes.oneOf(["ok", "error"]),
      isTesting: PropTypes.bool,
      isDisabled: PropTypes.bool,
      isCustom: PropTypes.bool,
      isFree: PropTypes.bool,
      onTest: PropTypes.func,
      onCopy: PropTypes.func,
      onSetAlias: PropTypes.func,
      onDeleteAlias: PropTypes.func,
      onDisable: PropTypes.func,
      onEnable: PropTypes.func,
      onDeleteCustom: PropTypes.func,
    })
  ).isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
};
