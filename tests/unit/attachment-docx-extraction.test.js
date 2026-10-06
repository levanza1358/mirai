import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { extractAttachmentText } from "../../open-sse/translator/concerns/attachments.js";
import { openaiToClaudeRequest } from "../../open-sse/translator/request/openai-to-claude.js";
import { CLAUDE_BLOCK } from "../../open-sse/translator/schema/index.js";

/** Build a minimal but valid .docx (zip) containing word/document.xml. */
function buildDocx(documentXml) {
  const name = Buffer.from("word/document.xml", "utf8");
  const raw = Buffer.from(documentXml, "utf8");
  const deflated = deflateRawSync(raw);

  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let crc = -1;
  for (const b of raw) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ -1) >>> 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const localOffset = 0;
  const localPart = Buffer.concat([local, name, deflated]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10); // deflate
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(localOffset, 42);
  const centralPart = Buffer.concat([central, name]);
  const centralOffset = localPart.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([localPart, centralPart, eocd]);
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>SURAT KETERANGAN KERJA</w:t></w:r></w:p>
<w:p><w:r><w:t>Yang bertanda tangan di bawah ini menerangkan bahwa:</w:t></w:r></w:p>
<w:p><w:r><w:t>Nama: Budi Santoso</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Jabatan</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Staff IT</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>Special &amp; chars &lt;ok&gt; &quot;quoted&quot;</w:t></w:r></w:p>
</w:body></w:document>`;

describe("attachment text extraction", () => {
  it("extracts readable text from a real .docx (deflated) zip", () => {
    const text = extractAttachmentText(buildDocx(SAMPLE_XML), DOCX_MIME);
    expect(text).toBeTruthy();
    expect(text).toContain("SURAT KETERANGAN KERJA");
    expect(text).toContain("Budi Santoso");
    // Table cells survive as tab-separated values.
    expect(text).toContain("Jabatan");
    expect(text).toContain("Staff IT");
    // XML entities are decoded, markup is gone.
    expect(text).toContain('Special & chars <ok> "quoted"');
    expect(text).not.toContain("<w:p>");
  });

  it("returns null for an unsupported binary mime", () => {
    expect(extractAttachmentText(Buffer.from([1, 2, 3]), "application/octet-stream")).toBeNull();
  });

  it("decodes text/plain directly", () => {
    expect(extractAttachmentText(Buffer.from("hello world", "utf8"), "text/plain")).toBe("hello world");
  });

  it("returns null for a corrupt zip instead of throwing", () => {
    expect(extractAttachmentText(Buffer.from("not a zip at all"), DOCX_MIME)).toBeNull();
  });
});

describe("Claude translation of a .docx attachment", () => {
  const docxDataUri = `data:${DOCX_MIME};base64,${buildDocx(SAMPLE_XML).toString("base64")}`;

  it("sends the document text as a text block (previously dropped)", () => {
    const body = {
      model: "cc/claude-opus-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "bikinkan halaman surat keterangan kerja" },
            { type: "file", file: { filename: "2025. Surat Keterangan Kerja.docx", file_data: docxDataUri } },
          ],
        },
      ],
    };

    const out = openaiToClaudeRequest("cc/claude-opus-5", JSON.parse(JSON.stringify(body)), true, {});
    const blocks = out.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []));

    // Must NOT become a Claude document block (Anthropic rejects non-PDF).
    expect(blocks.some((b) => b.type === CLAUDE_BLOCK.DOCUMENT)).toBe(false);

    const attached = blocks.find((b) => b.type === CLAUDE_BLOCK.TEXT && b.text.includes("<attachment"));
    expect(attached).toBeTruthy();
    expect(attached.text).toContain("SURAT KETERANGAN KERJA");
    expect(attached.text).toContain("Budi Santoso");
    expect(attached.text).toContain("2025. Surat Keterangan Kerja.docx");
  });

  it("still sends a PDF as a real document block", () => {
    const pdfUri = "data:application/pdf;base64,JVBERi0xLjQK";
    const body = {
      messages: [
        {
          role: "user",
          content: [{ type: "file", file: { filename: "x.pdf", file_data: pdfUri } }],
        },
      ],
    };
    const out = openaiToClaudeRequest("m", JSON.parse(JSON.stringify(body)), true, {});
    const blocks = out.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []));
    const doc = blocks.find((b) => b.type === CLAUDE_BLOCK.DOCUMENT);
    expect(doc).toBeTruthy();
    expect(doc.source.media_type).toBe("application/pdf");
  });
});
