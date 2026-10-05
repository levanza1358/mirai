"use client";

import { useState, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, ConfirmModal, CapacityBadges, Select, Toggle } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { aggregateComboCapabilities } from "open-sse/providers/capabilities.js";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Capacity adapter: global fallback pools of models per input-modality capability.
// A request needing a capability the target model/combo lacks switches straight
// to the first enabled model here instead of erroring or dropping the data.
const CAPACITY_ADAPTER_CAPS = [
  { key: "vision", label: "Vision", icon: "visibility", desc: "images (png, jpg, webp, …)" },
  // pdf, videoInput temporarily hidden — no translator support yet for those blocks.
  { key: "audioInput", label: "Audio", icon: "graphic_eq", desc: "audio input" },
];
const DEFAULT_FALLBACK_MODEL = "oc/mimo-v2.6-flash-free";
const EMPTY_CAP_ENTRY = { enabled: true, roundRobin: false, models: [] };
const EMPTY_CAPACITY_ADAPTER = {
  vision: { ...EMPTY_CAP_ENTRY },
  pdf: { ...EMPTY_CAP_ENTRY },
  audioInput: { ...EMPTY_CAP_ENTRY },
  videoInput: { ...EMPTY_CAP_ENTRY },
};
const upgradeLegacyModel = (m) => (m === "oc/mimo-v2.5-free" ? DEFAULT_FALLBACK_MODEL : m);

// Backward-compat: legacy stored form was an array of {model, enabled}.
function normalizeCapEntry(entry) {
  if (Array.isArray(entry)) {
    return { enabled: true, roundRobin: false, models: entry.map((e) => upgradeLegacyModel(e?.model || e)).filter(Boolean) };
  }
  if (entry && typeof entry === "object") {
    return {
      enabled: entry.enabled !== false,
      roundRobin: !!entry.roundRobin,
      models: Array.isArray(entry.models) ? entry.models.map(upgradeLegacyModel).filter(Boolean) : [],
    };
  }
  return { ...EMPTY_CAP_ENTRY };
}

