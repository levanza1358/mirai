import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { stripUnsupportedModalities } from "../../open-sse/translator/concerns/modality.js";
import { extractAttachmentText } from "../../open-sse/translator/concerns/attachments.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

/** Build a minimal ZIP containing the given members (name -> text). */
function buildZip(members) {
  const locals = [];
  const centrals = [];
  for (const [name, text] of Object.entries(members)) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(text, "utf8");
    const deflated = deflateRawSync(raw);

    const table = (() => {
      const t = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })();
    let crc = -1;
    for (const b of raw) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    crc = (crc ^ -1) >>> 0;

    const localOffset = locals.reduce((n, b) => n + b.length, 0);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(Buffer.concat([local, nameBuf, deflated]));

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
  }

  const localPart = Buffer.concat(locals);
  const centralPart = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(members).length, 8);
  eocd.writeUInt16LE(Object.keys(members).length, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, eocd]);
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const docx = () =>
  buildZip({
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>LAPORAN BULANAN</w:t></w:r></w:p>
<w:p><w:r><w:t>Total penjualan: 1250000</w:t></w:r></w:p>
</w:body></w:document>`,
  });

const xlsx = () =>
  buildZip({
    "xl/sharedStrings.xml": `<?xml version="1.0"?><sst xmlns="x">
<si><t>Nama</t></si><si><t>Jabatan</t></si><si><t>Budi</t></si><si><t>Staff IT</t></si>
</sst>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="x"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
<row r="3"><c r="A3"><v>42</v></c></row>
</sheetData></worksheet>`,
  });

const dataUri = (buf, mime) => `data:${mime};base64,${buf.toString("base64")}`;

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

describe("attachment extraction: Word / Excel / text", () => {
  it("extracts .docx text", () => {
    const text = extractAttachmentText(docx(), DOCX_MIME);
    expect(text).toContain("LAPORAN BULANAN");
    expect(text).toContain("Total penjualan: 1250000");
  });

  it("extracts .xlsx rows, resolving shared strings and numbers", () => {
    const text = extractAttachmentText(xlsx(), XLSX_MIME);
    expect(text).toContain("Nama");
    expect(text).toContain("Staff IT");
    // Shared-string cells and numeric cells both survive.
    expect(text).toContain("Budi");
    expect(text).toContain("42");
  });

  it("reads EVERY worksheet, labelled by name", () => {
    const multi = buildZip({
      "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="x" xmlns:r="r"><sheets>
<sheet name="Karyawan" sheetId="1" r:id="rId1"/>
<sheet name="Gaji" sheetId="2" r:id="rId2"/>
</sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="x">
<Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="w" Target="worksheets/sheet2.xml"/>
</Relationships>`,
      "xl/sharedStrings.xml": `<?xml version="1.0"?><sst xmlns="x">
<si><t>Budi</t></si><si><t>Gaji Pokok</t></si><si><t>5000000</t></si>
</sst>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="x"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
</sheetData></worksheet>`,
      "xl/worksheets/sheet2.xml": `<?xml version="1.0"?><worksheet xmlns="x"><sheetData>
<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>2</v></c></row>
</sheetData></worksheet>`,
    });

    const text = extractAttachmentText(multi, XLSX_MIME);
    // Both sheets are present, and each is labelled so the model can tell them apart.
    expect(text).toContain("--- Sheet: Karyawan ---");
    expect(text).toContain("--- Sheet: Gaji ---");
    expect(text).toContain("Budi");
    expect(text).toContain("Gaji Pokok");
    expect(text).toContain("5000000");
  });

  it("labels nothing when the workbook has a single sheet", () => {
    const text = extractAttachmentText(xlsx(), XLSX_MIME);
    expect(text).not.toContain("--- Sheet:");
  });

  it("extracts plain text", () => {
    expect(extractAttachmentText(Buffer.from("halo dunia"), "text/plain")).toBe("halo dunia");
  });

  it("returns null for a mime we cannot read", () => {
    expect(extractAttachmentText(Buffer.from([1, 2, 3]), "application/octet-stream")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Provider-agnostic: model WITHOUT document support                   */
/* ------------------------------------------------------------------ */

describe("unsupported document becomes extracted text (not dropped)", () => {
  const noDocCaps = { vision: true, audioInput: false, pdf: false, videoInput: false };

  it("OpenAI chat: file -> text block instead of a placeholder", () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "baca laporan ini" },
            { type: "file", file: { filename: "laporan.docx", file_data: dataUri(docx(), DOCX_MIME) } },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.OPENAI, noDocCaps);

    const blocks = body.messages[0].content;
    expect(blocks.some((b) => b.type === "file")).toBe(false);
    const text = blocks.map((b) => b.text || "").join("\n");
    expect(text).toContain("LAPORAN BULANAN");
    expect(text).toContain("laporan.docx");
    // The old behaviour: a useless placeholder telling the model nothing.
    expect(text).not.toContain("file omitted");
  });

  it("Responses API: input_file -> input_text with contents", () => {
    const body = {
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "ringkas dokumen ini" },
            { type: "input_file", file_data: dataUri(docx(), DOCX_MIME), filename: "r.docx" },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.OPENAI_RESPONSES, noDocCaps);

    const content = body.input[0].content;
    expect(content.some((b) => b.type === "input_file")).toBe(false);
    const text = content.map((b) => b.text || "").join("\n");
    expect(text).toContain("LAPORAN BULANAN");
    expect(text).not.toContain("file omitted");
  });

  it("Claude: document block -> text with contents", () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "baca" },
            { type: "document", source: { type: "base64", media_type: DOCX_MIME, data: docx().toString("base64") } },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.CLAUDE, noDocCaps);

    const blocks = body.messages[0].content;
    expect(blocks.some((b) => b.type === "document")).toBe(false);
    const text = blocks.map((b) => b.text || "").join("\n");
    expect(text).toContain("LAPORAN BULANAN");
    expect(text).not.toContain("file omitted");
  });

  it("Gemini: unsupported doc part -> text with contents", () => {
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: "baca ini" },
            { inlineData: { mime_type: DOCX_MIME, data: docx().toString("base64") } },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.GEMINI, noDocCaps);

    const parts = body.contents[0].parts;
    expect(parts.some((p) => p.inlineData)).toBe(false);
    const text = parts.map((p) => p.text || "").join("\n");
    expect(text).toContain("LAPORAN BULANAN");
    expect(text).not.toContain("file omitted");
  });
});

