"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/shared/components";
import { AI_PROVIDERS, getProviderAlias, MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { getModelsByProviderId, getModelKind } from "@/shared/constants/models";
import ResultView from "./ResultView";

/**
 * MediaPlayground — a clean, chat-style playground for any media provider kind.
 *
 * Instead of exposing raw request fields, the user simply types text and hits
 * Generate. The component builds the correct request for the kind, fires it at
 * the local Mirai proxy (/api/v1/...), and renders the result as a chat bubble.
 *
 * Purely additive: it never mutates provider definitions or the existing
 * per-kind example cards, which stay below it on the page.
 */

// ---------- per-kind playground presets ----------

const PLAYGROUND_META = {
  image: {
    title: "Image Studio",
    placeholder: "Describe the image you want… e.g. a cute cat wearing a hat, studio lighting",
    submit: "Generate image",
    icon: "brush",
    accent: "#8B5CF6",
    allowCount: true,
    suggestedActions: ["A cute cat wearing a hat", "Cyberpunk city at night, neon", "Watercolor mountain landscape"],
  },
  video: {
    title: "Video Studio",
    placeholder: "Describe the video… e.g. a serene lake at sunset, slow drone shot",
    submit: "Generate video",
    icon: "movie",
    accent: "#0EA5E9",
    suggestedActions: ["A serene lake at sunset", "A rocket launching into space", "Rain on a window, cozy mood"],
  },
  tts: {
    title: "Voice Studio",
    placeholder: "Type anything to speak… e.g. Hello, welcome to Mirai!",
    submit: "Generate speech",
    icon: "record_voice_over",
    accent: "#F59E0B",
    suggestedActions: ["Hello, welcome to Mirai!", "The quick brown fox jumps over the lazy dog.", "Selamat pagi, apa kabar?"],
  },
  music: {
    title: "Music Studio",
    placeholder: "Describe the music… e.g. a calm piano melody with soft rain",
    submit: "Generate music",
    icon: "music_note",
    accent: "#EC4899",
    suggestedActions: ["A calm piano melody", "Upbeat lo-fi hip hop", "Epic orchestral trailer"],
  },
  stt: {
    title: "Transcript Studio",
    placeholder: "Paste a public audio URL to transcribe… e.g. https://example.com/audio.mp3",
    submit: "Transcribe audio",
    icon: "mic",
    accent: "#10B981",
    inputIsUrl: true,
  },
  imageToText: {
    title: "Vision Studio",
    placeholder: "Paste a public image URL to describe… e.g. https://example.com/photo.jpg",
    submit: "Describe image",
    icon: "image_search",
    accent: "#6366F1",
    inputIsUrl: true,
  },
  embedding: {
    title: "Embedding Studio",
    placeholder: "Type text to embed… e.g. The quick brown fox jumps over the lazy dog",
    submit: "Create embedding",
    icon: "data_array",
    accent: "#14B8A6",
    suggestedActions: ["The quick brown fox jumps over the lazy dog", "How to reset my password?"],
  },
  webSearch: {
    title: "Search Studio",
    placeholder: "Ask the web… e.g. latest news about AI in 2025",
    submit: "Search",
    icon: "travel_explore",
    accent: "#3B82F6",
    suggestedActions: ["Latest news about AI", "Best practices for Next.js performance"],
  },
  webFetch: {
    title: "Fetch Studio",
    placeholder: "Paste a URL to fetch… e.g. https://example.com",
    submit: "Fetch page",
    icon: "language",
    accent: "#06B6D4",
    inputIsUrl: true,
  },
  systemone: {
    title: "System One Studio",
    placeholder: "Describe a situation or state to evaluate…",
    submit: "Evaluate",
    icon: "psychology",
    accent: "#A855F7",
    suggestedActions: ["My payments have failed for three days and I am losing sales. Please help now."],
  },
};

// ---------- helpers ----------

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function bytesToSize(n) {
  if (!n && n !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------- main component ----------

export default function MediaPlayground({ providerId, kind, onResult }) {
  const meta = PLAYGROUND_META[kind];
  const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kind);
  const provider = AI_PROVIDERS[providerId];
  const providerAlias = provider?.alias || getProviderAlias?.(providerId) || providerId;

  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [count, setCount] = useState(1);
  const [size, setSize] = useState("auto");
  const [items, setItems] = useState([]); // chat history
  const [running, setRunning] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [refImage, setRefImage] = useState(null); // { dataUrl, name } for image editing
  const [lastImage, setLastImage] = useState(null); // data URL/URL of the last generated image (continuity)

  const listRef = useRef(null);
  const objectUrlsRef = useRef(new Set());

  // Models available for this provider + kind (same source as ModelsCard).
  // Dedupe by id — some providers register the same model id across kinds,
  // which would otherwise produce duplicate <option> keys.
  const modelOptions = useMemo(() => {
    const all = getModelsByProviderId(providerId) || [];
    const filtered = kind === "tts"
      ? all.filter((m) => getModelKind(m, "tts") === "tts" || !m.kinds)
      : all.filter((m) => {
          if (Array.isArray(m.kinds)) return m.kinds.includes(kind);
          return getModelKind(m, "llm") === kind;
        });
    const list = filtered.length ? filtered : all;
    const seen = new Set();
    const unique = [];
    for (const m of list) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);
      unique.push({ value: m.id, label: m.name || m.id });
    }
    return unique;
  }, [providerId, kind]);

  // Derived default: fall back to the first available model without an effect.
  const effectiveModel = model || modelOptions[0]?.value || "";

  // pull an active dashboard key so the proxy call is authenticated
  useEffect(() => {
    let cancelled = false;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const key = (d.keys || []).find((k) => k.isActive !== false)?.key || "";
        setApiKey(key);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // revoke object URLs on unmount
  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current.clear();
    },
    []
  );

  // autoscroll the history
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [items, running]);

  const pushItem = useCallback((entry) => {
    setItems((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...entry }]);
  }, []);

  const makeUrl = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  // ---------- request builders ----------

  const buildRequest = useCallback(() => {
    const text = input.trim();
    const modelId = effectiveModel || "";
    const fullModel = modelId.includes("/") ? modelId : `${providerAlias}/${modelId}`;
    const path = kindConfig?.endpoint?.path || "/v1/chat/completions";
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    // For image editing: prefer a freshly picked image, otherwise continue from
    // the last generated image so follow-up prompts can revise it.
    const editImage = refImage?.dataUrl || lastImage || null;

    if (kind === "tts") {
      return {
        url: `/api/v1/audio/speech`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: fullModel,
            input: text,
            ...(voice ? { voice } : {}),
          }),
        },
        responseKind: "audio",
      };
    }

    if (kind === "image") {
      return {
        url: `/api/v1/images/generations`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: fullModel,
            prompt: text,
            n: count,
            ...(size && size !== "auto" ? { size } : {}),
            ...(editImage ? { image: editImage } : {}),
          }),
        },
        responseKind: "image",
      };
    }

    if (kind === "video") {
      return {
        url: `/api/v1/videos/generations`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, prompt: text }),
        },
        responseKind: "video",
      };
    }

    if (kind === "music") {
      return {
        url: `/api/v1/audio/music`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, prompt: text }),
        },
        responseKind: "audio",
      };
    }

    if (kind === "embedding") {
      return {
        url: `/api/v1/embeddings`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, input: text }),
        },
        responseKind: "embedding",
      };
    }

    if (kind === "stt") {
      return {
        url: `/api/v1/audio/transcriptions`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, url: text }),
        },
        responseKind: "text",
      };
    }

    if (kind === "imageToText") {
      return {
        url: `/api/v1/images/understanding`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, url: text, prompt: "Describe this image in detail" }),
        },
        responseKind: "text",
      };
    }

    if (kind === "webSearch") {
      return {
        url: `/api/v1/search`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, query: text }),
        },
        responseKind: "text",
      };
    }

    if (kind === "webFetch") {
      return {
        url: `/api/v1/web/fetch`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({ model: fullModel, url: text }),
        },
        responseKind: "text",
      };
    }

    if (kind === "systemone") {
      return {
        url: `/api/v1/systemone`,
        options: {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: fullModel,
            state: text,
            questions: {
              is_urgent: { type: "noul", instructions: "Does this request require urgent attention?" },
            },
          }),
        },
        responseKind: "text",
      };
    }

    // fallback: generic chat endpoint
    return {
      url: path,
      options: {
        method: kindConfig?.endpoint?.method || "POST",
        headers,
        body: JSON.stringify({ model: fullModel, prompt: text, input: text, query: text }),
      },
      responseKind: "text",
    };
  }, [apiKey, count, effectiveModel, input, kind, kindConfig, lastImage, providerAlias, refImage, size, voice]);

  // ---------- result normalization ----------

  const normalizeResult = useCallback(
    async (res, responseKind, reqText, usedModel) => {
      const contentType = res.headers.get("content-type") || "";

      // text / json
      if (responseKind === "text" || contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        const audio = data?.audio;
        const format = data?.format || "mp3";

        if (responseKind === "audio" && audio) {
          const blob = await fetch(`data:audio/${format};base64,${audio}`).then((r) => r.blob());
          return { type: "audio", url: makeUrl(blob), format };
        }

        const images = extractImages(data);
        if (responseKind === "image" && images.length) {
          return { type: "images", images: images.map((s) => ({ url: s })) };
        }
        if (responseKind === "video" && images.length) {
          return { type: "videos", videos: images.map((s) => ({ url: s })) };
        }

        if (responseKind === "embedding") {
          const vec = data?.data?.[0]?.embedding || data?.embedding || [];
          return { type: "embedding", dims: vec.length, preview: vec.slice(0, 8), model: data?.model || usedModel };
        }

        const text = extractText(data);
        return { type: "text", text: text || JSON.stringify(data, null, 2), raw: data };
      }

      // binary (audio/image/video blob)
      if (responseKind === "audio") {
        const blob = await res.blob();
        const format = blob.type?.split("/")[1] || "mp3";
        return { type: "audio", url: makeUrl(blob), format };
      }
      if (responseKind === "image" || responseKind === "video") {
        const blob = await res.blob();
        const isVideo = (blob.type || "").startsWith("video");
        return isVideo ? { type: "videos", videos: [{ url: makeUrl(blob) }] } : { type: "images", images: [{ url: makeUrl(blob) }] };
      }

      const text = await res.text();
      return { type: "text", text };
    },
    [makeUrl]
  );

  // ---------- run ----------

  const handleGenerate = useCallback(async () => {
    const text = input.trim();
    const editImage = refImage?.dataUrl || lastImage || null;
    const editing = kind === "image" && Boolean(editImage);
    if ((!text && !editing) || running) return;
    const usedModel = effectiveModel;
    pushItem({ role: "user", text: text || "Edit this image", image: editing ? editImage : null });
    setInput("");
    setRefImage(null);
    setRunning(true);

    const started = Date.now();
    try {
      const { url, options, responseKind } = buildRequest();
      const res = await fetch(url, options);
      const latency = Date.now() - started;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err?.error?.message || err?.error || `HTTP ${res.status}`;
        pushItem({ role: "assistant", status: "error", error: message, latency, model: usedModel });
        return;
      }

      const result = await normalizeResult(res, responseKind, text, usedModel);
      pushItem({ role: "assistant", status: "ok", result, latency, model: usedModel });
      // Remember the produced image so the next prompt can revise it.
      // Only keep server-reachable refs (data: / http) — blob: URLs are local-only.
      if (kind === "image" && result?.type === "images" && result.images?.length) {
        const url = result.images[0].url || "";
        if (url.startsWith("data:") || url.startsWith("http")) setLastImage(url);
      }
      if (typeof onResult === "function") {
        try {
          onResult({ prompt: text, model: usedModel, latency, result });
        } catch (cbErr) {
          console.log("MediaPlayground onResult error:", cbErr);
        }
      }
    } catch (e) {
      pushItem({ role: "assistant", status: "error", error: e.message || "Network error", model: usedModel, latency: Date.now() - started });
    } finally {
      setRunning(false);
    }
  }, [buildRequest, effectiveModel, input, kind, lastImage, normalizeResult, onResult, pushItem, refImage, running]);

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handlePickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setRefImage({ dataUrl: reader.result, name: file.name });
    reader.readAsDataURL(file);
  };

  // Start a fresh conversation. Past results are already saved to the History
  // tab (via onResult → localStorage), so this only clears the live thread and
  // any carried-over image context — the previous session stays viewable there.
  const startNewSession = useCallback(() => {
    if (running) return;
    if (items.length > 0 && !confirm("Start a new session? This clears the chat — past results stay in the History tab.")) {
      return;
    }
    setItems([]);
    setInput("");
    setRefImage(null);
    setLastImage(null);
  }, [items.length, running]);

  // Image editing: allow generating with only a reference image + instruction.
  const canSubmit = Boolean(input.trim()) || (kind === "image" && Boolean(refImage || lastImage));
  const editingContext = refImage?.dataUrl || (kind === "image" ? lastImage : null);
  const hasThread = items.length > 0;

  if (!meta) return null;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface">
      {/* History */}
      <div ref={listRef} className="px-5 py-5 flex flex-col gap-4 max-h-[560px] min-h-[240px] overflow-y-auto custom-scrollbar">
        {items.length === 0 && (
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <div
              className="size-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${meta.accent}14`, color: meta.accent }}
            >
              <span className="material-symbols-outlined text-[28px]">{meta.icon}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-main">{meta.submit} in one click</p>
              <p className="text-xs text-text-muted mt-0.5">Type a prompt below — the result appears here.</p>
            </div>
            {meta.suggestedActions && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                {meta.suggestedActions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border-subtle bg-surface-2/60 text-text-muted hover:text-text-main hover:border-brand-500/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {items.map((item) => (
          <Bubble key={item.id} item={item} />
        ))}

        {running && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            Generating…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border-subtle bg-surface-2/30 px-5 py-4 flex flex-col gap-3">
        {/* Compact per-kind settings */}
        <div className="flex flex-wrap items-center gap-2">
          {hasThread && (
            <button
              type="button"
              onClick={startNewSession}
              disabled={running}
              title="Start a new session (past results stay in History)"
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border-subtle bg-surface text-text-muted hover:text-text-main hover:border-brand-500/40 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[15px]">add_comment</span>
              New Session
            </button>
          )}

          {modelOptions.length > 0 && (
            <select
              value={effectiveModel}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500/30 max-w-[220px] truncate"
            >
              {modelOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {kind === "tts" && (
            <input
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="voice (optional)"
              className="text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 w-40"
            />
          )}

          {kind === "image" && (
            <>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              >
                {["auto", "1024x1024", "1024x1536", "1536x1024", "1024x1792", "1792x1024"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-text-main focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} image{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <label className="text-xs px-2.5 py-1.5 rounded-lg bg-surface border border-border-subtle text-text-muted hover:text-text-main hover:border-brand-500/40 transition-colors cursor-pointer inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">add_photo_alternate</span>
                {refImage ? "Change image" : "Add image to edit"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
              </label>
            </>
          )}

          <span className="ml-auto text-[11px] text-text-muted hidden sm:inline">
            {apiKey ? `key ${maskKey(apiKey)}` : "no dashboard key"}
          </span>
        </div>

        {/* Input + send */}
        <div className="flex items-end gap-2">
          {kind === "image" && refImage && (
            <div className="relative shrink-0 mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={refImage.dataUrl}
                alt={refImage.name || "reference"}
                className="size-11 rounded-lg object-cover border border-border-subtle"
              />
              <button
                type="button"
                onClick={() => setRefImage(null)}
                title="Remove image"
                className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-surface border border-border-subtle text-text-muted hover:text-text-main flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </div>
          )}
          {kind === "image" && !refImage && lastImage && (
            <div className="relative shrink-0 mb-1" title="Continuing from the last result">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lastImage}
                alt="current"
                className="size-11 rounded-lg object-cover border-2 border-brand-500/40"
              />
              <button
                type="button"
                onClick={() => setLastImage(null)}
                title="Stop editing this image (start fresh)"
                className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-surface border border-border-subtle text-text-muted hover:text-text-main flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={meta.inputIsUrl ? 1 : 2}
            placeholder={
              refImage
                ? "Describe the edit… e.g. make it snowing, keep the subject"
                : editingContext
                  ? "Revise the image… e.g. make the hat pink, keep everything else"
                  : meta.placeholder
            }
            className="flex-1 resize-none text-sm px-3.5 py-2.5 rounded-[12px] bg-surface border border-border-subtle text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 transition-all"
          />
          <Button
            onClick={handleGenerate}
            disabled={!canSubmit || running}
            loading={running}
            icon="send"
            className="shrink-0"
          >
            <span className="hidden sm:inline">{editingContext ? "Edit image" : meta.submit}</span>
            <span className="sm:hidden">Go</span>
          </Button>
        </div>
        <p className="text-[11px] text-text-muted">
          {editingContext ? (
            <>Editing the image — hover the thumbnail to start fresh. </>
          ) : null}
          Press <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border-subtle text-[10px]">Ctrl</kbd>+
          <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border-subtle text-[10px]">Enter</kbd> to send ·
          calls your local <code className="font-mono">{kindConfig?.endpoint?.path}</code>
        </p>
      </div>
    </div>
  );
}

// ---------- sub components ----------

function Bubble({ item }) {
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[14px] rounded-br-md px-3.5 py-2.5 bg-brand-500/12 border border-brand-500/25 text-sm text-text-main whitespace-pre-wrap break-words">
          {item.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.image}
              alt="reference"
              className="mb-2 max-h-40 rounded-lg border border-border-subtle"
            />
          )}
          {item.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full rounded-[14px] rounded-bl-md border border-border-subtle bg-surface px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-[16px] text-text-muted">smart_toy</span>
          <span className="text-[11px] text-text-muted font-medium truncate">{item.model || "result"}</span>
          {typeof item.latency === "number" && (
            <span className="ml-auto text-[11px] text-text-muted">{item.latency} ms</span>
          )}
        </div>

        {item.status === "error" && (
          <div className="flex items-start gap-2 text-xs text-red-500">
            <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
            <span className="break-words">{item.error}</span>
          </div>
        )}

        {item.status === "ok" && item.result && <ResultView result={item.result} />}
      </div>
    </div>
  );
}

// ---------- data extraction ----------

function extractImages(data) {
  const out = [];
  const push = (v) => {
    if (typeof v !== "string") return;
    if (v.startsWith("http") || v.startsWith("data:") || v.startsWith("blob:")) out.push(v);
  };
  const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data?.images) ? data.images : [];
  for (const d of arr) {
    if (typeof d === "string") push(d);
    else if (d && typeof d === "object") {
      if (d.b64_json) out.push(`data:image/png;base64,${d.b64_json}`);
      else push(d.url || d.image_url || d.video_url);
    }
  }
  if (out.length === 0 && typeof data?.url === "string") push(data.url);
  if (out.length === 0 && typeof data?.b64_json === "string") out.push(`data:image/png;base64,${data.b64_json}`);
  return out;
}

function extractText(data) {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "";
  if (typeof data.text === "string") return data.text;
  if (typeof data.content === "string") return data.content;
  if (typeof data.transcript === "string") return data.transcript;
  if (typeof data.result === "string") return data.result;
  if (typeof data.answer === "string") return data.answer;
  const choice = data.choices?.[0];
  if (choice) {
    const c = choice.message?.content ?? choice.text;
    if (typeof c === "string") return c;
  }
  if (Array.isArray(data.results)) {
    return data.results
      .map((r) => {
        if (typeof r === "string") return r;
        const title = r.title || r.name || r.url || "";
        const snippet = r.snippet || r.description || r.content || "";
        return [title, snippet].filter(Boolean).join(" — ");
      })
      .join("\n\n");
  }
  if (data.answers) return JSON.stringify(data.answers, null, 2);
  return "";
}
