# Mirai — Agent Skills

Drop-in skills for any AI agent (Claude, Cursor, ChatGPT, custom SDK). Just **copy a link** below and paste it to your AI — it will fetch the skill and use Mirai for you.

> Tip: start with the **mirai** entry skill — it covers setup and links to all capability skills.

## Skills

| Capability | Copy link below and paste to your AI |
|---|---|
| **Entry / Setup** (start here) | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai/SKILL.md |
| Chat / code-gen | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-chat/SKILL.md |
| Image generation | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-image/SKILL.md |
| Video generation (xAI Grok Imagine) | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-video/SKILL.md |
| Text-to-speech | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-tts/SKILL.md |
| Speech-to-text | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-stt/SKILL.md |
| Embeddings | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-embeddings/SKILL.md |
| Web search | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-web-search/SKILL.md |
| Web fetch (URL → markdown) | https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai-web-fetch/SKILL.md |

## How to use

Paste to your AI (Claude, Cursor, ChatGPT, …):

```
Read this skill and use it: https://raw.githubusercontent.com/decolua/mirai/refs/heads/master/skills/mirai/SKILL.md
```

Then ask normally — *"generate an image of a cat"*, *"transcribe this URL"*, etc.

## Configure your shell once

```bash
export MIRAI_URL="http://localhost:1463"   # local default, or your VPS / tunnel URL
export MIRAI_KEY="sk-..."                   # from Dashboard → Keys (only if requireApiKey=true)
```

Verify: `curl $MIRAI_URL/api/health` → `{"ok":true}`.

## Links

- Source: https://github.com/decolua/mirai
- Dashboard: https://mirai.local
