// Tiny allowlist-free HTML sanitizer for untrusted (model-produced) markup.
// Not a full HTML parser: it removes the dangerous tag set and inline event
// handlers / javascript: URLs that matter for a small display surface.

export function sanitizeHtml(html) {
  if (!html) return "";
  let out = html;
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  out = out.replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*\/?>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'\s>]*("|')?/gi, "$1=\"#\"");
  return out;
}
