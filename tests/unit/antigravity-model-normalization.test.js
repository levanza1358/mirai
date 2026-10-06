import { describe, it, expect } from "vitest";
import {
  normalizeAntigravityModelId,
  stripTierSuffix,
  stripTieredInfix,
  detectModelRetirement,
  describeAntigravityFailure,
  suggestReplacement,
  isNonChatModelId,
  listUsableModelIds,
} from "../../open-sse/utils/antigravityModels.js";

// Regression guard for a verified production bug (2026-10-06): the registry sent
// `gemini-3.8-flash-high(high)` and the Antigravity backend answered
// 404 "Requested entity was not found." The bare id returns 200.
describe("antigravity model-id normalisation", () => {
  it("strips the legacy parenthesised tier suffix", () => {
    expect(stripTierSuffix("gemini-3.8-flash-high(high)")).toBe("gemini-3.8-flash-high");
    expect(stripTierSuffix("gemini-3.8-flash-medium(medium)")).toBe("gemini-3.8-flash-medium");
    expect(stripTierSuffix("gemini-3.7-flash-tiered(low)")).toBe("gemini-3.7-flash-tiered");
    expect(stripTierSuffix("gemini-3-flash")).toBe("gemini-3-flash");
  });

  it("strips the -tiered infix", () => {
    expect(stripTieredInfix("gemini-3.7-flash-tiered")).toBe("gemini-3.7-flash");
    expect(stripTieredInfix("gemini-3.6-flash-tiered")).toBe("gemini-3.6-flash");
    expect(stripTieredInfix("gemini-3-flash")).toBe("gemini-3-flash");
  });

  it("normalises the exact ids the registry used to send", () => {
    expect(normalizeAntigravityModelId("gemini-3.8-flash-high(high)")).toBe("gemini-3.8-flash-high");
    expect(normalizeAntigravityModelId("gemini-3.7-flash-tiered(high)")).toBe("gemini-3.7-flash-high");
    expect(normalizeAntigravityModelId("gemini-3.6-flash-tiered(low)")).toBe("gemini-3.6-flash-low");
  });

  it("leaves already-correct ids untouched", () => {
    for (const id of [
      "gemini-3-flash",
      "gemini-3-flash-agent",
      "gemini-pro-agent",
      "claude-sonnet-5-5-medium",
      "claude-opus-5-5-high",
      "gpt-oss-120b-medium",
      "gemini-3.1-flash-image",
    ]) {
      expect(normalizeAntigravityModelId(id)).toBe(id);
    }
  });

  it("is defensive about non-strings", () => {
    expect(normalizeAntigravityModelId(undefined)).toBeUndefined();
    expect(normalizeAntigravityModelId(null)).toBeNull();
    expect(normalizeAntigravityModelId("")).toBe("");
  });
});

describe("antigravity retirement detection", () => {
  it("detects the real upstream Sonnet notice and extracts the replacement", () => {
    const hit = detectModelRetirement(
      "Claude Sonnet 4.6 is no longer available. Please switch to Claude Sonnet 5.5."
    );
    expect(hit).not.toBeNull();
    expect(hit.retired).toBe(true);
    expect(hit.replacement).toBe("Claude Sonnet 5.5");
  });

  it("detects the real upstream Opus notice", () => {
    const hit = detectModelRetirement(
      "Claude Opus 4.6 is no longer available. Please switch to Claude Opus 5.5."
    );
    expect(hit?.replacement).toBe("Claude Opus 5.5");
  });

  it("keeps dots inside a versioned replacement name", () => {
    const hit = detectModelRetirement("X is no longer available. Please switch to Claude Sonnet 5.5.");
    expect(hit?.replacement).toBe("Claude Sonnet 5.5");
  });

  it("accepts the 'has been retired' wording", () => {
    const hit = detectModelRetirement("This model has been retired. Please use Gemini 3 Flash.");
    expect(hit?.retired).toBe(true);
    expect(hit?.replacement).toBe("Gemini 3 Flash");
  });

  it("does not misfire on a normal answer", () => {
    expect(detectModelRetirement("Sure — here is the function you asked for.")).toBeNull();
    expect(detectModelRetirement("The server is available now.")).toBeNull();
    expect(detectModelRetirement("")).toBeNull();
    expect(detectModelRetirement(undefined)).toBeNull();
  });

  it("ignores a long document that merely quotes the phrase", () => {
    // >400 chars of leading prose pushes a real notice out of the sample window.
    const noise = "Lorem ipsum dolor sit amet. ".repeat(30);
    expect(detectModelRetirement(`${noise}is no longer available. Please switch to X.`)).toBeNull();
  });
});

