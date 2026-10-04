import { describe, it, expect } from "vitest";
import {
  extractModelAnswer,
  isReasoningOnlySoftPass,
  summarizeModelTests,
  DEFAULT_MODEL_TEST_PROMPT,
} from "../../src/shared/utils/modelTestAnswer.js";

describe("extractModelAnswer", () => {
  it("returns assistant content when present", () => {
    const payload = { choices: [{ message: { content: "I am GPT-4o." } }] };
    expect(extractModelAnswer(payload)).toBe("I am GPT-4o.");
  });

  it("trims surrounding whitespace", () => {
    const payload = { choices: [{ message: { content: "  hello  \n" } }] };
    expect(extractModelAnswer(payload)).toBe("hello");
  });

  it("falls back to reasoning_content when content is empty", () => {
    const payload = { choices: [{ message: { content: "", reasoning_content: "thinking..." } }] };
    expect(extractModelAnswer(payload)).toBe("thinking...");
  });

  it("falls back to reasoning then thinking", () => {
    expect(extractModelAnswer({ choices: [{ message: { reasoning: "r" } }] })).toBe("r");
    expect(extractModelAnswer({ choices: [{ message: { thinking: "t" } }] })).toBe("t");
  });

  it("returns empty string for missing payload/choices", () => {
    expect(extractModelAnswer(null)).toBe("");
    expect(extractModelAnswer({})).toBe("");
    expect(extractModelAnswer({ choices: [] })).toBe("");
  });
});

describe("isReasoningOnlySoftPass", () => {
  it("is true for length-limited empty content with reasoning", () => {
    const payload = {
      choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "long cot" } }],
    };
    expect(isReasoningOnlySoftPass(payload)).toBe(true);
  });

  it("is false when content exists", () => {
    const payload = {
      choices: [{ finish_reason: "length", message: { content: "answer", reasoning_content: "cot" } }],
    };
    expect(isReasoningOnlySoftPass(payload)).toBe(false);
  });

  it("is false when finish_reason is stop", () => {
    const payload = {
      choices: [{ finish_reason: "stop", message: { content: "", reasoning_content: "cot" } }],
    };
    expect(isReasoningOnlySoftPass(payload)).toBe(false);
  });

  it("is false when there is no reasoning", () => {
    const payload = { choices: [{ finish_reason: "length", message: { content: "" } }] };
    expect(isReasoningOnlySoftPass(payload)).toBe(false);
  });
});

describe("DEFAULT_MODEL_TEST_PROMPT", () => {
  it("is the user-facing probe sentence", () => {
    expect(DEFAULT_MODEL_TEST_PROMPT).toContain("your real model AI");
    expect(DEFAULT_MODEL_TEST_PROMPT).toContain("cut off training");
  });
});

describe("summarizeModelTests", () => {
  it("counts passes and collects failed ids in order", () => {
    const s = summarizeModelTests([
      { id: "a", ok: true },
      { id: "b", ok: false, error: "x" },
      { id: "c", ok: false },
      { id: "d", ok: true },
    ]);
    expect(s.total).toBe(4);
    expect(s.completed).toBe(4);
    expect(s.passed).toBe(2);
    expect(s.failed).toBe(2);
    expect(s.failedIds).toEqual(["b", "c"]);
    expect(s.stopped).toBe(false);
  });

  it("reflects the disableFailed choice", () => {
    const s = summarizeModelTests([{ id: "a", ok: false }], { disableFailed: true });
    expect(s.disableFailed).toBe(true);
    expect(s.failedIds).toEqual(["a"]);
  });

  it("reflects a stopped run (only completed items counted)", () => {
    const s = summarizeModelTests([{ id: "a", ok: true }], { stopped: true });
    expect(s.stopped).toBe(true);
    expect(s.total).toBe(1);
    expect(s.completed).toBe(1);
  });

  it("handles empty / invalid input", () => {
    expect(summarizeModelTests([]).total).toBe(0);
    expect(summarizeModelTests(null).passed).toBe(0);
    expect(summarizeModelTests([null]).total).toBe(1);
    expect(summarizeModelTests([{ ok: false }]).failedIds).toEqual([]);
  });
});
