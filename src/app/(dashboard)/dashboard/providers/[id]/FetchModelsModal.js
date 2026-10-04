"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { Button, Modal } from "@/shared/components";

/**
 * Fetch the provider's live model catalog and let the user pick which models
 * to add as custom models.
 *
 * Existing models (built-in to the provider, already added as custom, or
 * covered by an alias) are shown pre-checked and LOCKED — the checkbox cannot
 * be unchecked, because they are already in the list. New models are
 * pre-checked and can be unchecked.
 */
export default function FetchModelsModal({
  isOpen,
  connectionId,
  providerDisplayAlias,
  existingModelIds,
  onSaveSelected,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [warning, setWarning] = useState("");
  const [models, setModels] = useState([]);
  const [checked, setChecked] = useState(() => new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const existingSet = useMemo(
    () => new Set((existingModelIds || []).map((id) => String(id))),
    [existingModelIds],
  );

  // Normalise whatever shape each provider returns into { id, name }.
  const normalise = useCallback((list) => {
    const seen = new Set();
    const out = [];
    for (const raw of list || []) {
      const id = raw?.id || raw?.name || raw?.model || raw?.slug;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id: String(id), name: String(raw?.name || raw?.displayName || id) });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  // (Re)load the catalog each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setFetchError("");
    setWarning("");
    setModels([]);
    setChecked(new Set());
    setSearch("");

    if (!connectionId) {
      setLoading(false);
      setFetchError("Add an active connection first, then fetch its models.");
      return () => { cancelled = true; };
    }

    fetch(`/api/providers/${connectionId}/models`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setFetchError(data?.error || "Failed to fetch models from this provider.");
          return;
        }
        const list = normalise(data?.models);
        if (list.length === 0) {
          setFetchError("This provider returned no models.");
          if (data?.warning) setWarning(String(data.warning));
          return;
        }
        setModels(list);
        if (data?.warning) setWarning(String(data.warning));
        // Pre-check everything (existing are locked; new are toggleable).
        setChecked(new Set(list.map((m) => m.id)));
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err?.message || "Failed to fetch models from this provider.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, connectionId, normalise]);

  const isExisting = useCallback(
    (id) =>
      existingSet.has(id) ||
      Array.from(existingSet).some(
        (existing) => existing === id || existing.endsWith(`/${id}`) || id.endsWith(`/${existing}`),
      ),
    [existingSet],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
    );
  }, [models, search]);

  const existingCount = useMemo(
    () => models.filter((m) => isExisting(m.id)).length,
    [models, isExisting],
  );
  const newSelectedCount = useMemo(
    () => models.filter((m) => checked.has(m.id) && !isExisting(m.id)).length,
    [models, checked, isExisting],
  );

  const toggle = (id) => {
    if (isExisting(id)) return; // locked
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllNew = () => setChecked(new Set(models.map((m) => m.id)));
  const clearAllNew = () =>
    setChecked(new Set(models.filter((m) => isExisting(m.id)).map((m) => m.id)));

  const handleSave = async () => {
    if (saving) return;
    const toAdd = models.filter((m) => checked.has(m.id) && !isExisting(m.id)).map((m) => m.id);
    setSaving(true);
    try {
      await onSaveSelected(toAdd);
    } finally {
      setSaving(false);
    }
  };

  const canSave = !loading && !fetchError && newSelectedCount > 0 && !saving;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fetch Models" size="full">
      <div className="flex flex-col gap-4">
        {providerDisplayAlias && (
          <p className="text-xs text-text-muted">
            Live catalog from <code className="font-mono bg-sidebar px-1 rounded">{providerDisplayAlias}</code>.
            Models already in your list are checked and locked.
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-text-muted">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Fetching models…
          </div>
        )}

        {!loading && fetchError && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
            <span className="material-symbols-outlined text-base shrink-0">info</span>
            <span>{fetchError}</span>
          </div>
        )}

        {!loading && !fetchError && (
          <>
            {warning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined text-sm shrink-0">warning</span>
                <span>{warning}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models…"
                className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
              />
              <Button variant="ghost" size="sm" onClick={selectAllNew}>Select all</Button>
              <Button variant="ghost" size="sm" onClick={clearAllNew}>Clear</Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span>{models.length} model{models.length === 1 ? "" : "s"}</span>
              <span>·</span>
              <span>{existingCount} existing</span>
              <span>·</span>
              <span className="text-primary font-medium">{newSelectedCount} new selected</span>
            </div>

            <div className="rounded-lg border border-border divide-y divide-border">
              {filtered.length === 0 && (
                <p className="p-4 text-sm text-text-muted text-center">No models match “{search}”.</p>
              )}
              {filtered.map((m) => {
                const existing = isExisting(m.id);
                const isChecked = existing || checked.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 px-3 py-2 transition-colors ${existing ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={existing}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      {m.name !== m.id && (
                        <p className="truncate text-[11px] text-text-muted font-mono">{m.id}</p>
                      )}
                    </div>
                    {existing && (
                      <span className="shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] text-text-muted">
                        existing
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={onClose} variant="ghost" fullWidth size="sm" disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} fullWidth size="sm" disabled={!canSave}>
            {saving ? "Adding…" : `Add Selected (${newSelectedCount})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

FetchModelsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  connectionId: PropTypes.string,
  providerDisplayAlias: PropTypes.string,
  existingModelIds: PropTypes.arrayOf(PropTypes.string),
  onSaveSelected: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
