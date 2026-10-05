// Stability AI v2 -- sync. Generate returns { image: "<b64>" }.
//
// Editing: Stability exposes dedicated multipart endpoints under
// /v2beta/stable-image/edit/* (inpaint, erase, search-and-replace, remove-bg,
// outpaint, ...). A chat prompt maps most naturally to "search-and-replace"
// (image + prompt -> image), so when body.image is present we route there and
// send multipart/form-data with Accept: image/*.
import { nowSec, sizeToAspectRatio } from "./_base.js";
import { PROVIDER_MEDIA } from "../../providers/index.js";

const BASE_URL = PROVIDER_MEDIA["stability-ai"]?.imageConfig?.baseUrl;
const EDIT_BASE = "https://api.stability.ai/v2beta/stable-image/edit";

// Map model id -> generate endpoint segment
function modelToEndpoint(model) {
  if (model.includes("ultra")) return "ultra";
  if (model.includes("sd3")) return "sd3";
  return "core";
}

function dataUrlToBlob(image) {
  if (typeof image !== "string" || !image) return null;
  const m = image.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (m) {
    const mime = m[1] || "image/png";
    if (m[2]) {
      try {
        return new Blob([Buffer.from(m[3], "base64")], { type: mime });
      } catch {
        return null;
      }
    }
    return new Blob([decodeURIComponent(m[3])], { type: mime });
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(image) && image.length > 64) {
    try {
      return new Blob([Buffer.from(image.replace(/\s/g, ""), "base64")], { type: "image/png" });
    } catch {
      return null;
    }
  }
  return null;
}

async function urlToBlob(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    return new Blob([await res.arrayBuffer()], { type });
  } catch {
    return null;
  }
}

async function resolveImageBlob(image) {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("http")) return urlToBlob(image);
  return dataUrlToBlob(image);
}

export default {
  buildUrl: (model, credentials, body) => {
    if (body?.image) return `${EDIT_BASE}/search-and-replace`;
    return `${BASE_URL}/${modelToEndpoint(model)}`;
  },
  buildHeaders: (creds, requestBody) => {
    const key = creds?.apiKey || creds?.accessToken;
    const headers = {};
    if (key) headers["Authorization"] = `Bearer ${key}`;
    // Editing uses multipart + binary image response.
    if (typeof FormData !== "undefined" && requestBody instanceof FormData) {
      headers["Accept"] = "application/json";
      return headers;
    }
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "application/json";
    return headers;
  },
  buildBody: async (model, body) => {
    // Editing path: multipart search-and-replace (image + prompt -> image).
    if (body.image && typeof FormData !== "undefined") {
      const blob = await resolveImageBlob(body.image);
      if (blob) {
        const form = new FormData();
        form.append("image", blob, "input.png");
        form.append("prompt", String(body.prompt ?? ""));
        if (body.output_format) form.append("output_format", String(body.output_format).toLowerCase());
        if (body.size) form.append("aspect_ratio", sizeToAspectRatio(body.size));
        return form;
      }
    }

    const req = { prompt: body.prompt, output_format: (body.output_format || "png").toLowerCase() };
    if (body.size) req.aspect_ratio = sizeToAspectRatio(body.size);
    if (body.style) req.style_preset = body.style;
    if (model.includes("sd3")) req.model = model;
    return req;
  },
  normalize: (responseBody) => {
    if (responseBody.image) return { created: nowSec(), data: [{ b64_json: responseBody.image }] };
    if (Array.isArray(responseBody.artifacts) && responseBody.artifacts[0]?.base64) {
      return { created: nowSec(), data: [{ b64_json: responseBody.artifacts[0].base64 }] };
    }
    return { created: nowSec(), data: [] };
  },
};