/**
 * Antigravity model-id normalisation and retirement detection.
 *
 * Why this exists (verified against the live upstream on 2026-10-06):
 *
 *   1. The Antigravity backend indexes models by their BARE id. Sending the old
 *      tier-suffix syntax returns a bare 404:
 *
 *        gemini-3.8-flash-high(high)  → HTTP 404 "Requested entity was not found."
 *        gemini-3.8-flash-high        → HTTP 200
 *
 *      The "(high)/(medium)/(low)" suffix is a legacy of an older backend that
 *      encoded the thinking tier inside the model name. Tier is now selected via
 *      generationConfig.thinkingConfig, so the suffix must be stripped.
 *
 *   2. The authoritative list of usable models comes from
 *      `v1internal:fetchAvailableModels`, which returns bare ids and already
 *      reflects the account's tier. Anything not in that list is not
 *      provisioned for the account.
 *
 *   3. Retired models do NOT fail — they answer HTTP 200 whose *text* is a
 *      deprecation notice, e.g.
 *        "Claude Sonnet 4.6 is no longer available. Please switch to Claude Sonnet 5.5."
 *      A naive proxy passes that sentence through as if the model had replied,
 *      so the user sees a fake answer instead of an error.
 */

/**
 * Strip a trailing legacy tier suffix: `model(high)` → `model`.
 * Only removes a parenthesised tier keyword, never anything else, so ids that
 * legitimately contain dots/dashes are untouched.
 */
export function stripTierSuffix(model) {
  if (typeof model !== "string") return model;
  return model.replace(/\((?:high|medium|low|extra-low|tiered)\)$/i, "").trim();
}

/**
 * Strip an Antigravity "tiered" infix: `gemini-3.7-flash-tiered` → `gemini-3.7-flash`.
 * `-tiered` marks the tier-selection variant, which is now expressed via
 * thinkingConfig rather than the model name.
 */
export function stripTieredInfix(model) {
  if (typeof model !== "string") return model;
  return model.replace(/-tiered(?=-|$)/i, "");
}

/**
 * Normalise a registry model id into the id the upstream backend expects.
 *
 * The legacy syntax encoded tier two different ways:
 *   `gemini-3.8-flash-high(high)`   → `gemini-3.8-flash-high`   (suffix already in the name)
 *   `gemini-3.7-flash-tiered(high)` → `gemini-3.7-flash-high`   (tier moves into the name)
 *
 * Verified against the live upstream: for a `-tiered` id the parenthesised tier
 * must be *moved* after the model name, not merely dropped.
 */
export function normalizeAntigravityModelId(model) {
  if (typeof model !== "string") return model;

  const tierMatch = model.match(/\((high|medium|low|extra-low|tiered)\)$/i);
  const tier = tierMatch ? tierMatch[1].toLowerCase() : null;
  const withoutTier = tierMatch ? model.slice(0, tierMatch.index) : model;

  // `foo-tiered` + `(high)` → `foo-high`; without a tier it is just `foo`.
  if (/-tiered$/i.test(withoutTier)) {
    const base = withoutTier.replace(/-tiered$/i, "");
    return tier && tier !== "tiered" ? `${base}-${tier}` : base;
  }

  return withoutTier.trim();
}

// A deprecation notice is short, mentions the model being unavailable, and
// tells the user which model to switch to. Requiring the "switch to" half keeps
// us from misfiring on a genuine answer that merely contains the word
// "available".
// NOTE: the replacement name may contain dots ("Claude Opus 5.5"), so the
// character class must not exclude "." — only sentence terminators that are
// followed by whitespace/end-of-string.
const DEPRECATION_PATTERNS = [
  /is no longer available[,.]?\s*please switch to\s+(.+?)(?:\.\s|\.$|$)/i,
  /no longer available[,.]?\s*please switch to\s+(.+?)(?:\.\s|\.$|$)/i,
  /has been retired[,.]?\s*please (?:switch to|use)\s+(.+?)(?:\.\s|\.$|$)/i,
];

