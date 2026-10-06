// Strip multimodal content blocks a model cannot read, BEFORE translation.
// Driven by getCapabilitiesForModel: vision/audioInput/pdf. Replaces removed
// media with a short text placeholder so messages never become empty.
import { FORMATS } from "../formats.js";
import { extractAttachmentText, parseDataUriBytes } from "./attachments.js";

// Placeholder text inserted where a media block was removed.
// Current turn: explain the active model can't read what the user just sent.
const PLACEHOLDER_CURRENT = {
  vision: "[image omitted: model has no vision support]",
  audioInput: "[audio omitted: model has no audio support]",
  pdf: "[file omitted: model has no document support]",
};
// Earlier turns: neutral (a combo may route to a different model each turn).
const PLACEHOLDER_PREV = {
  vision: "[Previous image omitted from context.]",
  audioInput: "[Previous audio omitted from context.]",
  pdf: "[Previous file omitted from context.]",
};
const ph = (cap, isLast) => (isLast ? PLACEHOLDER_CURRENT : PLACEHOLDER_PREV)[cap];

/**
 * Best-effort: turn an unsupported attachment into a text block we CAN send.
 *
 * A model without document support should still get the file's *contents* when
 * we can read them locally (.docx/.xlsx/.csv/.txt). Dropping the file (or
 * replacing it with a placeholder) silently loses the user's data — the request
 * looks fine but the model answers "no file was attached".
 *
 * @returns {{type:"text", text:string}|null} null when nothing could be read.
 */
function extractFileToTextBlock({ bytes, mimeType, filename }) {
  if (!bytes && !mimeType) return null;
  let text = null;
  try {
    text = extractAttachmentText(bytes, mimeType, filename);
  } catch {
    return null;
  }
  if (!text) return null;
  const label = filename || "attachment";
  return { type: "text", text: `<attachment filename="${label}">\n${text}\n</attachment>` };
}

/** Resolve an OpenAI `file` block's payload into bytes + mime. */
function openAIFilePayload(block) {
  const file = block?.file || {};
  const raw = file.file_data || file.file_url || "";
  const parsed = parseDataUriBytes(raw);
  return {
    bytes: parsed?.bytes ?? null,
    mimeType: parsed?.mimeType ?? null,
    filename: file.filename || "",
  };
}

/** True when a mime is one we can turn into text locally. */
function isConvertibleMime(mime) {
  if (typeof mime !== "string" || !mime) return false;
  const m = mime.toLowerCase();
  return (
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    m.startsWith("text/")
  );
}

/**
 * Detect an attachment we should convert to text regardless of model support.
 * Walks every block shape so the check is cheap and provider-independent.
 */
