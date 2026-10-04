---
name: mirai
description: Entry point for Mirai — local/remote AI gateway with OpenAI-compatible REST for chat, image, TTS, embeddings, web search, web fetch. Use when the user mentions Mirai, MIRAI_URL, or wants AI without writing provider boilerplate. This skill covers setup + indexes capability skills; fetch the relevant capability SKILL.md from the URLs below when needed.
---

# Mirai

Local/remote AI gateway exposing OpenAI-compatible REST. One key, many providers, auto-fallback.

## Setup

```bash
export MIRAI_URL="http://localhost:1463"      # or VPS / tunnel URL
export MIRAI_KEY="sk-..."                      # from Dashboard → Keys (only if requireApiKey=true)
```

All requests: `${MIRAI_URL}/v1/...` with header `Authorization: Bearer ${MIRAI_KEY}` (omit if auth disabled).

Verify: `curl $MIRAI_URL/api/health` → `{"ok":true}`

## Discover models

```bash
curl $MIRAI_URL/v1/models                  # chat/LLM (default)
curl $MIRAI_URL/v1/models/image            # image-gen
curl $MIRAI_URL/v1/models/tts              # text-to-speech
curl $MIRAI_URL/v1/models/embedding        # embeddings
curl $MIRAI_URL/v1/models/web              # web search + fetch (entries have `kind` field)
curl $MIRAI_URL/v1/models/stt              # speech-to-text
curl $MIRAI_URL/v1/models/image-to-text    # vision
```

Use `data[].id` as `model` field in requests. Combos appear with `owned_by:"combo"`.

Response shape:
```json
{ "object": "list", "data": [
  { "id": "openai/gpt-5", "object": "model", "owned_by": "openai", "created": 1735000000 },
  { "id": "tavily/search", "object": "model", "kind": "webSearch", "owned_by": "tavily", "created": 1735000000 }
]}
```

## Capability skills

When the user needs a specific capability, fetch that skill's `SKILL.md` from its raw URL:

| Capability | Raw URL |
|---|---|
| Chat / code-gen | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-chat/SKILL.md |
| Image generation | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-image/SKILL.md |
| Text-to-speech | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-tts/SKILL.md |
| Speech-to-text | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-stt/SKILL.md |
| Embeddings | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-embeddings/SKILL.md |
| Web search | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-web-search/SKILL.md |
| Web fetch (URL → markdown) | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-web-fetch/SKILL.md |

## Errors

- 401 → set/refresh `MIRAI_KEY` (Dashboard → Keys)
- 400 `Invalid model format` → check `model` exists in `/v1/models/<kind>`
- 503 `All accounts unavailable` → wait `retry-after` or add another provider account
