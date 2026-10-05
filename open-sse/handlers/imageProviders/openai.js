// OpenAI-compatible adapter (used by openai, minimax, openrouter, recraft, xai,
// vercel-ai-gateway).
//
// Image editing: OpenAI's dedicated edit endpoint is POST /v1/images/edits
// which requires multipart/form-data (image file + prompt), unlike the JSON
// POST /v1/images/generations. When body.image is present AND the provider opts
// in via EDIT_CAPABLE, we transparently switch endpoints and build a FormData
// body instead of JSON.
//
// serializeRequestBody() in imageGenerationCore already passes FormData through
// untouched, and fetch sets the multipart boundary automatically.
import { PROVIDER_MEDIA } from "../../providers/index.js";

const imageCfg = (id) => PROVIDER_MEDIA[id]?.imageConfig || {};
const imageUrl = (id) => imageCfg(id).baseUrl;

// Only providers whose API mirrors OpenAI's /images/edits contract opt in.
// (xAI currently rejects anonymous multipart edits, so it is intentionally
// excluded — an attached image is simply ignored for xAI.)
const EDIT_CAPABLE = new Set(["openai"]);

// Swap the trailing /generations segment for /edits. Falls back gracefully when
// the configured base URL does not follow that convention.
function editsUrl(base) {
  if (!base) return base;
  if (/\/generations\/?$/.test(base)) return base.replace(/\/generations\/?$/, "/edits");
  if (/\/edits\/?$/.test(base)) return base;
  return `${base.replace(/\/$/, "")}/edits`;
}

// Decode a data: URL (or raw base64) into a Blob for multipart upload.
function dataUrlToBlob(image) {
  if (typeof image !== "string" || !image) return null;
  const m = image.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (m) {
    const mime = m[1] || "image/png";
    const isB64 = Boolean(m[2]);
    const data = m[3];
    if (isB64) {
      try {
        const bytes = Buffer.from(data, "base64");
        return new Blob([bytes], { type: mime });
      } catch {
        return null;
      }
    }
    return new Blob([decodeURIComponent(data)], { type: mime });
  }
  // Bare base64 (no data: prefix) -- assume PNG.
  if (/^[A-Za-z0-9+/=\s]+$/.test(image) && image.length > 64) {
    try {
      return new Blob([Buffer.from(image.replace(/\s/g, ""), "base64")], { type: "image/png" });
    } catch {
      return null;
    }
  }
  return null;
}

// Turn an http(s) URL into a Blob by downloading it (edit endpoint needs bytes).
async function urlToBlob(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = await res.arrayBuffer();
    return new Blob([buf], { type });
  } catch {
    return null;
  }
}

async function resolveImageBlob(image) {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http")) return urlToBlob(image);
  return dataUrlToBlob(image);
}

function fileNameFor(blob, image) {
  const mime = blob?.type || "image/png";
  const ext = mime.split("/")[1] || "png";
  if (typeof image === "string" && image.startsWith("data:")) return `input.${ext}`;
  try {
    const p = new URL(image).pathname;
    const base = p.split("/").pop();
    if (base && /\.(png|jpe?g|webp)$/i.test(base)) return base;
  } catch {
    // not a URL
  }
  return `input.${ext}`;
}

export default function createOpenAIAdapter(providerId) {
  const cfg = imageCfg(providerId);
  const canEdit = EDIT_CAPABLE.has(providerId);

  return {
    buildUrl: (model, credentials, body) => {
      const base = imageUrl(providerId);
      if (canEdit && body?.image) return editsUrl(base);
      return base;
    },
    buildHeaders: (creds, requestBody) => {
      const headers = { ...(cfg.headers || {}) };
      const key = creds?.apiKey || creds?.accessToken;
      if (key) headers["Authorization"] = 'Bearer ${key}' + key + '`';
      // fetch sets the multipart boundary itself -- never force JSON for FormData.
      if (!(typeof FormData !== "undefined" && requestBody instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }
      return headers;
    },
    buildBody: async (model, body) => {
      const { prompt, n = 1, size = "1024x1024", quality, style, response_format } = body;
      const full = { model, prompt, n, size };
      if (quality) full.quality = quality;
      if (style) full.style = style;
      if (response_format) full.response_format = response_format;

      // Editing path takes precedence: multipart form-data against /images/edits.
      if (canEdit && body.image && typeof FormData !== "undefined") {
        const blob = await resolveImageBlob(body.image);
        if (blob) {
          const form = new FormData();
          form.append("model", String(model || ""));
          form.append("prompt", String(prompt ?? ""));
          if (n) form.append("n", String(n));
          if (size) form.append("size", String(size));
          form.append("image", blob, fileNameFor(blob, body.image));
          return form;
        }
      }

      // bodyFields whitelist (e.g. xAI accepts only model/prompt/n/response_format)
      if (Array.isArray(cfg.bodyFields)) {
        const req = {};
        for (const f of cfg.bodyFields) if (full[f] !== undefined) req[f] = full[f];
        return req;
      }

      return full;
    },
    normalize: (responseBody) => responseBody,
  };
}