import { inflateRawSync } from "node:zlib";
import path from "node:path";

// pdf-parse is async (backed by pdfjs-dist), so PDF text extraction lives in
// a separate async function (extractPDFText). The synchronous extractAttachmentText
// handles OOXML / plain-text formats only.
let PDFParseCtor = null;
async function loadPDFParse() {
  if (PDFParseCtor) return PDFParseCtor;
  // Lazy import so the dependency is only loaded when a PDF is actually
  // encountered — keeps cold-start fast for providers that never see one.
  const mod = await import("pdf-parse");
  PDFParseCtor = mod.PDFParse;
  return PDFParseCtor;
}

// Point pdfjs-dist at its real worker module. Inside a Next.js/Turbopack
// bundle pdfjs cannot resolve its default fake-worker target ("./pdf.worker.mjs"
// relative to the compiled chunk) and aborts with "Setting up fake worker
// failed: Cannot find module …pdf.worker.mjs".
//
// pdfjs checks `globalThis.pdfjsWorker.WorkerMessageHandler` BEFORE attempting
// the dynamic import of workerSrc, so we import the worker file ourselves (via
// an absolute file:// URL found on the real filesystem) and install it there.
// require.resolve must NOT be used to find the file: bundlers rewrite literal
// resolve calls at build time into virtual module ids that cannot be loaded.
let workerConfigured = false;
async function ensureWorker() {
  if (workerConfigured) return;
  workerConfigured = true;
  const dbg = async (msg) => {
    try {
      const { appendFileSync } = await import("node:fs");
      appendFileSync("pdf-debug.log", `[${new Date().toISOString()}] ensureWorker: ${msg}\n`);
    } catch {}
  };
  try {
    if (globalThis.pdfjsWorker?.WorkerMessageHandler) {
      await dbg("pdfjsWorker already installed");
      return;
    }
    const workerPath = await findWorkerFile();
    if (!workerPath) {
      await dbg("worker file not found on disk");
      return;
    }
    const { pathToFileURL } = await import("node:url");
    const workerUrl = pathToFileURL(workerPath).href;
    // Both `import(workerUrl)` and `require.resolve(literal)` are intercepted by
    // the bundler (Turbopack rewrites the former into a runtime error —
    // "expression is too dynamic" — and the latter into a virtual module id).
    // createRequire is constructed at runtime, so calls through it stay native
    // Node; Node 24 supports require() of ESM, so the .mjs worker loads fine.
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const workerModule = require(workerPath);
    if (workerModule?.WorkerMessageHandler) {
      // Installing on globalThis short-circuits pdfjs's fake-worker loader:
      // PDFWorker.#mainThreadWorkerMessageHandler returns this handler and the
      // broken relative import never runs.
      globalThis.pdfjsWorker = workerModule;
      await dbg(`pdfjsWorker installed from ${workerUrl}`);
    } else {
      await dbg(`worker module has no WorkerMessageHandler (${workerUrl})`);
    }
  } catch (e) {
    await dbg(`FAILED: ${e?.stack || e?.message || e}`);
    console.warn(`[MODALITY] pdfjs worker config failed: ${e?.message || e}`);
  }
}

// Walk up from the compiled module's directory and from cwd looking for
// node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs.
async function findWorkerFile() {
  const { existsSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const rel = path.join("node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
  const bases = [];
  try { bases.push(process.cwd()); } catch {}
  try {
    let dir = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 10; i++) {
      bases.push(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {}
  for (const base of bases) {
    try {
      const candidate = path.join(base, rel);
      if (existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
}

/**
 * Extract plain text from a PDF buffer (async — pdf-parse / pdfjs-dist is
 * async-only). Returns null on any failure so callers can fall back to
 * dropping the block or forwarding it natively.
 *
 * @param {Buffer|Uint8Array} bytes
 * @returns {Promise<string|null>}
 */
export async function extractPDFText(bytes) {
  if (!bytes) return null;
  try {
    await ensureWorker();
    const PDFParse = await loadPDFParse();
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    await parser.destroy();
    // pdf-parse decorates output with page markers like "-- 1 of 3 --\n";
    // strip those so the text block reads naturally.
    const text = (result?.text || "")
      .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\s*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text || null;
  } catch (e) {
    // Never silent: a failed extraction forwards the raw PDF block downstream,
    // which OpenAI-compatible gateways (CodeBuddy…) reject with 400. Surface
    // the real cause so the server console shows why extraction fell through.
    console.error(`[MODALITY] PDF text extraction failed: ${e?.message || e}`);
    debugLog(`extractPDFText FAILED: ${e?.stack || e?.message || e}`);
    return null;
  }
}

// TEMP diagnostics: append extraction events to a project-local file so failures
// inside the Next.js dev server (whose console isn't always visible) can be
// diagnosed. Remove once the PDF path is confirmed stable.
import { appendFileSync } from "node:fs";
function debugLog(msg) {
  try {
    appendFileSync("pdf-debug.log", `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

/**
 * Extract plain text from an attachment so providers that cannot accept the
 * original mime type still receive its content.
 *
 * `.docx`/`.pptx`/`.xlsx` are ZIP archives, so we read the relevant XML part with
 * the built-in zlib and strip the markup. PDF is handled by the async
 * extractPDFText (pdf-parse / pdfjs-dist is async-only).
 */

// Mime types whose bytes we can turn into text synchronously.
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
  "application/pdf": [], // async — handled by extractPDFText, not here
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
