import { inflateRawSync } from "node:zlib";

/**
 * Extract plain text from an attachment so providers that cannot accept the
 * original mime type still receive its content.
 *
 * Why: Anthropic's Messages API only accepts `application/pdf` as a `document`
 * block. Sending a `.docx` there is impossible, and silently dropping it (the
 * previous behaviour) loses the user's file with no explanation — a request that
 * says "read the attached contract" reaches the model with no attachment at all.
 *
 * `.docx`/`.pptx`/`.xlsx` are ZIP archives, so we read the relevant XML part with
 * the built-in zlib and strip the markup. No new dependency.
 */

// Mime types whose bytes we can turn into text.
// OOXML (.docx/.xlsx/.pptx) are ZIP archives; the inner part holds the content.
const ZIP_TEXT_PARTS = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["word/document.xml"],
  // Spreadsheet: shared strings + the sheet itself (numbers live in the sheet).
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    "xl/sharedStrings.xml",
    "xl/worksheets/sheet1.xml",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "ppt/slides/slide1.xml",
  ],
  "application/msword": [], // legacy binary .doc — not a zip, handled below
  "application/pdf": [], // handled natively by the provider, never extracted
};

/**
 * Find a member inside a ZIP archive (stored or deflated).
 * Minimal reader: enough for OOXML, avoiding a zip dependency.
 *
 * @param {Buffer} buf
 * @param {string} wantedName
 * @returns {Buffer|null}
 */
function readZipEntry(buf, wantedName) {
  // End Of Central Directory (EOCD) signature 0x06054b50, scanned from the tail.
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const total = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < total; n++) {
    if (offset + 46 > buf.length) return null;
    // Central directory file header signature 0x02014b50
    if (buf.readUInt32LE(offset) !== 0x02014b50) return null;

    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");

    if (name === wantedName) {
      // Local file header: 30 bytes + name + extra, then the data.
      if (localOffset + 30 > buf.length) return null;
      const localNameLen = buf.readUInt16LE(localOffset + 26);
      const localExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const data = buf.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data; // stored
      if (method === 8) {
        try {
          return inflateRawSync(data);
        } catch {
          return null;
        }
      }
      return null; // other compression methods are not used by OOXML
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/**
 * Strip OOXML markup into readable text.
 * Paragraph (`</w:p>`) and line (`<w:br/>`) boundaries become newlines; cells
 * become tabs so tables stay legible.
 */
function xmlToText(xml) {
  return xml
    .replace(/<w:tab\b[^>]*\/?>/gi, "\t")
    .replace(/<w:br\b[^>]*\/?>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/w:tc>/gi, "\t")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * List the worksheet parts in workbook order, with their display names.
 * Falls back to sheet1..sheetN when workbook.xml is unavailable.
 */
function listWorksheetParts(zipBytes) {
  const workbook = readZipEntry(zipBytes, "xl/workbook.xml")?.toString("utf8");
  const rels = readZipEntry(zipBytes, "xl/_rels/workbook.xml.rels")?.toString("utf8");

  // r:id -> target path (e.g. "worksheets/sheet1.xml")
  const relTargets = new Map();
  if (rels) {
    const relRe = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi;
    let m;
    while ((m = relRe.exec(rels))) {
      const id = m[1];
      let target = m[2].replace(/^\/?xl\//, "").replace(/^\.\//, "");
      if (!target.startsWith("worksheets/")) target = `worksheets/${target.split("/").pop()}`;
      relTargets.set(id, `xl/${target}`);
    }
  }

  const sheets = [];
  if (workbook) {
    const sheetRe = /<sheet\b([^>]*)\/?>/gi;
    let m;
    while ((m = sheetRe.exec(workbook))) {
      const attrs = m[1];
      const name = attrs.match(/name="([^"]*)"/i)?.[1] ?? "";
      const rid = attrs.match(/r:id="([^"]+)"/i)?.[1];
      const target = rid ? relTargets.get(rid) : null;
      if (target) sheets.push({ name: decodeXml(name), part: target });
    }
  }

  if (sheets.length) return sheets;

  // No workbook metadata: probe sheet1..sheetN directly.
  for (let i = 1; i <= 20; i++) {
    const part = `xl/worksheets/sheet${i}.xml`;
    if (readZipEntry(zipBytes, part)) sheets.push({ name: `Sheet${i}`, part });
    else if (i > 1) break;
  }
  return sheets;
}

/**
 * Extract every worksheet, labelled by its display name.
 * A workbook routinely has more than one sheet; reading only sheet1 silently
 * hides the rest of the user's data.
 */
function workbookToText(zipBytes) {
  const shared = parseSharedStrings(readZipEntry(zipBytes, "xl/sharedStrings.xml")?.toString("utf8"));
  const sheets = listWorksheetParts(zipBytes);
  if (!sheets.length) return null;

  const sections = [];
  const multi = sheets.length > 1;
  for (const sheet of sheets) {
    const xml = readZipEntry(zipBytes, sheet.part);
    if (!xml) continue;
    const text = sheetXmlToText(xml.toString("utf8"), shared);
    if (!text) continue;
    sections.push(multi ? `--- Sheet: ${sheet.name} ---\n${text}` : text);
  }
  return sections.join("\n\n").trim() || null;
}

/**
 * Turn a spreadsheet sheet into readable rows.
 * Cells reference shared strings by index (`t="s"`), which is how text values
 * are stored; numbers are inline.
 */
function sheetXmlToText(sheetXml, sharedStrings) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(sheetXml))) {
    const cells = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1] || "";
      const inner = cellMatch[2] || "";
      const valueMatch = inner.match(/<v[^>]*>([\s\S]*?)<\/v>/i);
      const inlineMatch = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/i);
      let value = inlineMatch ? inlineMatch[1] : valueMatch ? valueMatch[1] : "";
      // `t="s"` means the value is an index into sharedStrings.xml.
      if (/t="s"/i.test(attrs) && /^\d+$/.test(value.trim())) {
        value = sharedStrings[Number(value.trim())] ?? "";
      }
      cells.push(decodeXml(value).trim());
    }
    if (cells.some((c) => c !== "")) rows.push(cells.join("\t"));
  }
  return rows.join("\n").trim();
}

