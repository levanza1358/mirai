import { describe, it, expect } from "vitest";
import { stripUnsupportedModalities, preExtractPDFs } from "../../open-sse/translator/concerns/modality.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

// Regression guard for a reported production failure: PDF / Word / Excel files
// sent through any provider were dropped with "[file omitted: model has no
// document support]" even on models that natively read PDF (Claude, Gemini,
// OpenAI, CodeBuddy vision-capable models). Root cause: caps.pdf stayed false
// from the DEFAULT floor for every model that didn't explicitly set it, so
// stripUnsupportedModalities treated PDF as unsupported and replaced the block
// with a placeholder. Word/Excel (.docx/.xlsx) were dropped too because the
// OOXML pre-extraction only ran when caps.pdf was false.
//
// Fix 1: withDocSupport() sets pdf=true whenever vision=true, because a
// vision-capable model almost universally accepts PDF / document input.
// Fix 2: preExtractConvertibleDocs() always extracts OOXML to text before the
// per-format strippers run, regardless of caps.pdf — providers reject OOXML as
// native media parts even when they support PDF.
// Fix 3: preExtractPDFs() (async) extracts PDF to text for EVERY provider —
// gateway providers like CodeBuddy reject an inline `file` block, and native
// PDF dispatch (Claude/Gemini translators) would only fire on a surviving
// `file`/`document` block. Extracting to text is the only universally safe path.

const PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAzMDAgMTQ0XS9SZXNvdXJjZXM8PC9Qcm9jU2V0Wy9QREYvVGV4dC9JbWFnZUIvSW1hZ2VDXQovRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+CmVuZG9iago1IDAgb2JqCjw8L0xlbmd0aCA1Nj4+c3RyZWFtCkJUCi9GMSAxMiBUZgpCVC9GMSAxMiBUZgooSGVsbG8gV29ybGQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMTg1IDAwMDAwIG4gCjAwMDAwMDAzMTQgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDUvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo0MDUKJSVFT0YG";
const PDF_URI = "data:application/pdf;base64," + PDF_B64;

describe("withDocSupport: vision implies pdf", () => {
  it("CodeBuddy vision-capable model gets pdf=true", () => {
    const caps = getCapabilitiesForModel("codebuddy-cn", "glm-5.2");
    expect(caps.vision).toBe(true);
    expect(caps.pdf).toBe(true);
  });

  it("Claude vision-capable model gets pdf=true", () => {
    const caps = getCapabilitiesForModel("anthropic", "claude-opus-4.7");
    expect(caps.vision).toBe(true);
    expect(caps.pdf).toBe(true);
  });

  it("Gemini vision-capable model gets pdf=true", () => {
    const caps = getCapabilitiesForModel("gemini", "gemini-3-pro");
    expect(caps.vision).toBe(true);
    expect(caps.pdf).toBe(true);
  });

  it("OpenAI vision-capable model gets pdf=true", () => {
    const caps = getCapabilitiesForModel("openai", "gpt-4o");
    expect(caps.vision).toBe(true);
    expect(caps.pdf).toBe(true);
  });

  it("non-vision model stays pdf=false (deepseek-chat)", () => {
    const caps = getCapabilitiesForModel("deepseek", "deepseek-chat");
    expect(caps.pdf).toBe(false);
  });
});