const STRATEGY_OPTIONS = [
  { value: "fallback", label: "Fallback — try in order" },
  { value: "round-robin", label: "Round Robin — rotate" },
  { value: "fusion", label: "Fusion — panel + judge" },
];

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [capacityAdapter, setCapacityAdapter] = useState(EMPTY_CAPACITY_ADAPTER);
  const [confirmState, setConfirmState] = useState(null);
  const [presetLoading, setPresetLoading] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [selectMode, setSelectMode] = useState(false);
  const { getCaps } = useModelCaps();
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => { fetchData(); }, []);
  const selectedCombos = combos.filter((c) => selectedIds.includes(c.id));
  const allSelected = combos.length > 0 && selectedIds.length === combos.length;
  const visibleCombos = combos.filter((combo) => {
    const strategy = comboStrategies[combo.name]?.fallbackStrategy || "fallback";
    return combo.name.toLowerCase().includes(search.toLowerCase()) && (strategyFilter === "all" || strategy === strategyFilter);
  }).sort((a, b) => sortBy === "models" ? b.models.length - a.models.length : sortBy === "strategy" ? (comboStrategies[b.name]?.fallbackStrategy || "fallback").localeCompare(comboStrategies[a.name]?.fallbackStrategy || "fallback") : a.name.localeCompare(b.name));

  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : visibleCombos.map((c) => c.id));
  const clearSelection = () => setSelectedIds([]);

  async function fetchData() {
    try {
      const [combosRes, providersRes, settingsRes] = await Promise.all([fetch("/api/combos"), fetch("/api/providers"), fetch("/api/settings")]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      if (combosRes.ok) setCombos((combosData.combos || []).filter((c) => !c.kind || c.kind === "llm"));
      if (providersRes.ok) setActiveProviders(providersData.connections || []);
      setComboStrategies(settingsData.comboStrategies || {});
      const raw = settingsData.capacityAdapter || {};
      setCapacityAdapter(Object.fromEntries(CAPACITY_ADAPTER_CAPS.map((cap) => [cap.key, normalizeCapEntry(raw[cap.key])] )));
    } catch (error) { console.log("Error fetching combos:", error); } finally { setLoading(false); }
  };

  const persistSettings = async (patch) => {
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  };
  const handleSetCapacityAdapter = async (next) => { setCapacityAdapter(next); try { await persistSettings({ capacityAdapter: next }); } catch (error) { console.log("Error updating adapter:", error); } };
  const handleCreate = async (data) => {
    const res = await fetch("/api/combos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) { await fetchData(); setShowCreateModal(false); } else { const err = await res.json(); alert(err.error || "Failed to create combo"); }
  };
  const handleUpdate = async (id, data) => {
    const res = await fetch(`/api/combos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) { await fetchData(); setEditingCombo(null); } else { const err = await res.json(); alert(err.error || "Failed to update combo"); }
  };
  const persistStrategies = async (next) => { await persistSettings({ comboStrategies: next }); setComboStrategies(next); };
  const handleSetStrategy = async (name, value) => { const next = { ...comboStrategies }; if (value === "fallback") delete next[name]; else next[name] = { ...(next[name] || {}), fallbackStrategy: value }; await persistStrategies(next); };
  const handleDelete = (id) => {
    const combo = combos.find((c) => c.id === id);
    setConfirmState({ title: "Delete combo", message: `Delete ${combo?.name || "this combo"}?`, variant: "danger", confirmText: "Delete", onConfirm: async () => { setConfirmState((s) => ({ ...s, loading: true })); const res = await fetch(`/api/combos/${id}`, { method: "DELETE" }); if (res.ok) { setCombos((prev) => prev.filter((c) => c.id !== id)); setSelectedIds((prev) => prev.filter((x) => x !== id)); } setConfirmState(null); } });
  };
  const handleBulkDelete = () => { if (!selectedCombos.length) return; setConfirmState({ title: "Delete selected combos", message: `Delete ${selectedCombos.length} combos?`, variant: "danger", confirmText: "Delete", onConfirm: async () => { setBulkBusy(true); await Promise.all(selectedCombos.map((c) => fetch(`/api/combos/${c.id}`, { method: "DELETE" }))); setCombos((prev) => prev.filter((c) => !selectedIds.includes(c.id))); clearSelection(); setBulkBusy(false); setConfirmState(null); } }); };
  const handleBulkStrategy = async (value) => { if (!value) return; const next = { ...comboStrategies }; selectedCombos.forEach((c) => value === "fallback" ? delete next[c.name] : next[c.name] = { ...(next[c.name] || {}), fallbackStrategy: value }); setBulkBusy(true); await persistStrategies(next); setBulkBusy(false); };
  const handleGeneratePresets = async (source) => { setPresetLoading(source); try { const res = await fetch(`/api/combos/presets?source=${source}`); const data = await res.json(); if (!res.ok) return alert(data.error || "Preset unavailable"); const count = data.toCreate ?? (data.items || []).filter((i) => !i.exists).length; if (!count) return alert("All presets already exist"); setConfirmState({ title: `Generate ${source} presets`, message: `Create ${count} preset combos?`, confirmText: "Generate", variant: "primary", onConfirm: async () => { await fetch("/api/combos/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) }); await fetchData(); setConfirmState(null); } }); } finally { setPresetLoading(null); } };

  if (loading) return <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>;
  const fusionCount = combos.filter((c) => comboStrategies[c.name]?.fallbackStrategy === "fusion").length;
  const enabledAdapters = CAPACITY_ADAPTER_CAPS.filter((cap) => capacityAdapter[cap.key]?.enabled).length;
  const avgModels = combos.length ? (combos.reduce((sum, c) => sum + c.models.length, 0) / combos.length).toFixed(1) : "0";

  return <div className="flex flex-col gap-6">
    <header className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Routing layer</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-main">Combos</h1><p className="mt-2 max-w-xl text-sm text-text-muted">Build resilient model routes with fallback, rotation, and panel fusion.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" icon="tune" onClick={() => handleGeneratePresets("cursor")} loading={presetLoading === "cursor"}>Presets</Button><Button icon="add" onClick={() => setShowCreateModal(true)}>New combo</Button></div>
      </div>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["layers", "Total combos", combos.length], ["hub", "Avg models", avgModels], ["auto_awesome", "Fusion routes", fusionCount], ["visibility", "Adapters on", enabledAdapters]].map(([icon, label, value]) => <div key={label} className="rounded-2xl border border-border-subtle bg-surface p-4"><span className="material-symbols-outlined text-primary">{icon}</span><p className="mt-4 text-2xl font-semibold text-text-main">{value}</p><p className="text-xs text-text-muted">{label}</p></div>)}</div>
    <section className="sticky top-2 z-10 rounded-2xl border border-border-subtle bg-surface/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur"><div className="flex flex-col gap-2 lg:flex-row"><div className="relative flex-1"><span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-text-muted">search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search combos..." className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-10 pr-3 text-sm text-text-main outline-none focus:border-primary" /></div><select value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)} className="h-10 rounded-xl border border-border-subtle bg-surface-2 px-3 text-sm text-text-main"><option value="all">All strategies</option><option value="fallback">Fallback</option><option value="round-robin">Round robin</option><option value="fusion">Fusion</option></select><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-xl border border-border-subtle bg-surface-2 px-3 text-sm text-text-main"><option value="name">Sort: Name</option><option value="models">Sort: Models</option><option value="strategy">Sort: Strategy</option></select><Button variant={selectMode ? "primary" : "secondary"} icon="checklist" onClick={() => { setSelectMode(!selectMode); if (selectMode) clearSelection(); }}>Select</Button></div>{selectMode && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3"><label className="flex items-center gap-2 text-xs text-text-muted"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> Select visible ({visibleCombos.length})</label>{selectedCombos.length > 0 && <><Select options={STRATEGY_OPTIONS} value="" placeholder="Set strategy..." disabled={bulkBusy} onChange={(e) => handleBulkStrategy(e.target.value)} selectClassName="py-1.5 text-xs" /><Button size="sm" variant="danger" icon="delete" onClick={handleBulkDelete} disabled={bulkBusy}>Delete ({selectedCombos.length})</Button></>}</div>}</section>
    {visibleCombos.length === 0 ? <div className="rounded-3xl border border-dashed border-border-subtle bg-surface p-12 text-center"><span className="material-symbols-outlined text-5xl text-primary/50">layers_clear</span><h2 className="mt-4 text-lg font-semibold text-text-main">{combos.length ? "No matching combos" : "Create your first combo"}</h2><p className="mt-1 text-sm text-text-muted">{combos.length ? "Try another search or strategy filter." : "Combine models into one reliable endpoint."}</p>{!combos.length && <Button className="mt-5" icon="add" onClick={() => setShowCreateModal(true)}>Create combo</Button>}</div> : <div className="grid gap-4 xl:grid-cols-2">{visibleCombos.map((combo) => <ComboCard key={combo.id} combo={combo} strategy={comboStrategies[combo.name] || {}} getCaps={getCaps} comboByName={Object.fromEntries(combos.map((c) => [c.name, c.models]))} selected={selectedIds.includes(combo.id)} selectMode={selectMode} onToggleSelect={() => toggleSelect(combo.id)} onCopy={copy} copied={copied} onEdit={() => setEditingCombo(combo)} onDelete={() => handleDelete(combo.id)} onSetStrategy={(value) => handleSetStrategy(combo.name, value)} />)}</div>}
    <CapacityAdapterSection capacityAdapter={capacityAdapter} onChange={handleSetCapacityAdapter} activeProviders={activeProviders} getCaps={getCaps} />
    {showCreateModal && <ComboFormModal key="create" isOpen onClose={() => setShowCreateModal(false)} onSave={handleCreate} activeProviders={activeProviders} />}{editingCombo && <ComboFormModal key={editingCombo.id} isOpen combo={editingCombo} onClose={() => setEditingCombo(null)} onSave={(data) => handleUpdate(editingCombo.id, data)} activeProviders={activeProviders} />}
    <ConfirmModal isOpen={!!confirmState} onClose={() => !confirmState?.loading && setConfirmState(null)} onConfirm={confirmState?.onConfirm} title={confirmState?.title || "Confirm"} message={confirmState?.message} confirmText={confirmState?.confirmText || "Confirm"} variant={confirmState?.variant || "danger"} loading={!!confirmState?.loading} />
  </div>;
}

function ComboCard({ combo, strategy = {}, getCaps, comboByName = {}, selected, selectMode, onToggleSelect, onCopy, copied, onEdit, onDelete, onSetStrategy }) {
  const mode = strategy.fallbackStrategy || "fallback";
  const caps = aggregateComboCapabilities(combo.models, comboByName, getCaps);
  const colors = { fallback: "text-sky-400 bg-sky-400/10", "round-robin": "text-amber-400 bg-amber-400/10", fusion: "text-fuchsia-400 bg-fuchsia-400/10" };
  return <article className={`group rounded-3xl border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/50 ${selected ? "border-primary ring-2 ring-primary/20" : "border-border-subtle"}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3">{selectMode && <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Select ${combo.name}`} />}<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><span className="material-symbols-outlined">account_tree</span></div><div className="min-w-0"><h2 className="truncate font-mono text-base font-semibold text-text-main">{combo.name}</h2><p className="mt-1 text-xs text-text-muted">{combo.models.length} models in route</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${colors[mode] || colors.fallback}`}>{mode}</span></div><div className="mt-5 flex min-h-14 flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">{combo.models.length ? combo.models.map((model, i) => <span key={`${model}-${i}`} className="inline-flex max-w-full items-center gap-1"><code className="max-w-[180px] truncate rounded-lg border border-border-subtle bg-surface px-2 py-1 text-xs text-text-main">{model}</code>{i < combo.models.length - 1 && <span className="text-primary">?</span>}</span>) : <span className="text-xs text-text-muted">No models configured</span>}</div>{caps && <div className="mt-3 flex gap-3 text-[11px] text-text-muted"><span>Context {fmtK(caps.contextWindow)}</span><span>Output {fmtK(caps.maxOutput)}</span></div>}{mode === "fusion" && <div className="mt-3 flex items-center gap-2 rounded-xl bg-fuchsia-400/10 px-3 py-2 text-xs text-fuchsia-300"><span className="material-symbols-outlined text-sm">gavel</span>Panel fusion enabled</div>}<div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4"><select value={mode} onChange={(e) => onSetStrategy(e.target.value)} className="rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs text-text-main"><option value="fallback">Fallback</option><option value="round-robin">Round robin</option><option value="fusion">Fusion</option></select><div className="flex gap-1"><button onClick={() => onCopy(combo.name, `combo-${combo.id}`)} className="rounded-lg px-2 py-1.5 text-xs text-text-muted hover:bg-primary/10 hover:text-primary">{copied === `combo-${combo.id}` ? "Copied" : "Copy"}</button><button onClick={onEdit} className="rounded-lg px-2 py-1.5 text-xs text-text-muted hover:bg-primary/10 hover:text-primary">Edit</button><button onClick={onDelete} className="rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-400/10">Delete</button></div></div></article>;
}

const fmtK = (n) => { if (!n) return "?"; if (n >= 1000000) return `${Number.isInteger(n / 1000000) ? n / 1000000 : (n / 1000000).toFixed(1)}M`; return `${Math.round(n / 1000)}k`; };

function CapacityAdapterSection({ capacityAdapter, onChange, activeProviders, getCaps }) {
  const enabled = CAPACITY_ADAPTER_CAPS.filter((cap) => capacityAdapter[cap.key]?.enabled).length;
  return <section className="rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Capability routing</p><h2 className="mt-1 text-xl font-semibold text-text-main">Vision adapters</h2><p className="mt-1 text-sm text-text-muted">Redirect requests when target models cannot process input.</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{enabled}/{CAPACITY_ADAPTER_CAPS.length} active</span></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{CAPACITY_ADAPTER_CAPS.map((cap) => <CapacityAdapterCap key={cap.key} cap={cap} entry={capacityAdapter[cap.key] || EMPTY_CAP_ENTRY} onChange={(entry) => onChange({ ...capacityAdapter, [cap.key]: entry })} activeProviders={activeProviders} getCaps={getCaps} />)}</div></section>;
}

function CapacityAdapterCap({ cap, entry, onChange, activeProviders, getCaps }) {
  const [showModelSelect, setShowModelSelect] = useState(false);
  const patch = (value) => onChange({ ...entry, ...value });
  const models = entry.models || [];
  const add = (m) => { const value = m?.value || m?.name || m; if (value && !models.includes(value)) patch({ models: [...models, value] }); };
  const remove = (m) => patch({ models: models.filter((x) => x !== m) });
  return <div className={`rounded-2xl border border-border-subtle bg-surface-2 p-4 ${!entry.enabled ? "opacity-60" : ""}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined">{cap.icon}</span></div><div><h3 className="font-semibold text-text-main">{cap.label}</h3><p className="text-xs text-text-muted">{cap.desc}</p></div></div><Toggle checked={entry.enabled} onChange={(value) => patch({ enabled: value })} aria-label={`Enable ${cap.label} adapter`} /></div><div className="mt-4 flex rounded-xl border border-border-subtle bg-surface p-1"><button onClick={() => patch({ roundRobin: false })} className={`flex-1 rounded-lg py-1.5 text-xs ${!entry.roundRobin ? "bg-primary text-white" : "text-text-muted"}`}>Order</button><button onClick={() => patch({ roundRobin: true })} className={`flex-1 rounded-lg py-1.5 text-xs ${entry.roundRobin ? "bg-primary text-white" : "text-text-muted"}`}>Round robin</button></div><div className="mt-4 flex flex-wrap gap-2">{models.map((model) => <span key={model} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2 py-1 font-mono text-[11px] text-text-main"><span className="max-w-[180px] truncate">{model}</span><button onClick={() => remove(model)} className="text-text-muted hover:text-red-400" aria-label={`Remove ${model}`}>&times;</button></span>)}{!models.length && <span className="text-xs italic text-text-muted">Default fallback: {DEFAULT_FALLBACK_MODEL}</span>}</div><Button className="mt-4" variant="ghost" size="sm" icon="add" onClick={() => setShowModelSelect(true)} disabled={!entry.enabled}>Add model</Button>{showModelSelect && <ModelSelectModal isOpen onClose={() => setShowModelSelect(false)} onSelect={add} onDeselect={(m) => remove(m?.value || m?.name || m)} activeProviders={activeProviders} title={`Add ${cap.label} model`} addedModelValues={models} capFilter={cap.key} closeOnSelect={false} />}</div>;
}
function ModelItem({ id, index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    // no transition — prevents the CSS settle animation fighting React's re-render on drop
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(model); setEditing(false); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] transition-colors ${isDragging ? "shadow-md ring-1 ring-primary/30" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab touch-none p-0.5 rounded text-text-muted hover:text-primary active:cursor-grabbing shrink-0"
        title="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="4" r="2"/><circle cx="15" cy="4" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="20" r="2"/><circle cx="15" cy="20" r="2"/>
        </svg>
      </button>

      {/* Index badge */}
      <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">{index + 1}</span>

      {/* Inline editable model value */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-primary/40 bg-white px-1.5 py-0.5 font-mono text-xs text-text-main outline-none dark:bg-black/20"
        />
      ) : (
        <div
          className="min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs text-text-main hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      {/* Priority arrows */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-0.5 rounded ${isFirst ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move up"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-0.5 rounded ${isLast ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move down"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all"
        title="Remove"
      >
        <span className="material-symbols-outlined text-[12px]">close</span>
      </button>
    </div>
  );
}


function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders, kindFilter = null }) {
  // Initialize state with combo values - key prop on parent handles reset on remount
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Use stable index-based IDs so duplicates and similar names are handled correctly
  const modelItems = models.map((model, i) => ({ uid: `item-${i}`, model }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modelItems.findIndex((m) => m.uid === active.id);
      const newIndex = modelItems.findIndex((m) => m.uid === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setModels((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const fetchModalData = async () => {
    try {
      const aliasesRes = await fetch("/api/models/alias");
      if (!aliasesRes.ok) return;
      const aliasesData = await aliasesRes.json();
      setModelAliases(aliasesData.aliases || {});
    } catch (error) {
      console.error("Error fetching modal data:", error);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    void fetchModalData();
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) {
      setModels([...models, model.value]);
    }
  };

  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };

  const handleRemoveModel = (index) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    setModels(newModels);
  };

  const handleMoveDown = (index) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    setModels(newModels);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    await onSave({ name: name.trim(), models });
    setSaving(false);
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Combo" : "Create Combo"}
      >
        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <Input
              label="Combo Name"
              value={name}
              onChange={handleNameChange}
              placeholder="my-combo"
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Only letters, numbers, -, _ and . allowed
            </p>
          </div>

          {/* Models */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Models</label>

            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">layers</span>
                <p className="text-xs text-text-muted">No models added yet</p>
              </div>
            ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
              <SortableContext items={modelItems.map((m) => m.uid)} strategy={verticalListSortingStrategy}>
                <div className="flex max-h-[55vh] min-w-0 flex-col gap-1 overflow-y-auto sm:max-h-[350px]">
                  {modelItems.map(({ uid, model }, index) => (
                    <ModelItem
                      key={uid}
                      id={uid}
                      index={index}
                      model={model}
                      isFirst={index === 0}
                      isLast={index === modelItems.length - 1}
                      onEdit={(newVal) => {
                        const updated = [...models];
                        updated[index] = newVal;
                        setModels(updated);
                      }}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                      onRemove={() => handleRemoveModel(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            )}

            {/* Add Model button */}
            <button
              onClick={() => setShowModelSelect(true)}
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Model
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={!name.trim() || !!nameError || saving}
            >
              {saving ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Model Select Modal */}
      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel}
          onDeselect={handleDeselectModel}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Add Model to Combo"
          kindFilter={kindFilter}
          addedModelValues={models}
          closeOnSelect={false}
        />
      )}
    </>
  );
}
