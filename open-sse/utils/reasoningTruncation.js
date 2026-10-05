/**
 * Reasoning-only truncation guard.
 *
 * Some providers (e.g. Atria Dawn, Claude extended thinking, Qwen3.5) spend the
 * client's whole max_tokens budget on internal reasoning. When the budget runs
 * out mid-thought the upstream returns finish_reason:"length" with content:null
 * and the chain-of-thought left in message.reasoning_content / delta.reasoning_content.
 *
 * A plain OpenAI client then either shows an empty answer or, worse, renders the
 * raw reasoning trace as if it were the answer — the "odd answer" symptom. The
 * response is genuinely unusable (the model never produced its final answer), and
 * the cause is the client's own request budget, so it must NOT be treated as a
 * provider failure (no account cooldown / fallback). Detect it and hand back an
 * actionable error instead.
 */

const FINISH_REASON_LENGTH = "length";

/**
 * @param {object} choice - An OpenAI-style choice ({ message, finish_reason }) OR
 *   a normalized { message: { content, reasoning_content, tool_calls } } shape.
 * @returns {boolean} true when the choice is a reasoning-only truncation.
 */
export function isReasoningOnlyTruncation(choice) {
  if (!choice || typeof choice !== "object") return false;

  const message = choice.message || choice.delta || null;
  if (!message || typeof message !== "object") return false;

  // Must be explicitly truncated by the token budget.
  if (choice.finish_reason !== FINISH_REASON_LENGTH) return false;

  // A real answer or tool call means the response is usable — keep it.
  const content = message.content;
  if (typeof content === "string" ? content.trim().length > 0 : Array.isArray(content) && content.length > 0) {
    return false;
  }
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) return false;

  // Only flag when reasoning actually consumed the budget.
  const reasoning = message.reasoning_content ?? message.reasoning;
  return typeof reasoning === "string" && reasoning.length > 0;
}

/**
 * Build the client-facing message for a reasoning-only truncation.
 * @param {string} [model] - Model id, included for context.
 * @returns {string}
 */
export function reasoningTruncationMessage(model) {
  const target = model ? `${model}` : "The model";
  return `${target} used its entire max_tokens budget on internal reasoning and returned no answer ` +
    `(finish_reason: "length", content empty). This model reasons before answering, so it needs a ` +
    `larger output budget: raise max_tokens / max_completion_tokens, or lower the reasoning effort.`;
}