describe("antigravity 404 explanation", () => {
  it("explains a NOT_FOUND as an account/tier problem and suggests models", () => {
    const info = describeAntigravityFailure({
      status: 404,
      bodyText: JSON.stringify({
        error: { code: 404, message: "Requested entity was not found.", status: "NOT_FOUND" },
      }),
      model: "gemini-3.8-flash-high",
      availableModels: {
        "gemini-3.8-flash-high": { recommended: true },
        "gemini-3.8-flash-low": {},
        "gemini-3-flash": {},
      },
    });
    expect(info).not.toBeNull();
    expect(info.kind).toBe("model_unavailable");
    expect(info.message).toContain("not available");
    expect(info.upstreamMessage).toBe("Requested entity was not found.");
    expect(info.suggestions.length).toBeGreaterThan(0);
    expect(info.suggestions.every((s) => s.startsWith("gemini-3"))).toBe(true);
  });

  it("also keys off the NOT_FOUND status string when the code is absent", () => {
    const info = describeAntigravityFailure({
      status: 400,
      bodyText: JSON.stringify({ error: { status: "NOT_FOUND", message: "nope" } }),
      model: "x",
      availableModels: {},
    });
    expect(info?.kind).toBe("model_unavailable");
  });

  it("returns null for unrelated failures so normal handling continues", () => {
    expect(
      describeAntigravityFailure({
        status: 429,
        bodyText: JSON.stringify({ error: { code: 429, message: "Quota exceeded" } }),
        model: "gemini-3-flash",
        availableModels: {},
      })
    ).toBeNull();
    expect(
      describeAntigravityFailure({ status: 503, bodyText: "upstream busy", model: "m", availableModels: {} })
    ).toBeNull();
  });
});

// The non-streaming handler must inspect the ANTIGRAVITY ENVELOPE, not just a
// top-level candidates array: upstream returns { response: { candidates: [...] } }
// and an extractor that only looks at the top level never sees the notice.
describe("antigravity stream accumulation (envelope shape)", () => {
  // The stream loop reads the parsed chunk in the PROVIDER format (targetFormat),
  // which for Antigravity is the { response: { candidates: [...] } } envelope.
  // A bare `parsed.candidates` lookup silently accumulated nothing, so the
  // retired-model notice was never seen and was relayed as an answer.
  const accumulate = (parsed) => {
    const inner = parsed.response && typeof parsed.response === "object" ? parsed.response : parsed;
    let text = "";
    if (inner.candidates?.[0]?.content?.parts) {
      for (const part of inner.candidates[0].content.parts) {
        if (part.text && typeof part.text === "string" && part.thought !== true) text += part.text;
      }
    }
    return text;
  };

  it("reads assistant text from the wrapped Antigravity chunk", () => {
    const chunk = {
      response: {
        candidates: [{ content: { parts: [{ text: "Claude Opus 4.6 is no longer available. Please switch to Claude Opus 5.5." }] } }],
      },
    };
    const text = accumulate(chunk);
    expect(text).toContain("no longer available");
    expect(detectModelRetirement(text)?.replacement).toBe("Claude Opus 5.5");
  });

  it("still reads a bare (unwrapped) Gemini chunk", () => {
    const chunk = { candidates: [{ content: { parts: [{ text: "Gemini X is no longer available. Please switch to Gemini Y." }] } }] };
    expect(detectModelRetirement(accumulate(chunk))?.replacement).toBe("Gemini Y");
  });

  it("skips thought parts", () => {
    const chunk = {
      response: { candidates: [{ content: { parts: [{ thought: true, text: "A is no longer available. Please switch to B." }, { text: "ok" }] } }] },
    };
    expect(detectModelRetirement(accumulate(chunk))).toBeNull();
  });
});

