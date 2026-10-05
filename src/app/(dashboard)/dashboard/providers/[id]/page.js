"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";
import { Card, Button, Badge, Input, Modal, CardSkeleton, OAuthModal, KiroOAuthWrapper, CursorAuthModal, ZedAuthModal, XiaomiMimoAuthModal, IFlowCookieModal, GitLabAuthModal, Toggle, Select, EditConnectionModal, NoAuthProxyCard, ConfirmModal } from "@/shared/components";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS, FREE_PROVIDERS, FREE_TIER_PROVIDERS, WEB_COOKIE_PROVIDERS, getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider, AI_PROVIDERS } from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { translate } from "@/i18n/runtime";
import { fetchSuggestedModels } from "@/shared/utils/providerModelsFetcher";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";
import ModelsTable from "./ModelsTable";
import ProviderQuotaTab from "./ProviderQuotaTab";
import PassthroughModelsSection from "./PassthroughModelsSection";
import CompatibleModelsSection from "./CompatibleModelsSection";
import ConnectionRow from "./ConnectionRow";
import AddApiKeyModal from "./AddApiKeyModal";
import EditCompatibleNodeModal from "./EditCompatibleNodeModal";
import AddCustomModelModal from "./AddCustomModelModal";
import FetchModelsModal from "./FetchModelsModal";
import { bucketConnections } from "@/shared/utils/accountBuckets";
import { DEFAULT_MODEL_TEST_PROMPT, summarizeModelTests } from "@/shared/utils/modelTestAnswer";
import MarkdownMini from "@/shared/components/MarkdownMini";
import BulkImportCodexModal from "./BulkImportCodexModal";
import BulkImportGrokCliModal from "./BulkImportGrokCliModal";
import BulkImportCodeBuddyModal from "./BulkImportCodeBuddyModal";
import CustomConfigCard from "./CustomConfigCard";

const ONE_BY_ONE_DELAY_MS = 1000;