/**
 * Detect an upstream retirement notice inside model output or an error body.
 *
 * @param {string} text
 * @returns {{retired: true, replacement: string|null, message: string}|null}
 *   `null` when the text is not a retirement notice.
 */
export function detectModelRetirement(text) {
  if (typeof text !== "string" || !text) return null;
  // Notices are one or two sentences; ignore long prose that merely happens to
  // contain the phrase (avoids false positives on quoted content).
  const sample = text.length > 400 ? text.slice(0, 400) : text;
  for (const pattern of DEPRECATION_PATTERNS) {
    const match = sample.match(pattern);
    if (!match) continue;
    const replacement = (match[1] || "").trim().replace(/[."']+$/, "");
    return {
      retired: true,
      replacement: replacement || null,
      message: sample.trim().slice(0, 300),
    };
  }
  return null;
}

/**
 * Turn an upstream HTTP status + body into a user-facing message.
 * Returns `null` when the status is not a "model not usable" case.
 */
export function describeAntigravityFailure({ status, bodyText, model, availableModels }) {
  let errorJson = null;
  try {
    errorJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    /* not JSON */
  }

  const upstreamMessage = errorJson?.error?.message || errorJson?.message || "";
  const statusCode = errorJson?.error?.code || status;

  if (statusCode === 404 || /NOT_FOUND/i.test(errorJson?.error?.status || "")) {
    const suggestions = suggestReplacement(model, availableModels);
    return {
      kind: "model_unavailable",
      model,
      message:
        `Model "${model}" is not available for this Antigravity account. ` +
        `The current tier does not expose it (the upstream returned 404).` +
        (suggestions.length ? ` Try: ${suggestions.join(", ")}.` : ""),
      upstreamMessage: upstreamMessage || "Requested entity was not found.",
      suggestions,
    };
  }

  return null;
}

/**
 * Pick a few currently-usable model ids similar to the requested one.
 * `availableModels` is the raw map from fetchAvailableModels (id → info).
 *
 * Matching is deliberately forgiving: the goal is "something that works",
 * so we try progressively broader prefixes before falling back to whatever
 * upstream marked as recommended.
 */
export function suggestReplacement(model, availableModels) {
  if (!availableModels || typeof availableModels !== "object") return [];
  const ids = Object.keys(availableModels).filter((id) => !isNonChatModelId(id));
  if (ids.length === 0) return [];

  const base = normalizeAntigravityModelId(model || "");
  const segments = base.split("-").filter(Boolean);

  // Try the longest family prefix first ("gemini-3.8-flash" → "gemini-3.8" →
  // "gemini-3"), so a 3.8 request suggests 3.8 variants before 3.x ones.
  const prefixes = [];
  for (let n = Math.min(segments.length, 4); n >= 1; n--) {
    prefixes.push(segments.slice(0, n).join("-"));
  }

  for (const prefix of prefixes) {
    if (!prefix) continue;
    const matches = ids.filter((id) => id === prefix || id.startsWith(`${prefix}-`));
    if (matches.length) return matches.slice(0, 3);
  }

  const recommended = ids.filter((id) => availableModels[id]?.recommended);
  return (recommended.length ? recommended : ids).slice(0, 3);
}

/**
 * Internal/bookkeeping ids that should never be offered as a chat model.
 * fetchAvailableModels leaks UI-only entries such as `chat_23310`,
 * `tab_jump_flash_lite_preview`, etc.
 */
export function isNonChatModelId(id) {
  if (typeof id !== "string" || !id) return true;
  return /^(?:chat_|tab_)/i.test(id);
}

/**
 * Filter a fetchAvailableModels payload down to usable chat model ids.
 */
export function listUsableModelIds(payload) {
  const models = payload?.models;
  if (!models || typeof models !== "object") return [];
  return Object.keys(models).filter((id) => !isNonChatModelId(id));
}