describe("preExtractPDFs: PDF extracted to text for every provider", () => {
  it("Responses: input_file PDF becomes text block with extracted content", async () => {
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "baca pdf ini" },
            { type: "input_file", file_data: PDF_URI, filename: "doc.pdf" },
          ],
        },
      ],
    };
    const touched = await preExtractPDFs(body, FORMATS.OPENAI_RESPONSES);
    expect(touched).toBe(true);
    const blocks = body.input[0].content;
    expect(blocks.some((b) => b.type === "input_file")).toBe(false);
    const textBlock = blocks.find((b) => b.type === "input_text" && b.text?.includes("attachment"));
    expect(textBlock).toBeTruthy();
    expect(textBlock.text).toContain("Hello World");
  });

  it("OpenAI chat: file PDF becomes text block with extracted content", async () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "read this" },
            { type: "file", file: { filename: "doc.pdf", file_data: PDF_URI } },
          ],
        },
      ],
    };
    const touched = await preExtractPDFs(body, FORMATS.OPENAI);
    expect(touched).toBe(true);
    const blocks = body.messages[0].content;
    expect(blocks.some((b) => b.type === "file")).toBe(false);
    const textBlock = blocks.find((b) => b.type === "text" && b.text?.includes("attachment"));
    expect(textBlock).toBeTruthy();
    expect(textBlock.text).toContain("Hello World");
  });

  it("Claude: document PDF becomes text block with extracted content", async () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "read this" },
            {
              type: "document",
              title: "report.pdf",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: PDF_B64,
              },
            },
          ],
        },
      ],
    };
    const touched = await preExtractPDFs(body, FORMATS.CLAUDE);
    expect(touched).toBe(true);
    const blocks = body.messages[0].content;
    expect(blocks.some((b) => b.type === "document")).toBe(false);
    const textBlock = blocks.find((b) => b.type === "text" && b.text?.includes("attachment"));
    expect(textBlock).toBeTruthy();
    expect(textBlock.text).toContain("Hello World");
  });

  it("leaves non-PDF attachments untouched", async () => {
    const DOCX_URI =
      "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQ";
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "baca" },
            { type: "input_file", file_data: DOCX_URI, filename: "doc.docx" },
          ],
        },
      ],
    };
    const touched = await preExtractPDFs(body, FORMATS.OPENAI_RESPONSES);
    expect(touched).toBe(false);
    expect(body.input[0].content.some((b) => b.type === "input_file")).toBe(true);
  });
});

describe("OOXML (.docx/.xlsx) is always extracted to text regardless of caps.pdf", () => {
  const DOCXML =
    '<?xml version="1.0"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    '<w:p><w:r><w:t>Hello from docx</w:t></w:r></w:p></w:body></w:document>';

  function makeStoredZip() {
    const fileData = Buffer.from(DOCXML, "utf8");
    const nameBuf = Buffer.from("word/document.xml", "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(fileData.length, 18);
    local.writeUInt32LE(fileData.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localTotal = 30 + nameBuf.length + fileData.length;
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(fileData.length, 16);
    cen.writeUInt32LE(fileData.length, 20);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(0, 42);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(46 + nameBuf.length, 12);
    eocd.writeUInt32LE(localTotal, 16);
    const buf = Buffer.concat([local, nameBuf, fileData, cen, nameBuf, eocd]);
    return "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64," + buf.toString("base64");
  }

  const DOCX_URI = makeStoredZip();

  it("extracts .docx to text even when caps.pdf=true (CodeBuddy vision model)", () => {
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "baca" },
            { type: "input_file", file_data: DOCX_URI, filename: "report.docx" },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.OPENAI_RESPONSES, { vision: true, pdf: true, audioInput: true, videoInput: true });
    const blocks = body.input[0].content;
    expect(blocks.some((b) => b.type === "input_file")).toBe(false);
    const textBlock = blocks.find((b) => b.type === "input_text" && b.text?.includes("attachment"));
    expect(textBlock).toBeTruthy();
    expect(textBlock.text).toContain("Hello from docx");
  });

  it("extracts .docx to text for non-vision model (deepseek-chat, pdf=false)", () => {
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "baca" },
            { type: "input_file", file_data: DOCX_URI, filename: "report.docx" },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.OPENAI_RESPONSES, { vision: false, pdf: false, audioInput: true, videoInput: true });
    const blocks = body.input[0].content;
    expect(blocks.some((b) => b.type === "input_file")).toBe(false);
    const textBlock = blocks.find((b) => b.type === "input_text" && b.text?.includes("attachment"));
    expect(textBlock).toBeTruthy();
    expect(textBlock.text).toContain("Hello from docx");
  });
});
