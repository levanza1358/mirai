// CodeBuddy CN (Tencent copilot.tencent.com) image adapter.
//
// The plugin-visible gateway is OpenAI-compatible for chat (/v2/chat/completions)
// but the media routes are undocumented and NOT OpenAI-shaped:
//   POST /v2/images/generations  ->  { code, msg, data: { created, data:[{ url }], usage } }
// so we send { model, prompt, ... } and unwrap the nested `data.data` back into the
// OpenAI image response shape the rest of Mirai (and clients) expect.
//
// Auth is the OAuth bearer token, plus the CLI identity headers the gateway expects.
// Verified 2026-10: 200 OK with an OAuth token alone.

const CODEBUDDY_HEADERS = {
  "User-Agent": "CLI/2.108.1 CodeBuddy/2.108.1",
  "X-Product": "SaaS",
  "X-IDE-Type": "CLI",
  "X-IDE-Name": "CLI",
  "x-requested-with": "XMLHttpRequest",
  "x-codebuddy-request": "1",
};

function buildHeaders(creds) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...CODEBUDDY_HEADERS,
  };
  const key = creds?.accessToken || creds?.apiKey;
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return headers;
}

function buildBody(model, body) {
  const { prompt, n, size } = body;
  const out = { model, prompt };
  // Tencent accepts n/size when present; only forward when the client asked,
  // so we never inject a value the upstream didn't expect.
  if (Number.isFinite(Number(n)) && Number(n) > 0) out.n = Number(n);
  if (typeof size === "string" && size) out.size = size;
  return out;
}

// Tencent wraps the payload: { data: { data: [{ url }] } }. Some routes may answer
// flat; handle both. Output is the OpenAI shape { created, data:[{url|b64_json}] }.
function normalize(responseBody) {
  const inner = responseBody?.data?.data ?? responseBody?.data ?? [];
  const items = Array.isArray(inner) ? inner : [];
  const data = items.map((it) => {
    if (typeof it === "string") return { url: it };
    const url = it?.url || it?.image_url || null;
    const b64 = it?.b64_json || it?.image_base64 || null;
    return b64 ? { b64_json: b64 } : { url };
  });
  const usage = responseBody?.data?.usage || responseBody?.usage || null;
  const created = responseBody?.data?.created || responseBody?.created ||
    Math.floor(Date.now() / 1000);
  return { created, data, ...(usage ? { usage } : {}) };
}

export default {
  buildUrl: () => "https://copilot.tencent.com/v2/images/generations",
  buildHeaders,
  buildBody,
  normalize,
};