function hasConvertibleAttachment(body, sourceFormat) {
  const checkOpenAIBlocks = (content) => {
    if (!Array.isArray(content)) return false;
    return content.some((b) => {
      if (b?.type === "file") return isConvertibleMime(openAIFilePayload(b).mimeType);
      return false;
    });
  };
  const checkResponsesBlocks = (content) => {
    if (!Array.isArray(content)) return false;
    return content.some((b) => {
      if (b?.type !== "input_file") return false;
      const parsed = parseDataUriBytes(b.file_data || b.file_url || "");
      return isConvertibleMime(parsed?.mimeType);
    });
  };
  const checkGeminiParts = (contents) => {
    if (!Array.isArray(contents)) return false;
    return contents.some(
      (c) =>
        Array.isArray(c?.parts) &&
        c.parts.some((p) =>
          isConvertibleMime(p?.inlineData?.mimeType || p?.inlineData?.mime_type || p?.fileData?.mimeType || p?.fileData?.mime_type)
        )
    );
  };

  try {
    switch (sourceFormat) {
      case FORMATS.OPENAI:
      case FORMATS.OLLAMA:
      case FORMATS.KIRO:
      case FORMATS.CURSOR:
      case FORMATS.COMMANDCODE:
      case FORMATS.CLAUDE: {
        if (!Array.isArray(body.messages)) return false;
        return body.messages.some((m) => {
          if (!Array.isArray(m?.content)) return false;
          if (checkOpenAIBlocks(m.content)) return true;
          // Claude `document` block carrying a convertible mime.
          return m.content.some((b) => b?.type === "document" && isConvertibleMime(b?.source?.media_type));
        });
      }
      case FORMATS.OPENAI_RESPONSES:
      case FORMATS.OPENAI_RESPONSE:
      case FORMATS.CODEX:
        return Array.isArray(body.input) && body.input.some((it) => checkResponsesBlocks(it?.content));
      case FORMATS.GEMINI:
      case FORMATS.GEMINI_CLI:
      case FORMATS.VERTEX:
        return checkGeminiParts(body.contents);
      case FORMATS.ANTIGRAVITY:
        return checkGeminiParts(body?.request?.contents);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// Map gemini inlineData/fileData mime prefix -> capability it requires.
// Note: only PDF counts as a native "document"; OOXML must be extracted to text
// (see extractFileToTextBlock) because Gemini reject .docx/.xlsx as inlineData.
function capForMime(mime) {
  if (typeof mime !== "string") return null;
  if (mime.startsWith("image/")) return "vision";
  if (mime.startsWith("audio/")) return "audioInput";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "videoInput";
  return null;
}

// OpenAI chat content block -> required capability (null = plain text/other, keep).
function capForOpenAIBlock(block) {
  const t = block?.type;
  if (t === "image_url" || t === "image") return "vision";
  if (t === "input_audio" || t === "audio_url") return "audioInput";
  if (t === "file") return "pdf";
  return null;
}

// Claude content block -> required capability.
function capForClaudeBlock(block) {
  const t = block?.type;
  if (t === "image") return "vision";
  if (t === "document") return "pdf";
  return null;
}

// Filter an array of content blocks; drop unsupported, inject one placeholder per kind.
// isLast = block belongs to the current user turn (picks the explanatory placeholder).
// `toText` (optional) converts an unsupported block into a text block we can send —
// used for documents so the model still receives the file's contents.
// `placeholderType` names the text block shape for the format in play
// ("text" for chat/messages, "input_text" for the Responses API).
function filterBlocks(blocks, capOf, caps, removed, isLast, toText = null, placeholderType = "text") {
  const out = [];
  for (const block of blocks) {
    const cap = capOf(block);
    if (cap && caps[cap] === false) {
      const replacement = toText ? toText(block) : null;
      if (replacement) {
        out.push(replacement);
        continue;
      }
      removed.add(cap);
      continue;
    }
    out.push(block);
  }
  for (const cap of removed) out.push({ type: placeholderType, text: ph(cap, isLast) });
  return out;
}

// OpenAI / OpenAI-compatible chat messages[].content[].
function stripOpenAI(body, caps) {
  if (!Array.isArray(body.messages)) return;
  const last = body.messages.length - 1;
  body.messages.forEach((msg, i) => {
    if (caps.vision === false) {
      if (Array.isArray(msg.images)) delete msg.images;
      if (Array.isArray(msg.experimental_attachments)) {
        msg.experimental_attachments = msg.experimental_attachments.filter(
          (a) => !(a?.contentType?.startsWith("image/") || (typeof a?.url === "string" && a.url.startsWith("data:image/")))
        );
      }
      if (Array.isArray(msg.attachments)) {
        msg.attachments = msg.attachments.filter(
          (a) => !(a?.contentType?.startsWith("image/") || (typeof a?.url === "string" && a.url.startsWith("data:image/")))
        );
      }
    }
    if (!Array.isArray(msg.content)) return;
    const removed = new Set();
    msg.content = filterBlocks(msg.content, capForOpenAIBlock, caps, removed, i === last, (block) => {
      // A document the model can't read natively: send its extracted text instead
      // of dropping it, so the request is not silently stripped of the attachment.
      if (block?.type !== "file") return null;
      return extractFileToTextBlock(openAIFilePayload(block));
    });
  });
}

// Claude messages[].content[].
function stripClaude(body, caps) {
  if (!Array.isArray(body.messages)) return;
  const last = body.messages.length - 1;
  body.messages.forEach((msg, i) => {
    if (!Array.isArray(msg.content)) return;
    const removed = new Set();
    msg.content = filterBlocks(msg.content, capForClaudeBlock, caps, removed, i === last, (block) => {
      // Claude `document` block -> send the extracted text instead of dropping it.
      if (block?.type !== "document") return null;
      const source = block.source || {};
      let bytes = null;
      let mimeType = source.media_type || null;
      if (source.type === "base64" && typeof source.data === "string") {
        try {
          bytes = Buffer.from(source.data, "base64");
        } catch {
          bytes = null;
        }
      }
      if (!bytes && source.type !== "url") return null;
      return extractFileToTextBlock({ bytes, mimeType, filename: block.title || "" });
    });
  });
}

// OpenAI Responses input[].content[] (input_image / input_file).
function stripResponses(body, caps) {
  if (!Array.isArray(body.input)) return;
  const last = body.input.length - 1;
  body.input.forEach((item, i) => {
    if (!Array.isArray(item.content)) return;
    const removed = new Set();
    item.content = filterBlocks(
      item.content,
      (b) => (b?.type === "input_image" ? "vision" : b?.type === "input_file" ? "pdf" : null),
      caps,
      removed,
      i === last,
      (block) => {
        // Responses attachment -> text block (responses shape, so `input_text`).
        if (block?.type !== "input_file") return null;
        const parsed = parseDataUriBytes(block.file_data || block.file_url || "");
        const replacement = extractFileToTextBlock({
          bytes: parsed?.bytes ?? null,
          mimeType: parsed?.mimeType ?? null,
          filename: block.filename || "",
        });
        if (!replacement) return null;
        return { type: "input_text", text: replacement.text };
      },
      "input_text"
    );
  });
}

// Gemini / gemini-cli contents[].parts[] (inlineData / fileData by mime).
function stripGeminiParts(contents, caps) {
  if (!Array.isArray(contents)) return;
  const last = contents.length - 1;
  contents.forEach((c, i) => {
    if (!Array.isArray(c.parts)) return;
    const out = [];
    const removed = new Set();
    for (const p of c.parts) {
      // Gemini's REST API uses `mimeType`; Mirai's OpenAI->Gemini translator
      // emits `mime_type`. Accept both, otherwise the mime is unseen and the
      // part is neither inspected nor converted.
      const mime = p?.inlineData?.mimeType || p?.inlineData?.mime_type || p?.fileData?.mimeType || p?.fileData?.mime_type;
      const data = p?.inlineData?.data;
      // Any non-text part may need to become text.
      const isMedia = !!mime;
      const cap = capForMime(mime);
      const unsupported = cap && caps[cap] === false;

      if (isMedia && !unsupported) {
        // Still extract OOXML: Gemini accepts PDFs/images but not .docx/.xlsx.
        if (mime && !mime.startsWith("image/") && !mime.startsWith("audio/") && mime !== "application/pdf") {
          const replacement = extractFileToTextBlock({
            bytes: data ? Buffer.from(data, "base64") : null,
            mimeType: mime,
            filename: p?.fileData?.fileUri || "",
          });
          if (replacement) {
            out.push({ text: replacement.text });
            continue;
          }
        }
        out.push(p);
        continue;
      }

      if (unsupported) {
        const replacement = extractFileToTextBlock({
          bytes: data ? Buffer.from(data, "base64") : null,
          mimeType: mime,
          filename: p?.fileData?.fileUri || "",
        });
        if (replacement) {
          out.push({ text: replacement.text });
          continue;
        }
        removed.add(cap);
        continue;
      }

      out.push(p);
    }
    c.parts = out;
    for (const cap of removed) c.parts.push({ text: ph(cap, i === last) });
  });
}

/**
 * Remove media blocks the model can't read, in-place on the source-format body.
 * @param {object} body - request body (source format)
 * @param {string} sourceFormat - one of FORMATS
 * @param {object} caps - capabilities from getCapabilitiesForModel
 * @returns {boolean} true if anything was stripped-eligible (cap false for some modality)
 */
export function stripUnsupportedModalities(body, sourceFormat, caps) {
  if (!body || !caps) return false;

  // Documents this pipeline can convert to text are ALWAYS worth processing,
  // even on a fully multimodal model: providers reject OOXML as native input
  // (.docx/.xlsx are not valid PDF/image/audio parts), so the conversion is the
  // only way the model ever sees the contents.
  if (hasConvertibleAttachment(body, sourceFormat)) {
    // fall through to the per-format strippers below
  } else if (caps.vision !== false && caps.audioInput !== false && caps.pdf !== false && caps.videoInput !== false) {
    // Fast exit: model supports everything we'd strip.
    return false;
  }

  switch (sourceFormat) {
    case FORMATS.OPENAI:
    case FORMATS.OLLAMA:
    case FORMATS.KIRO:
    case FORMATS.CURSOR:
    case FORMATS.COMMANDCODE:
      stripOpenAI(body, caps);
      break;
    case FORMATS.CLAUDE:
      stripClaude(body, caps);
      break;
    case FORMATS.OPENAI_RESPONSES:
    case FORMATS.OPENAI_RESPONSE:
    case FORMATS.CODEX:
      stripResponses(body, caps);
      break;
    case FORMATS.GEMINI:
    case FORMATS.GEMINI_CLI:
    case FORMATS.VERTEX:
      stripGeminiParts(body.contents, caps);
      break;
    case FORMATS.ANTIGRAVITY:
      stripGeminiParts(body?.request?.contents, caps);
      break;
    default:
      stripOpenAI(body, caps);
  }
  return true;
}