describe("stream.js module health", () => {
  it("exports createSSEStream", async () => {
    const mod = await import("../../open-sse/utils/stream.js");
    expect(typeof mod.createSSEStream).toBe("function");
  });
});

describe("antigravity envelope text extraction", () => {
  const extract = (body) => {
    if (!body) return "";
    if (typeof body === "string") return body;
    const inner = body.response && typeof body.response === "object" ? body.response : body;
    const out = [];
    const push = (v) => {
      if (typeof v === "string" && v) out.push(v);
    };
    for (const c of inner.choices || []) {
      push(c?.message?.content);
      push(c?.text);
    }
    for (const b of inner.content || []) push(b?.text);
    for (const c of inner.candidates || []) {
      for (const p of c?.content?.parts || []) {
        if (p?.thought !== true) push(p?.text);
      }
    }
    return out.join("\n");
  };

  it("sees the notice inside the Antigravity {response:{candidates}} envelope", () => {
    const body = {
      response: {
        candidates: [
          {
            content: {
              parts: [{ text: "Claude Opus 4.6 is no longer available. Please switch to Claude Opus 5.5." }],
            },
          },
        ],
      },
    };
    const hit = detectModelRetirement(extract(body));
    expect(hit?.retired).toBe(true);
    expect(hit?.replacement).toBe("Claude Opus 5.5");
  });

  it("ignores thought parts (reasoning is not user-visible output)", () => {
    const body = {
      response: {
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "X is no longer available. Please switch to Y." },
                { text: "ok" },
              ],
            },
          },
        ],
      },
    };
    expect(detectModelRetirement(extract(body))).toBeNull();
  });

  it("still sees a top-level candidates array (unwrapped Gemini)", () => {
    const body = {
      candidates: [{ content: { parts: [{ text: "Gemini X is no longer available. Please switch to Gemini Y." }] } }],
    };
    const hit = detectModelRetirement(extract(body));
    expect(hit?.replacement).toBe("Gemini Y");
  });
});

describe("antigravity model listing helpers", () => {
  it("flags internal UI ids as non-chat", () => {
    expect(isNonChatModelId("chat_23310")).toBe(true);
    expect(isNonChatModelId("tab_jump_flash_lite_preview")).toBe(true);
    expect(isNonChatModelId("tab_flash_lite_preview")).toBe(true);
    expect(isNonChatModelId("gemini-3-flash")).toBe(false);
    expect(isNonChatModelId("")).toBe(true);
  });

  it("filters a real fetchAvailableModels payload", () => {
    const ids = listUsableModelIds({
      models: {
        chat_23310: {},
        tab_flash_lite_preview: {},
        "gemini-3-flash": {},
        "claude-sonnet-5-5-medium": {},
      },
    });
    expect(ids).toEqual(["gemini-3-flash", "claude-sonnet-5-5-medium"]);
  });

  it("tolerates a malformed payload", () => {
    expect(listUsableModelIds(null)).toEqual([]);
    expect(listUsableModelIds({})).toEqual([]);
    expect(listUsableModelIds({ models: "nope" })).toEqual([]);
  });

  it("prefers same-family suggestions, then recommended, then anything", () => {
    const available = {
      "gemini-3-flash": {},
      "gemini-3.1-pro-low": {},
      "claude-sonnet-5-5-medium": { recommended: true },
    };
    // A 3.8 request must still surface the usable gemini models.
    const geminiSuggestion = suggestReplacement("gemini-3.8-flash-high", available);
    expect(geminiSuggestion).toContain("gemini-3-flash");
    // No family match at all → falls back to the recommended entry.
    expect(suggestReplacement("totally-unknown", available)).toEqual(["claude-sonnet-5-5-medium"]);
  });

  it("prefers the closest version family when several exist", () => {
    const available = {
      "gemini-3.8-flash-high": {},
      "gemini-3.8-flash-low": {},
      "gemini-3-flash": {},
    };
    const picked = suggestReplacement("gemini-3.8-flash-medium", available);
    expect(picked).toEqual(["gemini-3.8-flash-high", "gemini-3.8-flash-low"]);
  });
});
