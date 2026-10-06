import { describe, it, expect } from "vitest";
import { createSSEStream } from "../../open-sse/utils/stream.js";
import { detectModelRetirement } from "../../open-sse/utils/antigravityModels.js";

// The stream module must at minimum load and export createSSEStream. If the
// retirement guard introduced a scope/syntax problem this import fails loudly.
describe("stream.js module health", () => {
  it("exports createSSEStream", () => {
    expect(typeof createSSEStream).toBe("function");
  });

  it("retirement helper is importable alongside it", () => {
    expect(typeof detectModelRetirement).toBe("function");
  });
});

describe("stream retirement guard (passthrough)", () => {
  // Drives a real SSE body through createSSEStream in passthrough mode and
  // asserts the retired-model notice becomes an error event instead of answer text.
  async function runPassthrough(chunks) {
    const encoder = new TextEncoder();
    const upstream = new ReadableStream({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });

    const stream = createSSEStream({
      mode: "passthrough",
      targetFormat: "openai",
      sourceFormat: "openai",
      provider: "antigravity",
      model: "claude-opus-4-6-thinking",
      body: { messages: [] },
    });

    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    const pump = (async () => {
      let out = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out += new TextDecoder().decode(value);
      }
      return out;
    })();

    const pipe = (async () => {
      const upReader = upstream.getReader();
      while (true) {
        const { done, value } = await upReader.read();
        if (done) break;
        await writer.write(value);
      }
      await writer.close();
    })();

    await Promise.all([pipe, pump]);
    return pump;
  }

  it("turns the retired notice into an error event", async () => {
    const sse =
      'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n' +
      'data: {"id":"c1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Claude Opus 4.6 is no longer available. Please switch to Claude Opus 5.5."},"finish_reason":null}]}\n\n';

    const output = await runPassthrough([sse]);
    expect(output).toContain("model_retired");
    expect(output).toContain("Claude Opus 5.5");
    // The notice must NOT be relayed as ordinary answer content.
    expect(output).not.toContain('"delta":{"content":"Claude Opus 4.6');
  });

  it("relays a normal answer untouched", async () => {
    const sse =
      'data: {"id":"c2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n' +
      'data: {"id":"c2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\n' +
      "data: [DONE]\n\n";

    const output = await runPassthrough([sse]);
    expect(output).toContain('"content":"ok"');
    expect(output).not.toContain("model_retired");
  });
});
