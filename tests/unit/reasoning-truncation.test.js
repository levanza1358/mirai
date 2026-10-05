import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/usageDb.js", () => ({
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
  saveRequestUsage: vi.fn(async () => {})
}));

const { FORMATS } = await import("../../open-sse/translator/formats.js");
const { isReasoningOnlyTruncation, reasoningTruncationMessage } = await import(
  "../../open-sse/utils/reasoningTruncation.js"
);
const { parseSSEToOpenAIResponse, handleForcedSSEToJson } = await import(
  "../../open-sse/handlers/chatCore/sseToJsonHandler.js"
);

describe("reasoning-only truncation guard", () => {
  it("flags content:null + finish_reason:length with reasoning present", () => {
    expect(isReasoningOnlyTruncation({
      finish_reason: "length",
      message: { content: null, reasoning_content: "thinking..." }
    })).toBe(true);
  });

  it("flags an empty-string content with reasoning present", () => {
    expect(isReasoningOnlyTruncation({
      finish_reason: "length",
      message: { content: "   ", reasoning_content: "thinking..." }
    })).toBe(true);
  });

  it("does not flag when a real answer was produced", () => {
    expect(isReasoningOnlyTruncation({
      finish_reason: "length",
      message: { content: "the answer", reasoning_content: "thinking..." }
    })).toBe(false);
  });

  it("does not flag tool calls", () => {
    expect(isReasoningOnlyTruncation({
      finish_reason: "length",
      message: { content: null, reasoning_content: "thinking...", tool_calls: [{ id: "1" }] }
    })).toBe(false);
  });

  it("does not flag a clean stop with no content", () => {
    expect(isReasoningOnlyTruncation({
      finish_reason: "stop",
      message: { content: "", reasoning_content: "thinking..." }
    })).toBe(false);
  });

  it("does not flag empty content with no reasoning", () => {
    expect(isReasoningOnlyTruncation({
      finish_reason: "length",
      message: { content: null }
    })).toBe(false);
  });

  it("message names the model and the fix", () => {
    const msg = reasoningTruncationMessage("Atria-Dawn-Preview");
    expect(msg).toContain("Atria-Dawn-Preview");
    expect(msg).toContain("max_tokens");
  });
});

describe("forced SSE→JSON rejects reasoning-only truncation", () => {
  const sseBody = (raw) => new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(raw));
        controller.close();
      }
    }),
    { headers: { "content-type": "text/event-stream" } }
  );

  it("returns 400 when the stream spent its whole budget on reasoning", async () => {
    const raw = [
      'data: {"choices":[{"delta":{"reasoning_content":"thinking hard"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}]}',
      "data: [DONE]"
    ].join("\n\n");

    const result = await handleForcedSSEToJson({
      providerResponse: sseBody(raw),
      sourceFormat: FORMATS.OPENAI,
      targetFormat: FORMATS.OPENAI,
      provider: "atria",
      model: "Atria-Dawn-Preview",
      body: { model: "Atria-Dawn-Preview", max_tokens: 128 },
      stream: false,
      appendLog: () => {},
      log: {},
      trackDone: () => {}
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain("Atria-Dawn-Preview");
  });

  it("still returns the answer when content is present", async () => {
    const raw = [
      'data: {"choices":[{"delta":{"reasoning_content":"thinking"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":"the answer"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]"
    ].join("\n\n");

    const parsed = parseSSEToOpenAIResponse(raw, "Atria-Dawn-Preview");
    expect(parsed.choices[0].message.content).toBe("the answer");
    expect(parsed.choices[0].finish_reason).toBe("stop");
  });
});
