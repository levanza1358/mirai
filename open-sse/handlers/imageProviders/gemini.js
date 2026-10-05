// Google Gemini adapter (Nano Banana models)
import { nowSec } from "./_base.js";
import { PROVIDER_MEDIA } from "../../providers/index.js";

const BASE_URL = PROVIDER_MEDIA["gemini"]?.imageConfig?.baseUrl;

// Turn a client-supplied image reference (data URL, raw base64, or http URL)
// into a Gemini inline_data part so the model can edit/continue from it.
function toInlineData(image) {
  if (!image || typeof image !== "string") return null;

  const dataUrl = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrl) return { mimeType: dataUrl[1], data: dataUrl[2] };

  // bare base64 (no data: prefix)
  if (/^[A-Za-z0-9+/=\s]+$/.test(image) && image.replace(/\s/g, "").length >= 40) {
    return { mimeType: "image/png", data: image.replace(/\s/g, "") };
  }

  // remote URL → let Gemini fetch it directly
  if (/^https?:\/\//.test(image)) {
    return { fileData: { mimeType: "image/png", fileUri: image } };
  }

  return null;
}

export default {
  buildUrl: (model, creds) => {
    const apiKey = creds?.apiKey || creds?.accessToken;
    const modelId = model.replace(/^models\//, "");
    return `${BASE_URL}/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
  },
  buildHeaders: () => ({ "Content-Type": "application/json" }),
  buildBody: (_model, body) => {
    const parts = [{ text: body.prompt }];
    const inline = toInlineData(body.image);
    if (inline?.fileData) parts.push({ fileData: inline.fileData });
    else if (inline) parts.push({ inlineData: inline });
    return {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };
  },
  normalize: (responseBody, prompt) => {
    const parts = responseBody.candidates?.[0]?.content?.parts || [];
    const images = parts.filter((p) => p.inlineData?.data).map((p) => ({ b64_json: p.inlineData.data }));
    return {
      created: nowSec(),
      data: images.length > 0 ? images : [{ b64_json: "", revised_prompt: prompt }],
    };
  },
};
