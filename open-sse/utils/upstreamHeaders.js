const FORWARDED = new Set([
  "retry-after",
  "x-should-retry",
  // Atria exposes account-wide fixed-window RPM telemetry on every response.
  "x-rpm-limit",
  "x-rpm-remaining",
]);
const FORWARDED_PREFIX = "anthropic-ratelimit-";

export function upstreamResponseHeaders(headers) {
  const out = {};
  if (typeof headers?.forEach !== "function") return out;
  headers.forEach((value, name) => {
    const key = name.toLowerCase();
    if (FORWARDED.has(key) || key.startsWith(FORWARDED_PREFIX)) out[key] = value;
  });
  return out;
}
