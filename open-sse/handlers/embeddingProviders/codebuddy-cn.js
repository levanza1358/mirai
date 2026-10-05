// CodeBuddy CN (Tencent copilot.tencent.com) embeddings adapter.
//
// Undocumented route: POST /v2/embeddings with a body of { model, input }.
// Verified 2026-10: 200 OK with an OAuth token alone (no extra auth headers).
// Response is already OpenAI-shaped: { data: [{ embedding: [...] }] } — with no
// `usage` block — so normalize just guarantees the expected envelope.

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

function buildBody(model, { input, encoding_format, dimensions }) {
  // Tencent wants the raw input; it does not accept encoding_format/dimensions —
  // forwarding them triggers a 500. Only send what the route understands.
  void encoding_format;
  void dimensions;
  return { model, input };
}

function normalize(responseBody) {
  const data = Array.isArray(responseBody?.data) ? responseBody.data : [];
  const out = { data };
  if (responseBody?.usage) out.usage = responseBody.usage;
  if (responseBody?.model) out.model = responseBody.model;
  return out;
}

export default {
  buildUrl: () => "https://copilot.tencent.com/v2/embeddings",
  buildHeaders,
  buildBody,
  normalize,
};
