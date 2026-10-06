import { OPENAI_BLOCK, RESPONSES_ITEM } from "../schema/blocks.js";

/**
 * Convert an OpenAI **Responses API** content block into its Chat Completions
 * equivalent.
 *
 * The Responses API and Chat Completions name their attachment blocks
 * differently:
 *
 *   Responses:      { type: "input_file",  file_data | file_url | file_id }
 *   Chat Completions: { type: "file",       file: { filename, file_data } }
 *
 * Clients (VS Code Copilot Chat, Codex, Droid…) send the Responses form. If the
 * block is forwarded unchanged, an Anthropic- or Gemini-backed provider rejects
 * the whole request:
 *
 *   400 Unsupported input[80].content[2] type:'input_file'
 *
 * Normalising here (once) means every downstream translator keeps working: the
 * Claude translator already turns `file` with a PDF data URI into a `document`
 * block, and the Gemini translator already turns it into inlineData/fileData.
 *
 * @param {object} block
 * @returns {object|null} A Chat Completions block, or `null` when the block has
 *   no usable payload (an unusable block must be dropped rather than forwarded,
 *   since forwarding it is exactly what triggers the upstream 400).
 */
export function responsesBlockToChatBlock(block) {
  if (!block || typeof block !== "object") return block ?? null;

  if (block.type === RESPONSES_ITEM.INPUT_TEXT || block.type === RESPONSES_ITEM.OUTPUT_TEXT) {
    return { type: OPENAI_BLOCK.TEXT, text: block.text ?? "" };
  }

  if (block.type === RESPONSES_ITEM.INPUT_IMAGE) {
    const url = block.image_url || block.file_id || block.file_url || "";
    if (!url) return null;
    return { type: OPENAI_BLOCK.IMAGE_URL, image_url: { url, detail: block.detail || "auto" } };
  }

  if (block.type === RESPONSES_ITEM.INPUT_FILE) {
    // Prefer an inline data URI; fall back to a URL the provider can fetch.
    const data = block.file_data || block.file_url || null;
    if (!data) return null; // e.g. only a file_id, which cannot be resolved here

    const filename = block.filename || deriveFilename(data) || "attachment";
    return {
      type: OPENAI_BLOCK.FILE,
      file: { filename, file_data: data },
    };
  }

  // Already a Chat Completions block (or unknown but structured) — leave as-is.
  return block;
}

/** Best-effort filename from a data URI mime ("data:application/pdf;base64,…"). */
function deriveFilename(data) {
  if (typeof data !== "string") return null;
  const mime = data.match(/^data:([^;,]+)/)?.[1];
  if (!mime) return null;
  const ext = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "application/json": "json",
    "image/png": "png",
    "image/jpeg": "jpg",
  }[mime];
  return ext ? `attachment.${ext}` : null;
}
