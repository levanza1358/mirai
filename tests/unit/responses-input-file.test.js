import { describe, it, expect } from "vitest";
import { responsesBlockToChatBlock } from "../../open-sse/translator/concerns/responsesBlocks.js";
import { openaiResponsesToOpenAIRequest } from "../../open-sse/translator/request/openai-responses.js";
import { RESPONSES_ITEM, OPENAI_BLOCK } from "../../open-sse/translator/schema/index.js";

// Regression guard for a reported production failure:
//   "400 Unsupported input[80].content[2] type:'input_file'"
// VS Code Copilot Chat sent a .docx through the Responses API; the input_file
// block was forwarded to an Anthropic-backed provider unchanged.
describe("Responses API input_file conversion", () => {
  const PDF_URI = "data:application/pdf;base64,JVBERi0xLjQK";
  const DOCX_URI =
    "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQ";

  it("converts input_file with file_data into a Chat Completions file block", () => {
    const out = responsesBlockToChatBlock({
      type: RESPONSES_ITEM.INPUT_FILE,
      file_data: PDF_URI,
      filename: "2025. Surat Keterangan Kerja.docx",
    });
    expect(out.type).toBe(OPENAI_BLOCK.FILE);
    expect(out.file.file_data).toBe(PDF_URI);
    expect(out.file.filename).toBe("2025. Surat Keterangan Kerja.docx");
  });

  it("derives a filename from the mime when none is given", () => {
    expect(responsesBlockToChatBlock({ type: "input_file", file_data: PDF_URI }).file.filename).toBe(
      "attachment.pdf"
    );
    expect(responsesBlockToChatBlock({ type: "input_file", file_data: DOCX_URI }).file.filename).toBe(
      "attachment.docx"
    );
  });

  it("accepts file_url as a fallback payload", () => {
    const out = responsesBlockToChatBlock({
      type: "input_file",
      file_url: "https://example.test/report.pdf",
    });
    expect(out.type).toBe(OPENAI_BLOCK.FILE);
    expect(out.file.file_data).toBe("https://example.test/report.pdf");
  });

  it("drops a block that carries only an unresolvable file_id", () => {
    // Forwarding this would reproduce the exact upstream 400.
    expect(responsesBlockToChatBlock({ type: "input_file", file_id: "file-abc123" })).toBeNull();
  });

  it("still converts the text / image blocks", () => {
    expect(responsesBlockToChatBlock({ type: "input_text", text: "hi" })).toEqual({
      type: OPENAI_BLOCK.TEXT,
      text: "hi",
    });
    expect(responsesBlockToChatBlock({ type: "output_text", text: "yo" })).toEqual({
      type: OPENAI_BLOCK.TEXT,
      text: "yo",
    });
    const img = responsesBlockToChatBlock({ type: "input_image", image_url: "data:image/png;base64,AAAA" });
    expect(img.type).toBe(OPENAI_BLOCK.IMAGE_URL);
    expect(img.image_url.url).toBe("data:image/png;base64,AAAA");
  });

  it("leaves an already-converted Chat Completions block untouched", () => {
    const already = { type: OPENAI_BLOCK.FILE, file: { filename: "a.pdf", file_data: PDF_URI } };
    expect(responsesBlockToChatBlock(already)).toEqual(already);
  });
});

describe("full Responses -> Chat Completions request translation", () => {
  const DOCX_URI =
    "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQ";

  it("no input_file block survives translation", () => {
    const body = {
      model: "cc/claude-opus-5",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "bikinkan halaman surat keterangan kerja" },
            { type: "input_file", file_data: DOCX_URI, filename: "2025. Surat Keterangan Kerja.docx" },
          ],
        },
      ],
    };

    const out = openaiResponsesToOpenAIRequest("cc/claude-opus-5", JSON.parse(JSON.stringify(body)), true, {});
    const blocks = out.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []));

    // The bug: the raw input_file would still be present here.
    expect(blocks.some((b) => b.type === "input_file")).toBe(false);
    expect(blocks.some((b) => b.type === OPENAI_BLOCK.FILE)).toBe(true);
    const file = blocks.find((b) => b.type === OPENAI_BLOCK.FILE);
    expect(file.file.filename).toBe("2025. Surat Keterangan Kerja.docx");
    expect(file.file.file_data).toBe(DOCX_URI);
  });

  it("keeps the accompanying text alongside the file", () => {
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "tolong baca ini" },
            { type: "input_file", file_data: DOCX_URI },
          ],
        },
      ],
    };
    const out = openaiResponsesToOpenAIRequest("m", JSON.parse(JSON.stringify(body)), true, {});
    const blocks = out.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []));
    expect(blocks.find((b) => b.type === OPENAI_BLOCK.TEXT)?.text).toBe("tolong baca ini");
    expect(blocks.find((b) => b.type === OPENAI_BLOCK.FILE)).toBeTruthy();
  });

  it("drops an unresolvable input_file instead of forwarding it", () => {
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "see attached" },
            { type: "input_file", file_id: "file-only-id" },
          ],
        },
      ],
    };
    const out = openaiResponsesToOpenAIRequest("m", JSON.parse(JSON.stringify(body)), true, {});
    const blocks = out.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []));
    expect(blocks.some((b) => b.type === "input_file")).toBe(false);
    expect(blocks.some((b) => b.type === OPENAI_BLOCK.TEXT)).toBe(true);
  });
});
