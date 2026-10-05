"use client";

import { useParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Badge, Button, AddCustomEmbeddingModal, NoAuthProxyCard, ProviderInfoCard } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS, isCustomEmbeddingProvider } from "@/shared/constants/providers";
import ConnectionsCard from "@/app/(dashboard)/dashboard/providers/components/ConnectionsCard";
import ModelsCard from "@/app/(dashboard)/dashboard/providers/components/ModelsCard";
import { KIND_EXAMPLE_CONFIG } from "./components/exampleShared";
import { EmbeddingExampleCard } from "./components/EmbeddingExampleCard";
import { TtsExampleCard } from "./components/TtsExampleCard";
import { GenericExampleCard } from "./components/GenericExampleCard";
import { SttExampleCard } from "./components/SttExampleCard";
import MediaPlayground from "./components/MediaPlayground";
import HistoryPanel from "./components/HistoryPanel";

// Per-kind playground metadata (title + accent + icon) for the Chat tab header.
const KIND_STUDIO = {
  image: { title: "Image Studio", icon: "brush", accent: "#8B5CF6" },
  video: { title: "Video Studio", icon: "movie", accent: "#0EA5E9" },
  tts: { title: "Voice Studio", icon: "record_voice_over", accent: "#F59E0B" },
  music: { title: "Music Studio", icon: "music_note", accent: "#EC4899" },
  stt: { title: "Transcript Studio", icon: "mic", accent: "#10B981" },
  imageToText: { title: "Vision Studio", icon: "image_search", accent: "#6366F1" },
  embedding: { title: "Embedding Studio", icon: "data_array", accent: "#14B8A6" },
  webSearch: { title: "Search Studio", icon: "travel_explore", accent: "#3B82F6" },
  webFetch: { title: "Fetch Studio", icon: "language", accent: "#06B6D4" },
  systemone: { title: "System One Studio", icon: "psychology", accent: "#A855F7" },
};

const HISTORY_LIMIT = 50;