const AUTO_PING_SETTINGS_KEYS = {
  claude: "claudeAutoPing",
  codex: "codexAutoPing",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id;
  const { getCaps } = useModelCaps();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [providerNode, setProviderNode] = useState(null);
  const [proxyPools, setProxyPools] = useState([]);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [showXiaomiMimoModal, setShowXiaomiMimoModal] = useState(false);
  const [showIFlowCookieModal, setShowIFlowCookieModal] = useState(false);
  const [showAddApiKeyModal, setShowAddApiKeyModal] = useState(false);
  const [addConnectionError, setAddConnectionError] = useState("");
  const [showBulkImportCodex, setShowBulkImportCodex] = useState(false);
  const [showBulkImportGrokCli, setShowBulkImportGrokCli] = useState(false);
  const [showBulkImportCodeBuddy, setShowBulkImportCodeBuddy] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditNodeModal, setShowEditNodeModal] = useState(false);
  const [showBulkProxyModal, setShowBulkProxyModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [modelAliases, setModelAliases] = useState({});
  const [customModels, setCustomModels] = useState([]);
  const [headerImgError, setHeaderImgError] = useState(false);
  const [modelTestResults, setModelTestResults] = useState({});
  const [modelsTestError, setModelsTestError] = useState("");
  const [testingModelIds, setTestingModelIds] = useState(() => new Set());
  const [showAddCustomModel, setShowAddCustomModel] = useState(false);
  const [showFetchModels, setShowFetchModels] = useState(false);
  const [fetchModelsSaving, setFetchModelsSaving] = useState(false);
  const [mainTab, setMainTab] = useState("accounts");
  const [accountsTab, setAccountsTab] = useState("active");
  const [selectedConnectionIds, setSelectedConnectionIds] = useState([]);
  const [bulkProxyPoolId, setBulkProxyPoolId] = useState("__none__");
  const [bulkUpdatingProxy, setBulkUpdatingProxy] = useState(false);
  const [providerStrategy, setProviderStrategy] = useState(null);
  const [providerStickyLimit, setProviderStickyLimit] = useState("");
  const [thinkingMode, setThinkingMode] = useState("auto");
  const [autoPing, setAutoPing] = useState({ enabled: false, connections: {} });
  const [suggestedModels, setSuggestedModels] = useState([]);
  const [liveModels, setLiveModels] = useState([]);
  // Live-catalog fetch warning/error (surfaced for zed only; cursor behavior unchanged).
  const [liveModelsError, setLiveModelsError] = useState(null);
  const [kiloFreeModels, setKiloFreeModels] = useState([]);
  const [disabledModelIds, setDisabledModelIds] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [showAgRiskModal, setShowAgRiskModal] = useState(false);
  const [oneByOneRunning, setOneByOneRunning] = useState(false);
  const [oneByOneStopping, setOneByOneStopping] = useState(false);
  const [oneByOneCurrentConnectionId, setOneByOneCurrentConnectionId] = useState(null);
  const [oneByOneResults, setOneByOneResults] = useState({});
  const [oneByOneSummary, setOneByOneSummary] = useState(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runMode, setRunMode] = useState("test"); // "test" | "warmup"
  const [runTarget, setRunTarget] = useState("all"); // "all" | "active" | "rateLimited" | "error"
  const stopOneByOneRef = useRef(false);

  // Test-all-models (sequential batch) + answer toasts.
  const [modelTestPrompt, setModelTestPrompt] = useState(DEFAULT_MODEL_TEST_PROMPT);
  const [testAllRunning, setTestAllRunning] = useState(false);
  const [testAllStopping, setTestAllStopping] = useState(false);
  const [testAllCurrentId, setTestAllCurrentId] = useState(null);
  const [testAllSummary, setTestAllSummary] = useState(null);
  const [modelAnswerToasts, setModelAnswerToasts] = useState([]);
  const [showTestAllModal, setShowTestAllModal] = useState(false);
  const stopTestAllRef = useRef(false);
  const modelToastTimersRef = useRef(new Map());
  const { copied, copy } = useCopyToClipboard();

  const AG_RISK_STORAGE_KEY = "ag_risk_confirmed";

  const openOAuthConnection = () => {
    setShowOAuthModal(true);
  };

  const triggerOAuthConnection = () => {
    if (providerId === "antigravity" && typeof window !== "undefined") {
      const confirmed = window.localStorage.getItem(AG_RISK_STORAGE_KEY) === "true";
      if (!confirmed) {
        setShowAgRiskModal(true);
        return;
      }
    }
    // Xiaomi Desktop: auto-import local credentials first, OAuth as fallback
    if (providerId === "xiaomi-mimo") {
      setShowXiaomiMimoModal(true);
      return;
    }
    if (isOAuth) {
      openOAuthConnection();
      return;
    }
    setAddConnectionError("");
    setShowAddApiKeyModal(true);
  };

  const triggerApiKeyConnection = () => {
    setAddConnectionError("");
    setShowAddApiKeyModal(true);
  };

  const triggerAddConnection = () => {
    if (isOAuth) {
      triggerOAuthConnection();
      return;
    }
    triggerApiKeyConnection();
  };

  const handleAgRiskConfirm = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AG_RISK_STORAGE_KEY, "true");
    }
    setShowAgRiskModal(false);
    if (isOAuth) {
      openOAuthConnection();
      return;
    }
    triggerApiKeyConnection();
  };

  const providerInfo = providerNode
    ? {
        id: providerNode.id,
        name: providerNode.name || (providerNode.type === "anthropic-compatible" ? "Anthropic Compatible" : "OpenAI Compatible"),
        color: providerNode.type === "anthropic-compatible" ? "#D97757" : "#10A37F",
        textIcon: providerNode.type === "anthropic-compatible" ? "AC" : "OC",
        apiType: providerNode.apiType,
        baseUrl: providerNode.baseUrl,
        type: providerNode.type,
      }
    : (OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId] || WEB_COOKIE_PROVIDERS[providerId]);
  const authModes = providerInfo?.authModes || [];
  const isOAuth = !!OAUTH_PROVIDERS[providerId] || !!FREE_PROVIDERS[providerId] || authModes.includes("oauth");
  const supportsApiKeyAuth = !!APIKEY_PROVIDERS[providerId] || authModes.includes("apikey");
  const isFreeNoAuth = !!FREE_PROVIDERS[providerId]?.noAuth;
  const staticModels = getModelsByProviderId(providerId);
  const models = (providerId === "cursor" || providerId === "zed") && liveModels.length > 0
    ? liveModels
    : staticModels;
  const providerAlias = getProviderAlias(providerId);
  
  const isOpenAICompatible = isOpenAICompatibleProvider(providerId);
  const isAnthropicCompatible = isAnthropicCompatibleProvider(providerId);
  const isCompatible = isOpenAICompatible || isAnthropicCompatible;
  const hasDualAuthModes = !isCompatible && isOAuth && supportsApiKeyAuth;
  const oauthConnectionLabel =
    providerId === "xai" ? "Grok Build OAuth"
    : providerId === "grok-cli" ? "Grok CLI Device Login"
    : providerId === "kimi" ? "Kimi Coding OAuth"
    : "OAuth";
  const apiKeyConnectionLabel =
    providerId === "xai" ? "xAI API Key"
    : providerId === "kimi" ? "Kimi API Key"
    : (providerId === "qoder" || providerId === "qoder-cn") ? "PAT"
    : "API Key";
  // Resolve suffix "(level)" for a model when a thinking level is picked and the model supports it.
  const resolveThinkingSuffix = (modelId) => {
    if (!thinkingMode || thinkingMode === "auto") return null;
    const levels = getThinkingLevels(providerId, modelId);
    return levels && levels.includes(thinkingMode) ? thinkingMode : null;
  };
  const providerStorageAlias = isCompatible ? providerId : providerAlias;
  // Union of levels across this provider's reasoning models — drives the level picker options.
  // Include custom models too (e.g. manually added gpt-5.6-sol → max).
  const providerThinkingLevels = (() => {
    const set = new Set();
    const seen = new Set();
    const addLevels = (modelId) => {
      if (!modelId || seen.has(modelId)) return;
      seen.add(modelId);
      const lv = getThinkingLevels(providerId, modelId);
      if (lv) lv.forEach((l) => { if (l !== "none") set.add(l); });
    };
    for (const m of models) addLevels(m.id);
    for (const m of kiloFreeModels) addLevels(m.id);
    for (const entry of customModels) {
      if (entry.providerAlias !== providerStorageAlias) continue;
      if ((entry.kind || entry.type || "llm") !== "llm") continue;
      addLevels(entry.id);
    }
    return set.size ? ["auto", ...[...set]] : null;
  })();
  const providerDisplayAlias = isCompatible
    ? (providerNode?.prefix || providerId)
    : providerAlias;
  // Set of every model id already present for this provider (built-in + Kilo free
  // + custom + alias targets). The Fetch Models modal uses it to lock
  // pre-existing models (checked + disabled).
  const existingModelIds = (() => {
    const set = new Set();
    for (const m of models) if (m?.id) set.add(String(m.id).split("/").pop());
    for (const m of kiloFreeModels) if (m?.id) set.add(String(m.id).split("/").pop());
    for (const entry of customModels) {
      if (entry.providerAlias !== providerStorageAlias) continue;
      if ((entry.kind || entry.type || "llm") !== "llm") continue;
      if (entry.id) set.add(String(entry.id).split("/").pop());
    }
    for (const full of Object.values(modelAliases)) {
      const id = String(full).split("/").pop();
      if (id) set.add(id);
    }
    return Array.from(set);
  })();

  const fetchDisabledModels = useCallback(async () => {
    try {
      const res = await fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerStorageAlias)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setDisabledModelIds(data.ids || []);
    } catch (error) {
      console.log("Error fetching disabled models:", error);
    }
  }, [providerStorageAlias]);

  const handleDisableModel = async (modelId) => {
    try {
      const res = await fetch("/api/models/disabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAlias: providerStorageAlias, ids: [modelId] }),
      });
      if (res.ok) await fetchDisabledModels();
    } catch (error) {
      console.log("Error disabling model:", error);
    }
  };

  const handleEnableModel = async (modelId) => {
    try {
      const res = await fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerStorageAlias)}&id=${encodeURIComponent(modelId)}`, { method: "DELETE" });
      if (res.ok) await fetchDisabledModels();
    } catch (error) {
      console.log("Error enabling model:", error);
    }
  };

  const handleDisableAll = async (ids) => {
    if (!ids.length) return;
    setConfirmState({
      title: "Disable All Models",
      message: `Disable all ${ids.length} model(s)?`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch("/api/models/disabled", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerAlias: providerStorageAlias, ids }),
          });
          if (res.ok) await fetchDisabledModels();
        } catch (error) {
          console.log("Error disabling all models:", error);
        }
      }
    });
  };

  const handleEnableAll = async () => {
    try {
      const res = await fetch(`/api/models/disabled?providerAlias=${encodeURIComponent(providerStorageAlias)}`, { method: "DELETE" });
      if (res.ok) await fetchDisabledModels();
    } catch (error) {
      console.log("Error enabling all models:", error);
    }
  };

  // Define callbacks BEFORE the useEffect that uses them
  const fetchAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) {
        setModelAliases(data.aliases || {});
      }
    } catch (error) {
      console.log("Error fetching aliases:", error);
    }
  }, []);

  const fetchCustomModels = useCallback(async () => {
    try {
      const res = await fetch("/api/models/custom", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setCustomModels(data.models || []);
      }
    } catch (error) {
      console.log("Error fetching custom models:", error);
    }
  }, []);

  // Fetch free models from Kilo API for kilocode provider
  useEffect(() => {
    if (providerId !== "kilocode") return;
    fetch("/api/providers/kilo/free-models")
      .then((res) => res.json())
      .then((data) => { if (data.models?.length) setKiloFreeModels(data.models); })
      .catch(() => {});
  }, [providerId]);

  const fetchConnections = useCallback(async () => {
    try {
      const [connectionsRes, nodesRes, proxyPoolsRes, settingsRes] = await Promise.all([
        fetch("/api/providers", { cache: "no-store" }),
        fetch("/api/provider-nodes", { cache: "no-store" }),
        fetch("/api/proxy-pools?isActive=true", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      const connectionsData = await connectionsRes.json();
      const nodesData = await nodesRes.json();
      const proxyPoolsData = await proxyPoolsRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      if (connectionsRes.ok) {
        const filtered = (connectionsData.connections || []).filter(c => c.provider === providerId);
        setConnections(filtered);
      }
      if (proxyPoolsRes.ok) {
        setProxyPools(proxyPoolsData.proxyPools || []);
      }
      // Load per-provider strategy override
      const override = (settingsData.providerStrategies || {})[providerId] || {};
      setProviderStrategy(override.fallbackStrategy || null);
      setProviderStickyLimit(override.stickyRoundRobinLimit != null ? String(override.stickyRoundRobinLimit) : "1");
      // Load per-provider thinking config
      const thinkingCfg = (settingsData.providerThinking || {})[providerId] || {};
      setThinkingMode(thinkingCfg.mode || "auto");
      const autoPingSettingsKey = AUTO_PING_SETTINGS_KEYS[providerId];
      const apCfg = autoPingSettingsKey ? settingsData[autoPingSettingsKey] || {} : {};
      setAutoPing({ enabled: apCfg.enabled === true, connections: apCfg.connections || {} });
      if (nodesRes.ok) {
        let node = (nodesData.nodes || []).find((entry) => entry.id === providerId) || null;

        // Newly created compatible nodes can be briefly unavailable on one worker.
        // Retry a few times before showing "Provider not found".
        if (!node && isCompatible) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const retryRes = await fetch("/api/provider-nodes", { cache: "no-store" });
            if (!retryRes.ok) continue;
            const retryData = await retryRes.json();
            node = (retryData.nodes || []).find((entry) => entry.id === providerId) || null;
            if (node) break;
          }
        }

        setProviderNode(node);
      }
    } catch (error) {
      console.log("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  }, [providerId, isCompatible]);

  const handleUpdateNode = async (formData) => {
    try {
      const res = await fetch(`/api/provider-nodes/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setProviderNode(data.node);
        await fetchConnections();
        setShowEditNodeModal(false);
      }
    } catch (error) {
      console.log("Error updating provider node:", error);
    }
  };

  const saveProviderStrategy = async (strategy, stickyLimit) => {
    try {
      const settingsRes = await fetch("/api/settings", { cache: "no-store" });
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const current = settingsData.providerStrategies || {};

      // Build override: null strategy means remove override, use global
      const override = {};
      if (strategy) override.fallbackStrategy = strategy;
      if (strategy === "round-robin" && stickyLimit !== "") {
        override.stickyRoundRobinLimit = Number(stickyLimit) || 3;
      }

      const updated = { ...current };
      if (Object.keys(override).length === 0) {
        delete updated[providerId];
      } else {
        updated[providerId] = override;
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerStrategies: updated }),
      });
    } catch (error) {
      console.log("Error saving provider strategy:", error);
    }
  };

  const handleRoundRobinToggle = (enabled) => {
    const strategy = enabled ? "round-robin" : null;
    const sticky = enabled ? (providerStickyLimit || "1") : providerStickyLimit;
    if (enabled && !providerStickyLimit) setProviderStickyLimit("1");
    setProviderStrategy(strategy);
    saveProviderStrategy(strategy, sticky);
  };

  const handleStickyLimitChange = (value) => {
    setProviderStickyLimit(value);
    saveProviderStrategy("round-robin", value);
  };

  const saveThinkingConfig = async (mode) => {
    try {
      const settingsRes = await fetch("/api/settings", { cache: "no-store" });
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      const current = settingsData.providerThinking || {};
      const updated = { ...current };
      if (!mode || mode === "auto") {
        delete updated[providerId];
      } else {
        updated[providerId] = { mode };
      }
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerThinking: updated }),
      });
    } catch (error) {
      console.log("Error saving thinking config:", error);
    }
  };

  const handleThinkingModeChange = (mode) => {
    setThinkingMode(mode);
    saveThinkingConfig(mode);
  };

  const saveAutoPing = async (next) => {
    const autoPingSettingsKey = AUTO_PING_SETTINGS_KEYS[providerId];
    if (!autoPingSettingsKey) return;

    setAutoPing(next);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [autoPingSettingsKey]: next }),
      });
    } catch (error) {
      console.log("Error saving auto-ping config:", error);
    }
  };

  const handleAutoPingConnection = (connectionId, on) => {
    saveAutoPing({ ...autoPing, connections: { ...autoPing.connections, [connectionId]: on } });
  };

  useEffect(() => {
    fetchConnections();
    fetchAliases();
    fetchCustomModels();
    fetchDisabledModels();
  }, [fetchConnections, fetchAliases, fetchCustomModels, fetchDisabledModels]);

  // Live per-connection catalogs (cursor, zed): the static registry carries
  // no usable list, so resolve from the active connection. Fires only when
  // the provider id or connection list changes — no polling, no loop.
  // Cursor path is statement-identical to before; zed adds error surfacing.
  useEffect(() => {
    const isLiveCatalog = providerId === "cursor" || providerId === "zed";
    if (!isLiveCatalog) {
      setLiveModels([]);
      return;
    }

    const connection = connections.find((item) => item.isActive !== false);
    if (!connection?.id) {
      setLiveModels([]);
      if (providerId === "zed") setLiveModelsError(null);
      return;
    }

    let cancelled = false;
    if (providerId === "zed") setLiveModelsError(null);
    fetch(`/api/providers/${connection.id}/models`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && Array.isArray(data?.models) && data.models.length > 0) {
          setLiveModels(data.models);
          if (providerId === "zed" && data?.warning) setLiveModelsError(data.warning);
          return;
        }
        if (providerId === "zed") {
          setLiveModels([]);
          setLiveModelsError(data?.warning || data?.error || "Zed returned no live models.");
        }
      })
      .catch(() => {
        if (!cancelled && providerId === "zed") {
          setLiveModels([]);
          setLiveModelsError("Failed to reach the Zed model catalog.");
        }
      });

    return () => { cancelled = true; };
  }, [providerId, connections]);

  // Fetch suggested models from provider's public API (if configured)
  useEffect(() => {
    const fetcher = (OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId] || FREE_PROVIDERS[providerId] || FREE_TIER_PROVIDERS[providerId])?.modelsFetcher;
    if (!fetcher) return;
    fetchSuggestedModels(fetcher).then(setSuggestedModels);
  }, [providerId]);

  const handleSetAlias = async (modelId, alias, providerAliasOverride = providerAlias) => {
    const fullModel = `${providerAliasOverride}/${modelId}`;
    try {
      const res = await fetch("/api/models/alias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: fullModel, alias }),
      });
      if (res.ok) {
        await fetchAliases();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to set alias");
      }
    } catch (error) {
      console.log("Error setting alias:", error);
    }
  };

  const handleDeleteAlias = async (alias) => {
    try {
      const res = await fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAliases();
      }
    } catch (error) {
      console.log("Error deleting alias:", error);
    }
  };

  // `transport` pins a realtime STT dispatch marker (shared whitelist
  // STT_TRANSPORT_META); the API only honours it on type "stt" records.
  const handleAddCustomModel = async (modelId, type = "llm", providerAliasOverride = providerStorageAlias, caps, transport) => {
    try {
      const res = await fetch("/api/models/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAlias: providerAliasOverride, id: modelId, type, ...(caps ? { caps } : {}), ...(transport ? { transport } : {}) }),
      });
      if (res.ok) {
        await fetchCustomModels();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("customModelChanged"));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add custom model");
      }
    } catch (error) {
      console.log("Error adding custom model:", error);
    }
  };

  const handleDeleteCustomModel = async (modelId, type = "llm", providerAliasOverride = providerStorageAlias) => {
    try {
      const params = new URLSearchParams({ providerAlias: providerAliasOverride, id: modelId, type });
      const res = await fetch(`/api/models/custom?${params}`, { method: "DELETE" });
      if (res.ok) {
        await fetchCustomModels();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("customModelChanged"));
      }
    } catch (error) {
      console.log("Error deleting custom model:", error);
    }
  };

  // Open the Fetch Models modal — requires an active connection to query the provider.
  const handleOpenFetchModels = () => {
    if (!connections.some((conn) => conn.isActive !== false) && !isFreeNoAuth) {
      alert(translate("Please add an active connection first"));
      return;
    }
    setShowFetchModels(true);
  };

  // Persist the models the user selected in the Fetch Models modal.
  const handleSaveFetchedModels = async (modelIds) => {
    if (fetchModelsSaving) return;
    setFetchModelsSaving(true);
    try {
      let added = 0;
      for (const modelId of modelIds) {
        const alreadyExists = customModels.some(
          (entry) => entry.providerAlias === providerStorageAlias && entry.id === modelId && (entry.kind || entry.type || "llm") === "llm"
        ) || Object.values(modelAliases).includes(providerStorageAlias + "/" + modelId);
        if (alreadyExists) continue;
        await handleAddCustomModel(modelId, "llm", providerStorageAlias);
        added += 1;
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("customModelChanged"));
      }
      setShowFetchModels(false);
      if (added === 0) {
        alert(translate("All selected models already exist, no new models added"));
      } else {
        alert(translate("Successfully added") + " " + added + " " + translate("models"));
      }
    } finally {
      setFetchModelsSaving(false);
    }
  };
  // Resolve which connections a Run should cover for the chosen target.
  const resolveRunTargetConnections = (target) => {
    if (target === "all") return connections;
    return connectionBuckets[target] || [];
  };

  const openRunModal = () => {
    if (oneByOneRunning || connections.length === 0) return;
    setRunTarget("all");
    setShowRunModal(true);
  };

  // Runs "Test Connection" (credential probe) or "Warm Up" (tiny real chat
  // request) one-by-one over the selected target set.
  const handleRunOneByOne = async ({ mode, target } = {}) => {
    const runMode = mode || "test";
    const list = resolveRunTargetConnections(target || "all");
    if (oneByOneRunning || list.length === 0) return;

    setShowRunModal(false);

    const queuedState = Object.fromEntries(
      list.map((connection) => [connection.id, { state: "queued", error: null }]),
    );

    stopOneByOneRef.current = false;
    setOneByOneRunning(true);
    setOneByOneStopping(false);
    setOneByOneCurrentConnectionId(null);
    setOneByOneResults(queuedState);
    setOneByOneSummary({
      total: list.length,
      completed: 0,
      passed: 0,
      failed: 0,
      stopped: false,
      mode: runMode,
    });

    let passed = 0;
    let failed = 0;

    try {
      for (let index = 0; index < list.length; index += 1) {
        if (stopOneByOneRef.current) {
          setOneByOneSummary({
            total: list.length,
            completed: index,
            passed,
            failed,
            stopped: true,
            mode: runMode,
          });
          break;
        }

        const connection = list[index];
        setOneByOneCurrentConnectionId(connection.id);
        setOneByOneResults((prev) => ({
          ...prev,
          [connection.id]: { state: "testing", error: null },
        }));

        const endpoint = runMode === "warmup" ? "warmup" : "test";
        const failMessage = runMode === "warmup" ? "Warm-up failed" : "Test failed";

        try {
          const res = await fetch(`/api/providers/${connection.id}/${endpoint}`, { method: "POST" });
          const data = await res.json();
          const valid = !!data.valid;

          if (valid) {
            passed += 1;
          } else {
            failed += 1;
          }

          setOneByOneResults((prev) => ({
            ...prev,
            [connection.id]: {
              state: valid ? "success" : "failed",
              error: valid ? null : (data.error || null),
            },
          }));
          // Keep the persistent status badge in sync immediately.
          setConnections((prev) =>
            prev.map((c) =>
              c.id === connection.id
                ? {
                    ...c,
                    testStatus: valid ? "active" : "error",
                    lastError: valid ? null : (data.error || failMessage),
                    lastErrorAt: valid ? null : new Date().toISOString(),
                  }
                : c,
            ),
          );
        } catch (error) {
          failed += 1;
          const errMsg = error.message || failMessage;
          setOneByOneResults((prev) => ({
            ...prev,
            [connection.id]: {
              state: "failed",
              error: errMsg,
            },
          }));
          setConnections((prev) =>
            prev.map((c) =>
              c.id === connection.id
                ? {
                    ...c,
                    testStatus: "error",
                    lastError: errMsg,
                    lastErrorAt: new Date().toISOString(),
                  }
                : c,
            ),
          );
        }

        setOneByOneSummary({
          total: list.length,
          completed: index + 1,
          passed,
          failed,
          stopped: false,
          mode: runMode,
        });

        if (index < list.length - 1) {
          await sleep(ONE_BY_ONE_DELAY_MS);
        }
      }
    } finally {
      setOneByOneCurrentConnectionId(null);
      setOneByOneRunning(false);
      setOneByOneStopping(false);
      stopOneByOneRef.current = false;
    }
  };

  const handleStopOneByOneTest = () => {
    if (!oneByOneRunning) return;
    stopOneByOneRef.current = true;
    setOneByOneStopping(true);
  };

  const handleDelete = async (id) => {
    setConfirmState({
      title: "Delete Connection",
      message: "Delete this connection?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
          if (res.ok) {
            setConnections(prev => prev.filter(c => c.id !== id));
          }
        } catch (error) {
          console.log("Error deleting connection:", error);
        }
      }
    });
  };

  const handleBulkDelete = () => {
    const count = selectedConnectionIds.length;
    if (count === 0) return;
    setConfirmState({
      title: `Delete ${count} Connection${count > 1 ? "s" : ""}`,
      message: `Delete ${count} connection${count > 1 ? "s" : ""}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        let failed = 0;
        const idsToDelete = [...selectedConnectionIds];
        for (const id of idsToDelete) {
          try {
            const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
            if (!res.ok) failed += 1;
          } catch (error) {
            console.log("Error deleting connection:", error);
            failed += 1;
          }
        }
        setConnections(prev => prev.filter(c => !idsToDelete.includes(c.id)));
        setSelectedConnectionIds([]);
        if (failed > 0) alert(`Deleted ${idsToDelete.length - failed} connection(s), ${failed} failed.`);
      }
    });
  };

  const handleOAuthSuccess = () => {
    fetchConnections();
    setShowOAuthModal(false);
  };

  const handleIFlowCookieSuccess = () => {
    fetchConnections();
    setShowIFlowCookieModal(false);
  };

  const handleSaveApiKey = async (formData) => {
    setAddConnectionError("");
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, ...formData }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok) {
        await fetchConnections();
        setShowAddApiKeyModal(false);
        return;
      }

      setAddConnectionError(data?.error || "Failed to save connection");
    } catch (error) {
      console.log("Error saving connection:", error);
      setAddConnectionError("Failed to save connection");
    }
  };

  const handleUpdateConnection = async (formData) => {
    try {
      const res = await fetch(`/api/providers/${selectedConnection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchConnections();
        setShowEditModal(false);
      }
    } catch (error) {
      console.log("Error updating connection:", error);
    }
  };

  // Reflect a connection test result in the local list immediately so the
  // status badge updates without a full page refresh. The server already
  // persisted testStatus/lastError; this just syncs the UI.
  const handleConnectionTested = (id, result) => {
    setConnections((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              testStatus: result?.valid ? "active" : "error",
              lastError: result?.valid ? null : (result?.error || "Test failed"),
              lastErrorAt: result?.valid ? null : new Date().toISOString(),
            }
          : c,
      ),
    );
  };

  const handleUpdateConnectionStatus = async (id, isActive) => {
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, isActive } : c));
      }
    } catch (error) {
      console.log("Error updating connection status:", error);
    }
  };

  const handleSwapPriority = async (index1, index2) => {
    // Optimistic update state
    const newConnections = [...connections];
    [newConnections[index1], newConnections[index2]] = [newConnections[index2], newConnections[index1]];
    setConnections(newConnections);

    try {
      await Promise.all([
        fetch(`/api/providers/${newConnections[index1].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: index1 }),
        }),
        fetch(`/api/providers/${newConnections[index2].id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: index2 }),
        }),
      ]);
    } catch (error) {
      console.log("Error swapping priority:", error);
      await fetchConnections();
    }
  };

  const selectedConnections = connections.filter((conn) => selectedConnectionIds.includes(conn.id));

  const toggleSelectConnection = (connectionId) => {
    setSelectedConnectionIds((prev) => (
      prev.includes(connectionId)
        ? prev.filter((id) => id !== connectionId)
        : [...prev, connectionId]
    ));
  };

  const toggleSelectAllConnections = (scope) => {
    const list = Array.isArray(scope) && scope.length ? scope : connections;
    const allInScopeSelected = list.every((conn) => selectedConnectionIds.includes(conn.id));
    if (allInScopeSelected) {
      const scopeIds = new Set(list.map((conn) => conn.id));
      setSelectedConnectionIds((prev) => prev.filter((id) => !scopeIds.has(id)));
      return;
    }
    setSelectedConnectionIds((prev) => {
      const merged = new Set(prev);
      for (const conn of list) merged.add(conn.id);
      return [...merged];
    });
  };

  const clearSelection = () => {
    setSelectedConnectionIds([]);
    setBulkProxyPoolId("__none__");
  };

  useEffect(() => {
    setSelectedConnectionIds((prev) => prev.filter((id) => connections.some((conn) => conn.id === id)));
  }, [connections]);

  const selectedProxySummary = (() => {
    if (selectedConnections.length === 0) return "";
    const poolIds = new Set(selectedConnections.map((conn) => conn.providerSpecificData?.proxyPoolId || "__none__"));
    if (poolIds.size === 1) {
      const onlyId = [...poolIds][0];
      if (onlyId === "__none__") return "All selected currently unbound";
      const pool = proxyPools.find((p) => p.id === onlyId);
      return `All selected currently bound to ${pool?.name || onlyId}`;
    }
    return "Selected connections have mixed proxy bindings";
  })();

  const openBulkProxyModal = () => {
    if (selectedConnections.length === 0) return;
    const uniquePoolIds = [...new Set(selectedConnections.map((conn) => conn.providerSpecificData?.proxyPoolId || "__none__"))];
    setBulkProxyPoolId(uniquePoolIds.length === 1 ? uniquePoolIds[0] : "__none__");
    setShowBulkProxyModal(true);
  };

  const closeBulkProxyModal = () => {
    if (bulkUpdatingProxy) return;
    setShowBulkProxyModal(false);
  };

  const applyProxyAssignments = async (assignments) => {
    setBulkUpdatingProxy(true);
    try {
      let failed = 0;
      for (const { connectionId, proxyPoolId } of assignments) {
        try {
          const res = await fetch(`/api/providers/${connectionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proxyPoolId }),
          });
          if (!res.ok) failed += 1;
        } catch (e) {
          console.log("Error applying proxy for", connectionId, e);
          failed += 1;
        }
      }
      if (failed > 0) alert(`Updated with ${failed} failed request(s).`);
      await fetchConnections();
      setShowBulkProxyModal(false);
    } finally {
      setBulkUpdatingProxy(false);
    }
  };

  const handleApplySinglePool = (proxyPoolId) => {
    const targets = connections.map((c) => ({ connectionId: c.id, proxyPoolId }));
    return applyProxyAssignments(targets);
  };

  const handleApplyOneToOne = () => {
    const activePools = proxyPools.filter((p) => p.isActive === true);
    if (activePools.length === 0) {
      alert("No active proxy pools available.");
      return;
    }
    const targets = connections.map((c, i) => ({
      connectionId: c.id,
      proxyPoolId: activePools[i % activePools.length].id,
    }));
    return applyProxyAssignments(targets);
  };


  const isSelected = (connectionId) => selectedConnectionIds.includes(connectionId);

  // --- Accounts / Models tab split -------------------------------------------
  // Classify each connection into Active / Rate Limited / Error using the same
  // state the rest of the app already trusts: testStatus for active/error, and
  // the cooldown fields (rateLimitedUntil + flat modelLock_* fields) for rate
  // limiting. A disabled connection (isActive === false) never counts as rate
  // limited; it falls back to its test status bucket.
  const connectionBuckets = bucketConnections(connections);
  const accountsTabDefs = [
    { key: "active", label: translate("Active"), icon: "check_circle", count: connectionBuckets.active.length },
    { key: "rateLimited", label: translate("Rate Limited"), icon: "hourglass_top", count: connectionBuckets.rateLimited.length },
    { key: "error", label: translate("Error"), icon: "error", count: connectionBuckets.error.length },
  ];
  const renderConnectionsList = (list) => (
    <div className="flex min-w-0 flex-col divide-y divide-black/[0.03] dark:divide-white/[0.03] max-h-[500px] overflow-y-auto pr-1">
      {list
        .map((conn) => ({ conn, gi: connections.findIndex((c) => c.id === conn.id) }))
        .map(({ conn, gi }, index) => (
          <div key={conn.id} className="flex min-w-0 items-stretch">
            <div className="flex shrink-0 items-center pl-1 sm:pl-2">
              <input
                type="checkbox"
                checked={isSelected(conn.id)}
                onChange={() => toggleSelectConnection(conn.id)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
            <div className="flex-1 min-w-0">
              <ConnectionRow
                connection={conn}
                proxyPools={proxyPools}
                isOAuth={isOAuth}
                isFirst={index === 0}
                isLast={index === list.length - 1}
                onMoveUp={() => handleSwapPriority(gi, gi - 1)}
                onMoveDown={() => handleSwapPriority(gi, gi + 1)}
                onToggleActive={(isActive) => handleUpdateConnectionStatus(conn.id, isActive)}
                autoPing={AUTO_PING_SETTINGS_KEYS[providerId] && conn.authType === "oauth" ? {
                  on: autoPing.connections[conn.id] === true,
                  onToggle: (on) => handleAutoPingConnection(conn.id, on),
                  provider: providerId,
                } : null}
                onUpdateProxy={async (proxyPoolId) => {
                  try {
                    const res = await fetch(`/api/providers/${conn.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ proxyPoolId: proxyPoolId || null }),
                    });
                    if (res.ok) {
                      setConnections(prev => prev.map(c =>
                        c.id === conn.id
                          ? { ...c, providerSpecificData: { ...c.providerSpecificData, proxyPoolId: proxyPoolId || null } }
                          : c
                      ));
                    }
                  } catch (error) {
                    console.log("Error updating proxy:", error);
                  }
                }}
                onEdit={() => {
                  setSelectedConnection(conn);
                  setShowEditModal(true);
                }}
                onDelete={() => handleDelete(conn.id)}
                oneByOneStatus={oneByOneResults[conn.id] || null}
              />
            </div>
          </div>
        ))}
    </div>
  );

  const activePools = proxyPools.filter((p) => p.isActive === true);

  const bulkActionModal = (
    <Modal
      isOpen={showBulkProxyModal}
      onClose={closeBulkProxyModal}
      title={`Apply Proxy (${connections.length} connections)`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <button
            onClick={handleApplyOneToOne}
            disabled={bulkUpdatingProxy || activePools.length === 0}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-text-muted text-[18px]">sync_alt</span>
            <span className="text-sm text-text-main">One-to-one (rotate)</span>
          </button>
          <button
            onClick={() => handleApplySinglePool(null)}
            disabled={bulkUpdatingProxy}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-text-muted text-[18px]">link_off</span>
            <span className="text-sm text-text-main">None (unbind all)</span>
          </button>
          {proxyPools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => handleApplySinglePool(pool.id)}
              disabled={bulkUpdatingProxy || pool.isActive !== true}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-text-muted text-[18px]">lan</span>
              <span className="truncate text-sm text-text-main">{pool.name}</span>
              {pool.isActive !== true && (
                <span className="text-[10px] text-text-muted">(inactive)</span>
              )}
            </button>
          ))}
        </div>

        {bulkUpdatingProxy && <p className="text-xs text-text-muted">Applying...</p>}

        <Button onClick={closeBulkProxyModal} variant="ghost" fullWidth disabled={bulkUpdatingProxy}>
          Cancel
        </Button>
      </div>
    </Modal>
  );

  const pushModelToast = (modelId, ok, answer, errorText) => {
    const id = `${modelId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setModelAnswerToasts((prev) => [...prev, { id, modelId, ok, answer: answer || "", error: errorText || "" }]);
    const timer = setTimeout(() => {
      setModelAnswerToasts((prev) => prev.filter((t) => t.id !== id));
      modelToastTimersRef.current.delete(id);
    }, 6000);
    modelToastTimersRef.current.set(id, timer);
  };

  const handleTestModel = async (modelId, opts = {}) => {
    if (testingModelIds.has(modelId)) return null;
    const prompt = typeof opts.prompt === "string" && opts.prompt.trim() ? opts.prompt : modelTestPrompt;
    setTestingModelIds((prev) => new Set(prev).add(modelId));
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `${providerStorageAlias}/${modelId}`, prompt }),
      });
      const data = await res.json();
      setModelTestResults((prev) => ({ ...prev, [modelId]: data.ok ? "ok" : "error" }));
      if (!opts.silent) {
        if (data.ok) {
          pushModelToast(modelId, true, data.answer);
        } else {
          setModelsTestError(data.error || "Model not reachable");
          pushModelToast(modelId, false, "", data.error || "Model not reachable");
        }
      }
      return data;
    } catch {
      setModelTestResults((prev) => ({ ...prev, [modelId]: "error" }));
      if (!opts.silent) {
        setModelsTestError("Network error");
        pushModelToast(modelId, false, "", "Network error");
      }
      return { ok: false, error: "Network error" };
    } finally {
      setTestingModelIds((prev) => { const n = new Set(prev); n.delete(modelId); return n; });
    }
  };

  const handleTestAllModels = async (ids, opts = {}) => {
    if (testAllRunning) return;
    const list = Array.isArray(ids) ? ids : [];
    if (list.length === 0) return;
    const disableFailed = !!opts.disableFailed;
    setShowTestAllModal(false);
    stopTestAllRef.current = false;
    setTestAllRunning(true);
    setTestAllStopping(false);
    setTestAllSummary(null);
    const results = [];
    for (const id of list) {
      if (stopTestAllRef.current) break;
      setTestAllCurrentId(id);
      const data = await handleTestModel(id, { prompt: modelTestPrompt, silent: true });
      const ok = !!(data && data.ok);
      results.push({ id, ok, error: data && data.error, answer: data && data.answer });
      if (ok) {
        pushModelToast(id, true, data.answer);
      } else {
        pushModelToast(id, false, "", (data && data.error) || "Model not reachable");
      }
    }
    const summary = summarizeModelTests(results, { stopped: stopTestAllRef.current, disableFailed });
    // Disable the failures in one batch when the user chose "Test All + Disable".
    if (disableFailed && summary.failedIds.length > 0) {
      try {
        const res = await fetch("/api/models/disabled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerAlias: providerStorageAlias, ids: summary.failedIds }),
        });
        if (res.ok) {
          summary.disabled = summary.failedIds.length;
          await fetchDisabledModels();
        }
      } catch (error) {
        console.log("Error disabling failed models:", error);
      }
    }
    setTestAllCurrentId(null);
    setTestAllRunning(false);
    setTestAllStopping(false);
    setTestAllSummary(summary);
    stopTestAllRef.current = false;
  };

  const handleStopTestAllModels = () => {
    stopTestAllRef.current = true;
    setTestAllStopping(true);
  };

  const renderModelsSection = () => {
    if (isCompatible) {
      return (
        <CompatibleModelsSection
          providerStorageAlias={providerStorageAlias}
          providerDisplayAlias={providerDisplayAlias}
          modelAliases={modelAliases}
          customModels={customModels}
          copied={copied}
          onCopy={copy}
          onSetAlias={handleSetAlias}
          onDeleteAlias={handleDeleteAlias}
          onAddCustomModel={(modelId) => handleAddCustomModel(modelId, "llm", providerStorageAlias)}
          onDeleteCustomModel={(modelId) => handleDeleteCustomModel(modelId, "llm", providerStorageAlias)}
          connections={connections}
          isAnthropic={isAnthropicCompatible}
        />
      );
    }
    // Combine hardcoded models with Kilo free models (deduplicated)
    // Exclude non-llm models (embedding, tts, etc.) — they have dedicated pages under media-providers
    const allModels = [
      ...models,
      ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
    ].filter((m) => { const k = getModelKind(m); return !k || k === "llm"; });
    const disabledSet = new Set(disabledModelIds);
    const displayModels = allModels.filter((m) => !disabledSet.has(m.id));
    const disabledDisplayModels = allModels.filter((m) => disabledSet.has(m.id));
    const customModelRows = getProviderCustomModelRows({
      customModels,
      modelAliases,
      providerAlias: providerStorageAlias,
      builtInModels: models,
      type: "llm",
    });

    // Build unified table rows: custom first, then enabled built-in/Kilo, then disabled.
    const builtInRows = displayModels.map((model) => {
      const fullModel = `${providerStorageAlias}/${model.id}`;
      const oldFormatModel = `${providerId}/${model.id}`;
      const existingAlias = Object.entries(modelAliases).find(
        ([, m]) => m === fullModel || m === oldFormatModel
      )?.[0];
      const suffix = resolveThinkingSuffix(model.id);
      const caps = getCaps(`${providerId}/${model.id}`);
      return {
        key: model.id,
        id: model.id,
        displayModel: suffix ? `${providerDisplayAlias}/${model.id}(${suffix})` : `${providerDisplayAlias}/${model.id}`,
        name: model.name,
        caps,
        contextWindow: caps?.contextWindow ?? model.contextLength,
        maxOutput: caps?.maxOutput ?? model.maxOutputTokens,
        alias: existingAlias,
        testStatus: modelTestResults[model.id],
        isTesting: testingModelIds.has(model.id),
        isCustom: false,
        isFree: !!model.isFree,
        onTest: connections.length > 0 || isFreeNoAuth ? () => handleTestModel(model.id) : undefined,
        onSetAlias: (alias) => handleSetAlias(model.id, alias, providerStorageAlias),
        onDeleteAlias: () => handleDeleteAlias(existingAlias),
        onDisable: () => handleDisableModel(model.id),
      };
    });

    const disabledRows = disabledDisplayModels.map((model) => {
      const suffix = resolveThinkingSuffix(model.id);
      const caps = getCaps(`${providerId}/${model.id}`);
      return {
        key: `disabled-${model.id}`,
        id: model.id,
        displayModel: suffix ? `${providerDisplayAlias}/${model.id}(${suffix})` : `${providerDisplayAlias}/${model.id}`,
        name: model.name,
        caps,
        contextWindow: caps?.contextWindow ?? model.contextLength,
        maxOutput: caps?.maxOutput ?? model.maxOutputTokens,
        alias: undefined,
        testStatus: undefined,
        isDisabled: true,
        isFree: !!model.isFree,
        onEnable: () => handleEnableModel(model.id),
      };
    });

    const customRows = customModelRows.map((model) => {
      const suffix = resolveThinkingSuffix(model.id);
      const caps = getCaps(`${providerId}/${model.id}`);
      return {
        key: `${model.source}-${model.fullModel}`,
        id: model.id,
        displayModel: suffix ? `${providerDisplayAlias}/${model.id}(${suffix})` : `${providerDisplayAlias}/${model.id}`,
        name: model.name,
        caps,
        contextWindow: caps?.contextWindow,
        maxOutput: caps?.maxOutput,
        alias: model.alias,
        testStatus: modelTestResults[model.id],
        isTesting: testingModelIds.has(model.id),
        isCustom: true,
        isFree: false,
        onTest: connections.length > 0 || isFreeNoAuth ? () => handleTestModel(model.id) : undefined,
        onDeleteCustom: () => {
          if (model.source === "custom") {
            handleDeleteCustomModel(model.id, "llm", providerStorageAlias);
          } else {
            handleDeleteAlias(model.alias);
          }
        },
      };
    });

    const tableRows = [...customRows, ...builtInRows, ...disabledRows];

    return (
      <div className="flex flex-col gap-3">
        <ModelsTable rows={tableRows} copied={copied} onCopy={copy} />

        <div className="flex flex-wrap gap-3">
          {/* Add model button — inline, same style as model chips */}
          <button
            onClick={() => setShowAddCustomModel(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/5 sm:w-auto"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Model
          </button>

          {/* Fetch Models button — available for every provider with an active connection */}
          {(connections.some((conn) => conn.isActive !== false) || isFreeNoAuth) && (
            <button
              onClick={handleOpenFetchModels}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-500/40 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 transition-colors hover:border-blue-500 hover:bg-blue-500/5 sm:w-auto"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              {translate("Fetch Models")}
            </button>
          )}
        </div>

        {/* Suggested models from provider API — show only models not yet added */}
        {suggestedModels.length > 0 && (() => {
          const addedFullModels = new Set([
            ...Object.values(modelAliases),
            ...customModelRows.map((model) => model.fullModel),
          ]);
          const hardcodedIds = new Set(models.map((m) => m.id));
          const notAdded = suggestedModels.filter(
            (m) => !addedFullModels.has(`${providerStorageAlias}/${m.id}`) && !hardcodedIds.has(m.id)
          );
          if (notAdded.length === 0) return null;
          return (
            <div>
              <p className="text-xs text-text-muted mb-2">Suggested free models (≥200k context):</p>
              <div className="flex flex-wrap gap-2">
                {notAdded.map((m) => (
                  <button
                    key={m.id}
                    onClick={async () => {
                      await handleAddCustomModel(m.id, "llm", providerStorageAlias);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    title={`${m.name} · ${(m.contextLength / 1000).toFixed(0)}k ctx`}
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                    {m.id.split("/").pop()}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
}

  if (!providerInfo) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Provider not found</p>
        <Link href="/dashboard/providers" className="text-primary mt-4 inline-block">
          Back to Providers
        </Link>
      </div>
    );
  }

  // Determine icon path: OpenAI Compatible providers use specialized icons
  const getHeaderIconPath = () => {
    if (isOpenAICompatible && providerInfo.apiType) {
      return providerInfo.apiType === "responses" ? "/providers/oai-r.png" : "/providers/oai-cc.png";
    }
    if (isAnthropicCompatible) {
      return "/providers/anthropic-m.png";
    }
    return getProviderIconSrc(providerInfo.id);
  };

  const mainTabDefs = [
    { key: "accounts", label: translate("Accounts"), icon: "group", count: connections.length },
    { key: "models", label: translate("Models"), icon: "deployed_code", count: null },
    { key: "quota", label: translate("Quota"), icon: "data_usage", count: null },
  ];

  const renderTabs = (defs, active, onSelect, opts = {}) => (
    <div className={`flex flex-wrap items-center gap-1 ${opts.wrap === false ? "" : "border-b border-black/[0.06] dark:border-white/[0.06]"}`}>
      {defs.map((def) => {
        const isActive = def.key === active;
        return (
          <button
            key={def.key}
            onClick={() => onSelect(def.key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${isActive
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:border-black/10 hover:text-text-main dark:hover:border-white/10"}`}
          >
            {def.icon && (
              <span className="material-symbols-outlined text-[16px]">{def.icon}</span>
            )}
            {def.label}
            {def.count != null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${isActive ? "bg-primary/15 text-primary" : "bg-black/[0.06] text-text-muted dark:bg-white/[0.08]"}`}>
                {def.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:gap-8 sm:px-0">
      {/* Header */}
      <div className="min-w-0">
        <Link
          href="/dashboard/providers"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Providers
        </Link>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${providerInfo.color}15` }}
          >
            {headerImgError || !getHeaderIconPath() ? (
              <span className="text-sm font-bold" style={{ color: providerInfo.color }}>
                {providerInfo.textIcon || providerInfo.id.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <Image
                src={getHeaderIconPath()}
                alt={providerInfo.name}
                width={48}
                height={48}
                className="max-h-12 max-w-12 rounded-lg object-contain"
                sizes="48px"
                onError={() => {
                  markProviderIconMissing(providerInfo.id);
                  setHeaderImgError(true);
                }}
              loading="lazy"
              decoding="async"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{providerInfo.name}</h1>
              {(providerInfo.notice?.apiKeyUrl || providerInfo.notice?.signupUrl || providerInfo.website) && (
                <a
                  href={providerInfo.notice?.apiKeyUrl || providerInfo.notice?.signupUrl || providerInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  {providerInfo.notice?.apiKeyUrl ? "Get API Key" : "Sign up / Learn more"}
                </a>
              )}
            </div>
            <p className="text-text-muted">
              {connections.length} connection{connections.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      {providerInfo.deprecated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <span className="material-symbols-outlined text-[16px] text-yellow-500 mt-0.5 shrink-0">warning</span>
          <p className="text-xs text-red-600 dark:text-yellow-400 leading-relaxed">{providerInfo.deprecationNotice}</p>
        </div>
      )}

      {providerInfo.notice?.text && !providerInfo.deprecated && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 sm:flex-row sm:items-center">
          <span className="material-symbols-outlined text-[16px] text-blue-500 shrink-0">info</span>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-blue-600 dark:text-blue-400">{providerInfo.notice.text}</p>
          {providerInfo.notice.apiKeyUrl && (
            <a
              href={providerInfo.notice.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex justify-center rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 sm:py-0.5"
            >
              Get API Key →
            </a>
          )}
        </div>
      )}

      {/* Main tabs: Accounts / Models */}
      {renderTabs(mainTabDefs, mainTab, setMainTab, { wrap: false })}

      {isCompatible && providerNode && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{isAnthropicCompatible ? "Anthropic Compatible Details" : "OpenAI Compatible Details"}</h2>
              <p className="break-all text-sm text-text-muted">
                {isAnthropicCompatible ? "Messages API" : (providerNode.apiType === "responses" ? "Responses API" : "Chat Completions")} · {(providerNode.baseUrl || "").replace(/\/$/, "")}/
                {isAnthropicCompatible ? "messages" : (providerNode.apiType === "responses" ? "responses" : "chat/completions")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center">
              <Button
                size="sm"
                icon="add"
                onClick={() => {
                  setAddConnectionError("");
                  setShowAddApiKeyModal(true);
                }}
                className="w-full sm:w-auto"
              >
                Add API Key
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="edit"
                onClick={() => setShowEditNodeModal(true)}
                className="w-full sm:w-auto"
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="delete"
                onClick={async () => {
                  setConfirmState({
                    title: "Delete Compatible Node",
                    message: `Delete this ${isAnthropicCompatible ? "Anthropic" : "OpenAI"} Compatible node?`,
                    onConfirm: async () => {
                      setConfirmState(null);
                      try {
                        const res = await fetch(`/api/provider-nodes/${providerId}`, { method: "DELETE" });
                        if (res.ok) {
                          router.push("/dashboard/providers");
                        }
                      } catch (error) {
                        console.log("Error deleting provider node:", error);
                      }
                    }
                  });
                }}
                className="w-full sm:w-auto"
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Accounts tab: connections + provider overrides */}
      {mainTab === "accounts" && (
      <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      {isFreeNoAuth ? (
        <NoAuthProxyCard providerId={providerId} />
      ) : (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Connections</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {connections.length > 0 && proxyPools.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon="lan"
                  onClick={() => setShowBulkProxyModal(true)}
                >
                  Apply Proxy
                </Button>
              )}
              {connections.length > 0 && (
                <>
                  {selectedConnectionIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon="delete"
                      onClick={handleBulkDelete}
                    >
                      Delete Selected ({selectedConnectionIds.length})
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="sync"
                    onClick={openRunModal}
                    disabled={oneByOneRunning}
                  >
                    {oneByOneRunning
                      ? (oneByOneSummary?.mode === "warmup" ? "Warming Up…" : "Testing…")
                      : "Test / Warm Up…"}
                  </Button>
                  {oneByOneRunning && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="stop"
                      onClick={handleStopOneByOneTest}
                      disabled={oneByOneStopping}
                    >
                      {oneByOneStopping ? "Stopping..." : "Stop"}
                    </Button>
                  )}
                </>
              )}
              {/* Round Robin toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted font-medium">Round Robin</span>
                <Toggle
                  checked={providerStrategy === "round-robin"}
                  onChange={handleRoundRobinToggle}
                />
                {providerStrategy === "round-robin" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-muted">Sticky:</span>
                    <input
                      type="number"
                      min={1}
                      value={providerStickyLimit}
                      onChange={(e) => handleStickyLimitChange(e.target.value)}
                      placeholder="1"
                      className="w-14 px-2 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {connections.length === 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary shrink-0">
                  <span className="material-symbols-outlined text-[18px]">{isOAuth ? "lock" : "key"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-muted">No connections yet</p>
                  {hasDualAuthModes && (
                    <p className="text-xs text-text-muted">
                      Choose {oauthConnectionLabel} or {apiKeyConnectionLabel}.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {(providerId === "codebuddy-cn" || providerId === "codebuddy-intl") && (
                  <Button size="sm" icon="playlist_add" variant="secondary" onClick={() => setShowBulkImportCodeBuddy(true)}>
                    {translate("Bulk Add")}
                  </Button>
                )}
                {hasDualAuthModes ? (
                  <>
                    <Button size="sm" icon="lock" variant="secondary" onClick={triggerOAuthConnection}>
                      {oauthConnectionLabel}
                    </Button>
                    <Button size="sm" icon="key" onClick={triggerApiKeyConnection}>
                      {apiKeyConnectionLabel}
                    </Button>
                  </>
                ) : (
                  <>
                    {!isCompatible && providerId === "iflow" && (
                      <Button size="sm" icon="cookie" variant="secondary" onClick={() => setShowIFlowCookieModal(true)}>
                        Cookie
                      </Button>
                    )}
                    {providerId === "codex" && (
                      <Button size="sm" icon="playlist_add" variant="secondary" onClick={() => setShowBulkImportCodex(true)}>
                        {translate("Bulk Add")}
                      </Button>
                    )}
                    {providerId === "grok-cli" && (
                      <Button size="sm" icon="playlist_add" variant="secondary" onClick={() => setShowBulkImportGrokCli(true)}>
                        {translate("Bulk Add")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      icon="add"
                      onClick={triggerAddConnection}
                    >
                      {isCompatible ? "Add API Key" : (providerId === "iflow" ? "OAuth" : "Add Connection")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {oneByOneSummary && (
                <div className="mb-4 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-text-muted dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-text-main">
                      {oneByOneSummary.mode === "warmup" ? "Warm Up" : "Test Connection"}
                    </span>
                    <span>Total: {oneByOneSummary.total}</span>
                    <span>Completed: {oneByOneSummary.completed}</span>
                    <span>Passed: {oneByOneSummary.passed}</span>
                    <span>Failed: {oneByOneSummary.failed}</span>
                    {oneByOneSummary.stopped && (
                      <span className="text-amber-600 dark:text-amber-400">Stopped</span>
                    )}
                    {oneByOneRunning && oneByOneCurrentConnectionId && (
                      <span>Running: {connections.find((conn) => conn.id === oneByOneCurrentConnectionId)?.name || oneByOneCurrentConnectionId}</span>
                    )}
                  </div>
                </div>
              )}
              {/* Accounts sub-tabs: Active / Rate Limited / Error */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                {renderTabs(accountsTabDefs, accountsTab, setAccountsTab, { wrap: false })}
                {connectionBuckets[accountsTab].length > 0 && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-muted hover:text-primary">
                    <input
                      type="checkbox"
                      checked={connectionBuckets[accountsTab].length > 0 && connectionBuckets[accountsTab].every((c) => isSelected(c.id))}
                      onChange={() => toggleSelectAllConnections(connectionBuckets[accountsTab])}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    Select All
                  </label>
                )}
              </div>
              {connectionBuckets[accountsTab].length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <span className="material-symbols-outlined text-3xl text-text-muted/40">
                    {accountsTab === "rateLimited" ? "hourglass_empty" : accountsTab === "error" ? "check_circle" : "group_off"}
                  </span>
                  <p className="text-sm text-text-muted">
                    {accountsTab === "rateLimited"
                      ? translate("No rate-limited accounts")
                      : accountsTab === "error"
                        ? translate("No accounts with errors")
                        : translate("No active accounts")}
                  </p>
                </div>
              ) : (
                renderConnectionsList(connectionBuckets[accountsTab])
              )}
              {!isCompatible && (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:flex">
                  {providerId === "iflow" && (
                    <Button
                      size="sm"
                      icon="cookie"
                      variant="secondary"
                      onClick={() => setShowIFlowCookieModal(true)}
                      title="Add connection using browser cookie"
                      className="w-full sm:w-auto"
                    >
                      Cookie
                    </Button>
                  )}
                  {providerId === "codex" && (
                    <Button
                      size="sm"
                      icon="playlist_add"
                      variant="secondary"
                      onClick={() => setShowBulkImportCodex(true)}
                      title={translate("Bulk import codex accounts from JSON")}
                      className="w-full sm:w-auto"
                    >
                      {translate("Bulk Add")}
                    </Button>
                  )}
                  {providerId === "grok-cli" && (
                    <Button
                      size="sm"
                      icon="playlist_add"
                      variant="secondary"
                      onClick={() => setShowBulkImportGrokCli(true)}
                      title={translate("Bulk import Grok CLI accounts from JSON")}
                      className="w-full sm:w-auto"
                    >
                      {translate("Bulk Add")}
                    </Button>
                  )}
                  {(providerId === "codebuddy-cn" || providerId === "codebuddy-intl") && (
                    <Button
                      size="sm"
                      icon="playlist_add"
                      variant="secondary"
                      onClick={() => setShowBulkImportCodeBuddy(true)}
                      title={translate("Bulk import CodeBuddy accounts from JSON")}
                      className="w-full sm:w-auto"
                    >
                      {translate("Bulk Add")}
                    </Button>
                  )}
                  {hasDualAuthModes ? (
                    <>
                      <Button
                        size="sm"
                        icon="lock"
                        variant="secondary"
                        onClick={triggerOAuthConnection}
                        className="w-full sm:w-auto"
                      >
                        {oauthConnectionLabel}
                      </Button>
                      <Button
                        size="sm"
                        icon="key"
                        onClick={triggerApiKeyConnection}
                        className="w-full sm:w-auto"
                      >
                        {apiKeyConnectionLabel}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      icon="add"
                      onClick={triggerAddConnection}
                      className="w-full sm:w-auto"
                    >
                      Add
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Per-provider user overrides (custom headers / connect timeout) */}
      <CustomConfigCard providerId={providerId} />
      </div>
      )}

      {/* Models tab */}
      {mainTab === "models" && (
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {"Available Models"}
            </h2>
            {providerThinkingLevels && (
              <select
                value={thinkingMode}
                onChange={(e) => handleThinkingModeChange(e.target.value)}
                title="Appends (level) suffix to copied model names"
                className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
              >
                {providerThinkingLevels.map((opt) => (
                  <option key={opt} value={opt}>{`Thinking: ${opt.charAt(0).toUpperCase() + opt.slice(1)}`}</option>
                ))}
              </select>
            )}
          </div>
          {!isCompatible && (() => {
            const allIds = [
              ...models,
              ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
            ].filter((m) => { const k = getModelKind(m); return !k || k === "llm"; }).map((m) => m.id);
            const activeIds = allIds.filter((id) => !disabledModelIds.includes(id));
            const canTest = (connections.length > 0 || isFreeNoAuth) && allIds.length > 0;
            return (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canTest && !testAllRunning && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon="science"
                    onClick={() => setShowTestAllModal(true)}
                    title="Test every model in this provider, one by one"
                  >
                    Test All Models
                  </Button>
                )}
                {testAllRunning && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon="stop_circle"
                    disabled={testAllStopping}
                    onClick={handleStopTestAllModels}
                  >
                    {testAllStopping ? "Stopping..." : "Stop"}
                  </Button>
                )}
                {disabledModelIds.length > 0 && (
                  <Button size="sm" variant="secondary" icon="restart_alt" onClick={handleEnableAll}>
                    Active All
                  </Button>
                )}
                {activeIds.length > 0 && (
                  <Button size="sm" variant="secondary" icon="block" onClick={() => handleDisableAll(activeIds)}>
                    Disable All
                  </Button>
                )}
              </div>
            );
          })()}
        </div>
        {!isCompatible && (connections.length > 0 || isFreeNoAuth) && (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs font-medium text-muted-foreground sm:whitespace-nowrap">Test prompt</label>
            <input
              type="text"
              value={modelTestPrompt}
              onChange={(e) => setModelTestPrompt(e.target.value)}
              disabled={testAllRunning}
              placeholder={DEFAULT_MODEL_TEST_PROMPT}
              className="w-full flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none disabled:opacity-60"
            />
            {testAllRunning && (
              <span className="text-xs text-muted-foreground sm:whitespace-nowrap">
                {testAllCurrentId ? `Testing ${providerDisplayAlias}/${testAllCurrentId}...` : "Testing..."}
              </span>
            )}
            {!testAllRunning && testAllSummary && (
              <span className="text-xs text-muted-foreground sm:whitespace-nowrap">
                {testAllSummary.stopped
                  ? `Stopped: ${testAllSummary.completed}/${testAllSummary.total}`
                  : `Done: ${testAllSummary.passed} passed, ${testAllSummary.failed} failed`}
                {testAllSummary.disabled > 0 ? `, ${testAllSummary.disabled} disabled` : ""}
              </span>
            )}
          </div>
        )}
        {!!modelsTestError && (
          <div className="mb-3">
            <p className="text-xs text-red-500 break-words">{modelsTestError}</p>
            {/RegionError|hosted in China|regionNotAllowed/i.test(modelsTestError) && (() => {
              const str = typeof modelsTestError === "string" ? modelsTestError : JSON.stringify(modelsTestError);
              const linkMatch = str.match(/https:\/\/opencode\.ai\/workspace\/[^\s"')]+/);
              const wrkMatch = str.match(/wrk_[0-9A-Za-z]+/);
              const targetUrl = linkMatch
                ? (linkMatch[0].endsWith("/go") ? linkMatch[0] : `${linkMatch[0]}/go`)
                : wrkMatch
                  ? `https://opencode.ai/workspace/${wrkMatch[0]}/go`
                  : "https://opencode.ai";

              return (
                <div className="mt-1.5">
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
                  >
                    <span>Allow China-hosted models</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              );
            })()}
          </div>
        )}
        {providerId === "zed" && !!liveModelsError && (
          <p className="text-xs text-red-500 mb-3 break-words">{liveModelsError}</p>
        )}
        {renderModelsSection()}
      </Card>
      )}

      {/* Quota tab */}
      {mainTab === "quota" && (
        <ProviderQuotaTab providerId={providerId} connections={connections} />
      )}

      {bulkActionModal}

      {/* Modals */}
      {providerId === "kiro" ? (
        <KiroOAuthWrapper
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "cursor" ? (
        <CursorAuthModal
          isOpen={showOAuthModal}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "zed" ? (
        <ZedAuthModal
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : providerId === "gitlab" ? (
        <GitLabAuthModal
          isOpen={showOAuthModal}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      ) : (
        <OAuthModal
          isOpen={showOAuthModal}
          provider={providerId}
          providerInfo={providerInfo}
          onSuccess={handleOAuthSuccess}
          onClose={() => setShowOAuthModal(false)}
        />
      )}

      {/* Xiaomi Desktop: auto-import local credentials modal */}
      <XiaomiMimoAuthModal
        isOpen={showXiaomiMimoModal}
        onSuccess={handleOAuthSuccess}
        onClose={() => setShowXiaomiMimoModal(false)}
      />
      {providerId === "iflow" && (
        <IFlowCookieModal
          isOpen={showIFlowCookieModal}
          onSuccess={handleIFlowCookieSuccess}
          onClose={() => setShowIFlowCookieModal(false)}
        />
      )}
      <AddApiKeyModal
        isOpen={showAddApiKeyModal}
        provider={providerId}
        providerName={providerInfo.name}
        isCompatible={isCompatible}
        isAnthropic={isAnthropicCompatible}
        authType={providerInfo?.authType}
        authHint={providerInfo?.authHint}
        website={providerInfo?.website}
        proxyPools={proxyPools}
        error={addConnectionError}
        existingNames={connections.map((c) => c.name).filter(Boolean)}
        onSave={handleSaveApiKey}
        onBulkDone={fetchConnections}
        onClose={() => {
          setAddConnectionError("");
          setShowAddApiKeyModal(false);
        }}
      />
      <EditConnectionModal
        isOpen={showEditModal}
        connection={selectedConnection}
        proxyPools={proxyPools}
        onSave={handleUpdateConnection}
        onTested={handleConnectionTested}
        onClose={() => setShowEditModal(false)}
      />
      {isCompatible && (
        <EditCompatibleNodeModal
          isOpen={showEditNodeModal}
          node={providerNode}
          onSave={handleUpdateNode}
          onClose={() => setShowEditNodeModal(false)}
          isAnthropic={isAnthropicCompatible}
        />
      )}
      {!isCompatible && (
        <AddCustomModelModal
          isOpen={showAddCustomModel}
          providerAlias={providerStorageAlias}
          providerDisplayAlias={providerDisplayAlias}
          onSave={async (modelId, caps, transport) => {
            // caps.stt is a UI-only flag; the API accepts transports only on
            // type "stt" records, so the save derives the type from it.
            await handleAddCustomModel(modelId, caps?.stt ? "stt" : "llm", providerStorageAlias, caps, transport);
            setShowAddCustomModel(false);
          }}
          onClose={() => setShowAddCustomModel(false)}
        />
      )}

      <FetchModelsModal
        isOpen={showFetchModels}
        connectionId={(connections.find((conn) => conn.isActive !== false) || connections[0] || {}).id}
        providerDisplayAlias={providerDisplayAlias}
        existingModelIds={existingModelIds}
        onSaveSelected={handleSaveFetchedModels}
        onClose={() => setShowFetchModels(false)}
      />
      {providerId === "codex" && (
        <BulkImportCodexModal
          isOpen={showBulkImportCodex}
          onClose={() => setShowBulkImportCodex(false)}
          onSuccess={fetchConnections}
        />
      )}

      {providerId === "grok-cli" && (
        <BulkImportGrokCliModal
          isOpen={showBulkImportGrokCli}
          onClose={() => setShowBulkImportGrokCli(false)}
          onSuccess={fetchConnections}
        />
      )}

      {!isCompatible && (providerId === "codebuddy-cn" || providerId === "codebuddy-intl") && (
        <BulkImportCodeBuddyModal
          isOpen={showBulkImportCodeBuddy}
          onClose={() => setShowBulkImportCodeBuddy(false)}
          onSuccess={fetchConnections}
          provider={providerId}
        />
      )}

      {/* AG Risk Confirmation Modal */}
      <ConfirmModal
        isOpen={showAgRiskModal}
        onClose={() => setShowAgRiskModal(false)}
        onConfirm={handleAgRiskConfirm}
        title="Risk Notice"
        message={providerInfo?.deprecationNotice}
        confirmText="I Understand, Continue"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />

      {/* Run picker: choose mode (Test / Warm Up) + target (All / Active / Rate Limited / Error) */}
      <Modal
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
        title="Test / Warm Up Connections"
        size="sm"
      >
        {(() => {
          const targetDefs = [
            { key: "all", label: "All", icon: "select_all", count: connections.length },
            { key: "active", label: "Active", icon: "check_circle", count: connectionBuckets.active.length },
            { key: "rateLimited", label: "Rate Limited", icon: "hourglass_top", count: connectionBuckets.rateLimited.length },
            { key: "error", label: "Error", icon: "error", count: connectionBuckets.error.length },
          ];
          const targetCount = (runTarget === "all" ? connections : connectionBuckets[runTarget] || []).length;
          return (
            <div className="flex flex-col gap-4">
              {/* Mode */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Mode</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRunMode("test")}
                    className={`flex flex-col gap-1 rounded-[10px] border p-3 text-left transition-colors ${
                      runMode === "test"
                        ? "border-brand-500/60 bg-brand-500/10"
                        : "border-border bg-surface-2 hover:bg-surface-3"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-main">
                      <span className="material-symbols-outlined text-[18px] text-brand-500">network_check</span>
                      Test Connection
                    </span>
                    <span className="text-xs text-text-muted">
                      Verify credentials &amp; reachability (light probe, no chat request).
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunMode("warmup")}
                    className={`flex flex-col gap-1 rounded-[10px] border p-3 text-left transition-colors ${
                      runMode === "warmup"
                        ? "border-amber-500/60 bg-amber-500/10"
                        : "border-border bg-surface-2 hover:bg-surface-3"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-main">
                      <span className="material-symbols-outlined text-[18px] text-amber-500">local_fire_department</span>
                      Warm Up
                    </span>
                    <span className="text-xs text-text-muted">
                      Send a tiny real request to wake the session / quota window.
                    </span>
                  </button>
                </div>
              </div>

              {/* Target */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Target</span>
                <div className="grid grid-cols-2 gap-2">
                  {targetDefs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setRunTarget(t.key)}
                      className={`flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2 text-left transition-colors ${
                        runTarget === t.key
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-surface-2 hover:bg-surface-3"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm text-text-main">
                        <span className="material-symbols-outlined text-[18px] text-text-muted">{t.icon}</span>
                        {t.label}
                      </span>
                      <span className="text-xs font-semibold text-text-muted">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-text-muted">
                {targetCount === 0
                  ? "No connections match this target."
                  : `${runMode === "warmup" ? "Warm up" : "Test"} ${targetCount} connection${targetCount === 1 ? "" : "s"}, one by one.`}
              </p>
            </div>
          );
        })()}
        <div className="mt-5 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowRunModal(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            icon={runMode === "warmup" ? "local_fire_department" : "play_arrow"}
            onClick={() => handleRunOneByOne({ mode: runMode, target: runTarget })}
            disabled={
              (runTarget === "all" ? connections : connectionBuckets[runTarget] || []).length === 0
            }
          >
            {runMode === "warmup" ? "Warm Up" : "Run Test"}
          </Button>
        </div>
      </Modal>

      {/* Test All Models mode picker */}
      <Modal
        isOpen={showTestAllModal}
        onClose={() => setShowTestAllModal(false)}
        title="Test All Models"
        size="sm"
      >
        {(() => {
          // Match the rows shown in the Models tab: built-in + Kilo free + custom.
          const builtInAndFree = [
            ...models,
            ...kiloFreeModels.filter((fm) => !models.some((m) => m.id === fm.id)),
          ].filter((m) => { const k = getModelKind(m); return !k || k === "llm"; }).map((m) => m.id);
          const customIds = getProviderCustomModelRows({
            customModels,
            modelAliases,
            providerAlias: providerStorageAlias,
            builtInModels: models,
            type: "llm",
          }).map((m) => m.id);
          // Only test models that are NOT disabled — disabled models are skipped.
          const disabledSet = new Set(disabledModelIds);
          const ids = Array.from(new Set([...builtInAndFree, ...customIds])).filter(
            (id) => !disabledSet.has(id)
          );
          const count = ids.length;
          const skippedCount = disabledModelIds.length;
          return (
            <div className="flex flex-col gap-3">
              {count === 0 ? (
                <p className="text-sm text-text-muted">
                  No active models to test in {providerDisplayAlias} — every model is currently disabled.
                </p>
              ) : (
                <p className="text-sm text-text-muted">
                  Test all {count} model{count === 1 ? "" : "s"} in {providerDisplayAlias} one by one.
                  Choose what to do with the models that fail.
                  {skippedCount > 0 && (
                    <span className="block text-xs">
                      {skippedCount} disabled model{skippedCount === 1 ? "" : "s"} will be skipped.
                    </span>
                  )}
                </p>
              )}
              <button
                type="button"
                disabled={count === 0}
                onClick={() => handleTestAllModels(ids, { disableFailed: false })}
                className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2 p-3 text-left transition-colors hover:border-brand-500/50 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-brand-500">science</span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-text-main">Test All Models Only</span>
                  <span className="text-xs text-text-muted">Just test every model. Nothing is disabled.</span>
                </span>
              </button>
              <button
                type="button"
                disabled={count === 0}
                onClick={() => handleTestAllModels(ids, { disableFailed: true })}
                className="flex items-start gap-3 rounded-[10px] border border-border bg-surface-2 p-3 text-left transition-colors hover:border-red-500/50 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-red-500">block</span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-text-main">Test All Models + Disable</span>
                  <span className="text-xs text-text-muted">Test every model and auto-disable the ones that fail.</span>
                </span>
              </button>
            </div>
          );
        })()}
      </Modal>

      {/* Model answer toasts (bottom-right, auto-hide) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,26rem)] flex-col gap-2">
        {modelAnswerToasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto overflow-hidden rounded-lg border bg-background/95 shadow-lg backdrop-blur transition-all ${
              t.ok ? "border-emerald-500/40" : "border-red-500/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`material-symbols-outlined text-[15px] ${t.ok ? "text-emerald-500" : "text-red-500"}`}>
                  {t.ok ? "check_circle" : "error"}
                </span>
                <span className="truncate text-xs font-medium">{`${providerDisplayAlias}/${t.modelId}`}</span>
              </div>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const timer = modelToastTimersRef.current.get(t.id);
                  if (timer) clearTimeout(timer);
                  modelToastTimersRef.current.delete(t.id);
                  setModelAnswerToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto px-3 py-2">
              {t.ok ? (
                <MarkdownMini>{t.answer && t.answer.trim() ? t.answer : "(empty response)"}</MarkdownMini>
              ) : (
                <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">{t.error || "Model not reachable"}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
