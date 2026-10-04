// Pure helpers for the model-test ("ping") flow.
// Kept framework-free so they can be unit-tested without Next/db deps.

export const DEFAULT_MODEL_TEST_PROMPT = "Hi, What your real model AI ? and your cut off training ?";

/**
 * Pick the model's answer text from an OpenAI-compatible completion payload.
 * Prefers assistant content; falls back to reasoning/thinking fields that
 * reasoning-only models emit when they run out of output budget.
 */
export function extractModelAnswer(payload) {
  const choice = (payload && payload.choices && payload.choices[0]) || {};
  const message = choice.message || {};
  const content = String(message.content || "").trim();
  if (content) return content;
  const reasoning = String(
    message.reasoning_content || message.reasoning || message.thinking_content || message.thinking || ""
  ).trim();
  return reasoning;
}

/**
 * A completion is a "soft pass" when the model exhausted its budget on
 * chain-of-thought and returned no content but did return reasoning.
 */
export function isReasoningOnlySoftPass(payload) {
  const choice = (payload && payload.choices && payload.choices[0]) || {};
  const message = choice.message || {};
  const contentEmpty = !String(message.content || "").trim();
  const hasReasoning = !!(message.reasoning || message.reasoning_content || message.thinking || message.thinking_content);
  return choice.finish_reason === "length" && contentEmpty && hasReasoning;
}

/**
 * Aggregate a batch of model-test results into a summary + the ids that failed.
 * `results` is an array of { id, ok, error?, answer? } in test order.
 * `stopped` indicates the run was aborted early. `disableFailed` mirrors the
 * "Test All + Disable" choice (the caller still performs the disabling).
 */
export function summarizeModelTests(results, { stopped = false, disableFailed = false } = {}) {
  const list = Array.isArray(results) ? results : [];
  const failedIds = [];
  let passed = 0;
  for (const r of list) {
    if (r && r.ok) passed += 1;
    else if (r && r.id != null) failedIds.push(r.id);
  }
  return {
    total: list.length,
    completed: list.length,
    passed,
    failed: failedIds.length,
    failedIds,
    stopped: !!stopped,
    disableFailed: !!disableFailed,
  };
}