/** Safely read a saved generation-history array from localStorage. */
function readHistory(key) {
  try {
    const saved = window.localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// MediaProviderDetailPage
export default function MediaProviderDetailPage() {
  const { kind, id } = useParams();
  const router = useRouter();
  const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kind);
  const isCustom = isCustomEmbeddingProvider(id) && kind === "embedding";

  const handleDeleteCustom = async () => {
    if (!confirm("Delete this Custom Embedding node?")) return;
    try {
      const res = await fetch(`/api/provider-nodes/${id}`, { method: "DELETE" });
      if (res.ok) router.push(`/dashboard/media-providers/${kind}`);
    } catch (error) {
      console.log("Error deleting custom embedding node:", error);
    }
  };

  const [customNode, setCustomNode] = useState(null);
  const [customLoading, setCustomLoading] = useState(isCustom);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");

  // ---- persisted generation history (localStorage, per provider + kind) ----
  // localStorage is unavailable during SSR/hydration, so load it after mount
  // and whenever the provider/kind key changes. Writes are explicit (inside the
  // mutating handlers) so a stale initial `[]` render can never clobber storage.
  const historyKey = `mirai:mediaHistory:${id}:${kind}`;
  const [history, setHistory] = useState([]);

  /* eslint-disable react-hooks/set-state-in-effect -- syncing from localStorage (external store) */
  useEffect(() => {
    setHistory(readHistory(historyKey));
  }, [historyKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist a concrete list for the current key.
  const persistHistory = (list) => {
    try {
      if (list.length === 0) window.localStorage.removeItem(historyKey);
      else window.localStorage.setItem(historyKey, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
    } catch {
      /* storage full / unavailable — history simply won't persist */
    }
  };

  const handleResult = (entry) => {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    const next = [record, ...history].slice(0, HISTORY_LIMIT);
    persistHistory(next);
    setHistory(next);
  };

  const clearHistory = () => {
    if (history.length && !confirm("Clear generation history for this provider?")) return;
    persistHistory([]);
    setHistory([]);
  };

  const removeHistory = (recordId) => {
    const next = history.filter((r) => r.id !== recordId);
    persistHistory(next);
    setHistory(next);
  };

  // Fetch custom node info from API for custom embedding nodes
  useEffect(() => {
    if (!isCustom) return;
    let cancelled = false;
    fetch("/api/provider-nodes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCustomNode((d.nodes || []).find((n) => n.id === id) || null);
        setCustomLoading(false);
      })
      .catch(() => { if (!cancelled) setCustomLoading(false); });
    return () => { cancelled = true; };
  }, [id, isCustom]);

  // ---- account status (accounts are managed on the Providers page) ----
  const [accountCount, setAccountCount] = useState(null);

  useEffect(() => {
    if (isCustom) return;
    let cancelled = false;
    fetch("/api/providers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const all = d.connections || [];
        setAccountCount(all.filter((c) => c.provider === id).length);
      })
      .catch(() => { if (!cancelled) setAccountCount(null); });
    return () => { cancelled = true; };
  }, [id, isCustom]);

  if (!kindConfig) return notFound();

  const builtInProvider = AI_PROVIDERS[id];

  // For custom embedding nodes, build a synthetic provider object
  const provider = isCustom
    ? (customNode ? { id, name: customNode.name || "Custom Embedding", color: "#6366F1", textIcon: "CE" } : null)
    : builtInProvider;

  if (!isCustom && !builtInProvider) return notFound();
  if (isCustom && !customLoading && !customNode) return notFound();
  if (isCustom && customLoading) {
    return <div className="text-text-muted text-sm py-12 text-center">Loading...</div>;
  }

  const kinds = isCustom ? ["embedding"] : (provider.serviceKinds ?? ["llm"]);
  if (!isCustom && !kinds.includes(kind)) return notFound();

  const hasConfig = !isCustom && (provider.searchConfig || provider.fetchConfig || provider.ttsConfig || provider.sttConfig || provider.embeddingConfig || provider.systemoneConfig || provider.searchViaChat);
  const showModelsTab = kind !== "tts" && kind !== "webSearch" && kind !== "webFetch";
  const studio = KIND_STUDIO[kind] || { title: "Playground", icon: "bolt", accent: "#8B5CF6" };

  const tabs = [
    { key: "chat", label: "Chat", icon: "chat" },
    hasConfig && { key: "config", label: "Config", icon: "settings" },
    showModelsTab && { key: "models", label: "Models", icon: "deployed_code" },
    { key: "history", label: "History", icon: "history", count: history.length },
  ].filter(Boolean);

  // Fall back to the first tab if the active one is unavailable (e.g. no config).
  const active = tabs.some((t) => t.key === activeTab) ? activeTab : tabs[0].key;

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <div>
        <Link
          href={`/dashboard/media-providers/${kind}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {kindConfig.label}
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="size-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${provider.color}15` }}>
            <ProviderIcon
              src={`/providers/${provider.id}.png`}
              alt={provider.name}
              size={48}
              className="object-contain rounded-lg max-w-[48px] max-h-[48px]"
              fallbackText={provider.textIcon || provider.id.slice(0, 2).toUpperCase()}
              fallbackColor={provider.color}
            />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{provider.name}</h1>
              {!isCustom && provider.notice?.apiKeyUrl && (
                <a
                  href={provider.notice.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Get API Key
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isCustom && <Badge variant="default" size="sm">Custom · {customNode?.prefix}</Badge>}
              {kinds.map((k) => (
                <Badge key={k} variant={k === kind ? "primary" : "default"} size="sm">
                  {k.toUpperCase()}
                </Badge>
              ))}
              {!isCustom && (
                <Link
                  href={`/dashboard/providers/${id}`}
                  title="Manage accounts on the Providers page"
                  className="text-xs text-text-muted hover:text-primary transition-colors inline-flex items-center gap-1 ml-1"
                >
                  <span className="material-symbols-outlined text-[14px]">group</span>
                  {accountCount == null ? "Accounts" : `${accountCount} account${accountCount === 1 ? "" : "s"}`}
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              )}
            </div>
          </div>
          {isCustom && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button size="sm" variant="secondary" icon="edit" onClick={() => setShowEditModal(true)}>
                Edit
              </Button>
              <Button size="sm" variant="secondary" icon="delete" onClick={handleDeleteCustom}>
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Kind-specific notice (e.g. codex/image requires Plus) */}
      {!isCustom && provider.kindNotice?.[kind] && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
          <span className="material-symbols-outlined text-[20px] mt-0.5">warning</span>
          <p className="text-sm">{provider.kindNotice[kind]}</p>
        </div>
      )}

      {/* Provider notice text (only when there's actual text content) */}
      {!isCustom && provider.notice?.text && !provider.deprecated && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 sm:flex-row sm:items-center">
          <span className="material-symbols-outlined text-[16px] text-blue-500 shrink-0">info</span>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-blue-600 dark:text-blue-400">{provider.notice.text}</p>
          {provider.notice.apiKeyUrl && (
            <a
              href={provider.notice.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 sm:py-0.5"
            >
              Get API Key →
            </a>
          )}
        </div>
      )}

      {/* Tabs: Chat · Config · Models · History */}
      <div className="flex flex-wrap items-center gap-1 border-b border-black/[0.06] dark:border-white/[0.06]">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${isActive
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:border-black/10 hover:text-text-main dark:hover:border-white/10"}`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${isActive ? "bg-primary/15 text-primary" : "bg-black/[0.06] text-text-muted dark:bg-white/[0.08]"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chat tab */}
      {active === "chat" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              className="size-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${studio.accent}1F`, color: studio.accent }}
            >
              <span className="material-symbols-outlined text-[20px]">{studio.icon}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text-main">{studio.title}</h3>
              <p className="text-xs text-text-muted truncate">
                {provider.name} · {kindConfig.label}
              </p>
            </div>
          </div>

          <MediaPlayground providerId={id} kind={kind} onResult={handleResult} />

          {/* Example — per kind (reference snippets below the composer) */}
          {kind === "embedding" && (
            <EmbeddingExampleCard providerId={id} customAlias={customNode?.prefix} />
          )}
          {kind === "tts" && <TtsExampleCard providerId={id} />}
          {kind === "stt" && !isCustom && <SttExampleCard providerId={id} />}
          {!isCustom && KIND_EXAMPLE_CONFIG[kind] && <GenericExampleCard providerId={id} kind={kind} />}
        </div>
      )}

      {/* Config tab — provider info card is here. */}
      {active === "config" && (
        <div className="flex flex-col gap-6">
          {hasConfig && (
            <ProviderInfoCard
              config={
                kind === "webFetch" ? provider.fetchConfig
                  : kind === "tts" ? provider.ttsConfig
                  : kind === "stt" ? provider.sttConfig
                  : kind === "embedding" ? provider.embeddingConfig
                  : kind === "systemone" ? provider.systemoneConfig
                  : provider.searchConfig || { mode: "chat-completions", defaultModel: provider.searchViaChat?.defaultModel, pricingUrl: provider.searchViaChat?.pricingUrl, freeTier: provider.searchViaChat?.freeTier }
              }
              provider={provider}
              title={`${kindConfig.label} Config`}
            />
          )}
        </div>
      )}

      {/* Models tab */}
      {active === "models" && (
        <ModelsCard
          providerId={id}
          kindFilter={kind}
          providerAliasOverride={isCustom ? customNode?.prefix : undefined}
        />
      )}

      {/* History tab */}
      {active === "history" && (
        <HistoryPanel records={history} onClear={clearHistory} onRemove={removeHistory} />
      )}

      {isCustom && (
        <AddCustomEmbeddingModal
          isOpen={showEditModal}
          node={customNode}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setCustomNode(updated);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