/* ------------------------------------------------------------------ */
/* Provider-agnostic: model WITH document support (OOXML still converted) */
/* ------------------------------------------------------------------ */

describe("OOXML is converted even when the model claims document support", () => {
  const fullCaps = { vision: true, audioInput: true, pdf: true, videoInput: true };

  it("Gemini: .docx inlineData -> text (Gemini rejects OOXML inlineData)", () => {
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mime_type: DOCX_MIME, data: docx().toString("base64") } }],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.GEMINI, fullCaps);
    const parts = body.contents[0].parts;
    expect(parts.some((p) => p.inlineData)).toBe(false);
    expect(parts.map((p) => p.text).join("")).toContain("LAPORAN BULANAN");
  });

  // Note: in production, preExtractPDFs() (async) extracts PDF to text before
  // stripUnsupportedModalities runs — every gateway gets the text, not the raw
  // block. This test validates only the sync stripper in isolation: with
  // caps.pdf=true it does NOT touch a PDF block (no placeholder injected).
  it("Claude: a PDF document block is left untouched by the sync stripper", () => {
    const pdfBlock = {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: "JVBERi0xLjQK" },
    };
    const body = { messages: [{ role: "user", content: [pdfBlock] }] };
    stripUnsupportedModalities(body, FORMATS.CLAUDE, fullCaps);
    expect(body.messages[0].content).toEqual([pdfBlock]);
  });

  it("OpenAI: a PDF file block is left untouched by the sync stripper when pdf is supported", () => {
    const fileBlock = {
      type: "file",
      file: { filename: "x.pdf", file_data: "data:application/pdf;base64,JVBERi0xLjQK" },
    };
    const body = { messages: [{ role: "user", content: [fileBlock] }] };
    stripUnsupportedModalities(body, FORMATS.OPENAI, fullCaps);
    expect(body.messages[0].content).toEqual([fileBlock]);
  });
});

/* ------------------------------------------------------------------ */
/* Images keep the old placeholder behaviour                           */
/* ------------------------------------------------------------------ */

describe("images still fall back to the placeholder", () => {
  it("OpenAI: image removed when the model has no vision", () => {
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "what is this" },
            { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
          ],
        },
      ],
    };
    stripUnsupportedModalities(body, FORMATS.OPENAI, { vision: false, pdf: true, audioInput: true });
    const text = body.messages[0].content.map((b) => b.text || "").join("\n");
    expect(text).toContain("image omitted");
  });
});