/** Decode the XML entities we may encounter (single pass, longest first). */
function decodeXml(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Pull the <t> text runs out of sharedStrings.xml (one entry per <si>). */
function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si>([\s\S]*?)<\/si>/gi;
  let m;
  while ((m = siRe.exec(xml))) {
    const texts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((t) => decodeXml(t[1]));
    out.push(texts.join(""));
  }
  return out;
}

/**
 * @param {Buffer|Uint8Array} bytes
 * @param {string} mimeType
 * @param {string} [filename]
 * @returns {string|null} Extracted text, or null when the type is unsupported
 *   or extraction yields nothing.
 */
export function extractAttachmentText(bytes, mimeType, filename = "") {
  if (!bytes || !mimeType) return null;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  const mime = String(mimeType).toLowerCase();

  // Spreadsheet: needs the shared-strings table to resolve text cells, and must
  // cover every worksheet (not just the first).
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return workbookToText(buf);
  }

  const parts = ZIP_TEXT_PARTS[mime];
  if (parts && parts.length) {
    const chunks = [];
    for (const part of parts) {
      const member = readZipEntry(buf, part);
      if (!member) continue;
      const text = xmlToText(member.toString("utf8"));
      if (text) chunks.push(text);
    }
    const joined = chunks.join("\n\n").trim();
    return joined || null;
  }

  // Plain-text-ish formats (and CSV/TSV/MD/JSON we treat as text).
  if (mime.startsWith("text/") || /\.(csv|tsv|md|json|ya?ml|log|xml|html?)$/i.test(filename)) {
    const text = buf.toString("utf8").trim();
    return text || null;
  }

  return null;
}

/**
 * Parse a `data:` URI into its mime type and raw bytes.
 * Returns null for non-data URIs (http URLs must be fetched separately).
 */
export function parseDataUriBytes(uri) {
  if (typeof uri !== "string" || !uri.startsWith("data:")) return null;
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const header = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  const mimeType = header.split(";")[0] || "application/octet-stream";
  const isBase64 = /;base64/i.test(header);
  try {
    const bytes = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { mimeType, bytes };
  } catch {
    return null;
  }
}
