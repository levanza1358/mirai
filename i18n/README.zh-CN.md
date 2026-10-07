<div align="center">
  
  # Mirai - å…è´¹ AI è·¯ç”±å™¨
  
  **æ°¸ä¸åœæ­‡çš„ç¼–ç¨‹ä½“éªŒã€‚æ™ºèƒ½å›žé€€ï¼Œè‡ªåŠ¨è·¯ç”±åˆ°å…è´¹å’Œå»‰ä»·çš„ AI æ¨¡åž‹ã€‚**
  
  **OpenClaw çš„å…è´¹ AI æä¾›å•†ã€‚**
  
  <p align="center">
    <img src="../public/providers/openclaw.png" alt="OpenClaw" width="80"/>
  </p>
  
  [![npm](https://img.shields.io/npm/v/mirai.svg)](https://www.npmjs.com/package/mirai)
  [![Downloads](https://img.shields.io/npm/dm/mirai.svg)](https://www.npmjs.com/package/mirai)
  [![License](https://img.shields.io/npm/l/mirai.svg)](https://github.com/decolua/mirai/blob/main/LICENSE)
  
  [ðŸš€ å¿«é€Ÿå¼€å§‹](#-quick-start) â€¢ [ðŸ’¡ ç‰¹æ€§](#-key-features) â€¢ [ðŸ“– è®¾ç½®](#-setup) â€¢ [ðŸŒ ç½‘ç«™](https://mirai.local)
</div>

---

## ðŸ¤” ä¸ºä»€ä¹ˆé€‰æ‹© Miraiï¼Ÿ

**åœæ­¢æµªè´¹é‡‘é’±å’Œè§¦ç¢°é™åˆ¶ï¼š**

- âŒ è®¢é˜…é…é¢æ¯æœˆæœªä½¿ç”¨å³è¿‡æœŸ
- âŒ ç¼–ç¨‹ä¸­é€”é­é‡é€ŸçŽ‡é™åˆ¶
- âŒ æ˜‚è´µçš„ APIï¼ˆæ¯ä¸ªæä¾›å•† $20-50/æœˆï¼‰
- âŒ æ‰‹åŠ¨åœ¨æä¾›å•†ä¹‹é—´åˆ‡æ¢

**Mirai è§£å†³æ–¹æ¡ˆï¼š**

- âœ… **æœ€å¤§åŒ–è®¢é˜…ä»·å€¼** - è¿½è¸ªé…é¢ï¼Œåœ¨é‡ç½®å‰ç”¨å°½æ¯ä¸€åˆ†
- âœ… **è‡ªåŠ¨å›žé€€** - è®¢é˜… å»‰ä»· â†’ å…è´¹ï¼Œé›¶åœæœºæ—¶é—´
- âœ… **å¤šè´¦æˆ·** - æ¯ä¸ªæä¾›å•†çš„è´¦æˆ·é—´è½®è¯¢
- âœ… **é€šç”¨æ€§** - é€‚ç”¨äºŽ Claude Code, Codex, Gemini CLI, Cursor, Cline, ä»»ä½• CLI å·¥å…·

---

## ðŸ”„ å·¥ä½œåŽŸç†

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Your CLI   â”‚  (Claude Code, Codex, OpenClaw, Cursor, Cline, Antigravity...)
â”‚   Tool      â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
       â”‚ http://localhost:1463/v1
       â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚           Mirai (Smart Router)            â”‚
â”‚  â€¢ RTK Token Saver (èŠ‚çœ 20-40% Token)      â”‚
â”‚  â€¢ æ ¼å¼è½¬æ¢ (OpenAI â†” Claude)               â”‚
â”‚  â€¢ é…é¢è¿½è¸ª (Quota tracking)                â”‚
â”‚  â€¢ è‡ªåŠ¨åˆ·æ–° OAuth Token                     â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚
       â”œâ”€â†’ [Tier 1: è®¢é˜…] Claude Code, Codex, GitHub Copilot
       â”‚   â†“ é…é¢ç”¨å°½
       â”œâ”€â†’ [Tier 2: ä½Žä»·] GLM ($0.6/1M), MiniMax ($0.2/1M)
       â”‚   â†“ è§¦åŠé¢„ç®—ä¸Šé™
       â””â”€â†’ [Tier 3: å…è´¹] Kiro AI, OpenCode Free, Vertex AI ($300 credits)

ç»“æžœï¼šæ°¸ä¸åœæ­‡çš„ç¼–ç¨‹ä½“éªŒï¼Œæœ€ä½Žæˆæœ¬ + é€šè¿‡ RTK èŠ‚çœ 20-40% Token
```

---

## âš¡ å¿«é€Ÿå¼€å§‹

**1. å…¨å±€å®‰è£…ï¼š**

```bash
npm install -g mirai
mirai
```

ðŸŽ‰ ä»ªè¡¨æ¿å°†åœ¨ `http://localhost:1463` æ‰“å¼€

**2. è¿žæŽ¥å…è´¹æä¾›å•†ï¼ˆæ— éœ€æ³¨å†Œï¼‰ï¼š**

ä»ªè¡¨æ¿ â†’ æä¾›å•† â†’ è¿žæŽ¥ **Claude Code** æˆ– **Antigr** â†’ OAuth ç™»å½• â†’ å®Œæˆï¼

**3. åœ¨æ‚¨çš„ CLI å·¥å…·ä¸­ä½¿ç”¨ï¼š**

```
Claude Code/Codex/Gemini CLI/OpenClaw/Cursor/Cline è®¾ç½®:
  Endpoint: http://localhost:1463/v1
  API Key: [ä»Žä»ªè¡¨æ¿å¤åˆ¶]
  Model: if/kimi-k2-thinking
```

**å°±æ˜¯è¿™æ ·ï¼** å¼€å§‹ä½¿ç”¨å…è´¹ AI æ¨¡åž‹ç¼–ç¨‹ã€‚

**æ›¿ä»£æ–¹æ¡ˆï¼šä»Žæºç è¿è¡Œï¼ˆæ­¤ä»“åº“ï¼‰ï¼š**

æ­¤ä»“åº“åŒ…æ˜¯ç§æœ‰çš„ï¼ˆ`mirai-app`ï¼‰ï¼Œå› æ­¤æºç /Docker æ‰§è¡Œæ˜¯é¢„æœŸçš„æœ¬åœ°å¼€å‘è·¯å¾„ã€‚

```bash
cp .env.example .env
npm install
PORT=1463 NEXT_PUBLIC_BASE_URL=http://localhost:1463 npm run dev
```

ç”Ÿäº§æ¨¡å¼ï¼š

```bash
npm run build
PORT=1463 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:1463 npm run start
```

é»˜è®¤ URLï¼š
- ä»ªè¡¨æ¿ï¼š`http://localhost:1463/dashboard`
- OpenAI å…¼å®¹ APIï¼š`http://localhost:1463/v1`

### Changing the server port

Mirai by default runs on **`localhost:1463`**. You can change the port from the dashboard or the CLI, but only after Mirai **tests** that the port is free:

- **Dashboard:** open **Settings -> Server Port**, enter a port, click **Test**, then click **Apply & Restart** only when the test passes. Mirai saves the port, restarts, and serves on the new port. If the port is in use (or reserved), the change is refused.
- **CLI:** `mirai restart` (current port) or `mirai restart --port 8080` (specific port).

The port is persisted to `<dataDir>/config/port.json` and reused on the next start. Resolution order:

1. `PORT` environment variable
2. `<dataDir>/config/port.json`
3. Default `1463`

> Port `20129` is reserved for Mirai's internal use and cannot be used.

**Launcher shortcuts (source checkout):** the repo ships `mirai.cmd` (Windows) and `mirai` (bash):

```bash
.\mirai start      # Windows cmd
.\mirai restart
./mirai start      # bash / macOS / Linux
```

---

## ðŸŽ¥ è§†é¢‘æ•™ç¨‹

<div align="center">
  
### ðŸ“ºå®Œæ•´è®¾ç½®æŒ‡å— - Mirai + Claude Code å…è´¹
  
[![Mirai + Claude Code Setup](https://img.youtube.com/vi/raEyZPg5xE0/maxresdefault.jpg)](https://www.youtube.com/watch?v=raEyZPg5xE0)

**ðŸŽ¬ è§‚çœ‹å®Œæ•´çš„åˆ†æ­¥æ•™ç¨‹ï¼š**
- âœ… Mirai å®‰è£…ä¸Žè®¾ç½®
- âœ… å…è´¹ Claude Sonnet 4.5 é…ç½®
- âœ… Claude Code é›†æˆ
- âœ… å®žæ—¶ç¼–ç¨‹æ¼”ç¤º

**â±ï¸ æ—¶é•¿ï¼š** 20 åˆ†é’Ÿ | **ðŸ‘¥ ä½œè€…** å¼€å‘è€…ç¤¾åŒº

[â–¶ï¸ åœ¨ YouTube ä¸Šè§‚çœ‹](https://www.youtube.com/watch?v=o3qYCyjrFYg)

</div>

---

## ðŸ› ï¸ æ”¯æŒçš„ CLI å·¥å…·

Mirai ä¸Žæ‰€æœ‰ä¸»æµ AI ç¼–ç¨‹å·¥å…·æ— ç¼åä½œï¼š

<div align="center">
  <table>
    <tr>
      <td align="center" width="120">
        <img src="../public/providers/claude.png" width="60" alt="Claude Code"/><br/>
        <b>Claude-Code</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/openclaw.png" width="60" alt="OpenClaw"/><br/>
        <b>OpenClaw</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/codex.png" width="60" alt="Codex"/><br/>
        <b>Codex</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/opencode.png" width="60" alt="OpenCode"/><br/>
        <b>OpenCode</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/cursor.png" width="60" alt="Cursor"/><br/>
        <b>Cursor</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/antigravity.png" width="60" alt="Antigravity"/><br/>
        <b>Antigravity</b>
      </td>
    </tr>
    <tr>
      <td align="center" width="120">
        <img src="../public/providers/cline.png" width="60" alt="Cline"/><br/>
        <b>Cline</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/continue.png" width="60" alt="Continue"/><br/>
        <b>Continue</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/droid.png" width="60" alt="Droid"/><br/>
        <b>Droid</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/roo.png" width="60" alt="Roo"/><br/>
        <b>Roo</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/copilot.png" width="60" alt="Copilot"/><br/>
        <b>Copilot</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/kilocode.png" width="60" alt="Kilo Code"/><br/>
        <b>Kilo Code</b>
      </td>
    </tr>
  </table>
</div>

---

## ðŸŒ æ”¯æŒçš„æä¾›å•†

### ðŸ” OAuth æä¾›å•†

<div align="center">
  <table>
    <tr>
      <td align="center" width="120">
        <img src="../public/providers/claude.png" width="60" alt="Claude Code"/><br/>
        <b>Claude-Code</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/antigravity.png" width="60" alt="Antigravity"/><br/>
        <b>Antigravity</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/codex.png" width="60" alt="Codex"/><br/>
        <b>Codex</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/github.png" width="60" alt="GitHub"/><br/>
        <b>GitHub</b>
      </td>
      <td align="center" width="120">
        <img src="../public/providers/cursor.png" width="60" alt="Cursor"/><br/>
        <b>Cursor</b>
      </td>
    </tr>
  </table>
</div>

### ðŸ†“ å…è´¹æä¾›å•†

<div align="center">
  <table>
    <tr>
      <td align="center" width="150">
        <img src="../public/providers/iflow.png" width="70" alt="iFlow"/><br/>
        <b>iFlow AI</b><br/>
        <sub>8+ æ¨¡åž‹ æ— é™åˆ¶</sub>
      </td>
      <td align="center" width="150">
        <img src="../public/providers/qwen.png" width="70" alt="Qwen"/><br/>
        <b>Qwen Code</b><br/>
        <sub>3+ æ¨¡åž‹ â€¢ æ— é™åˆ¶</sub>
      </td>
      <td align="center" width="150">
        <img src="../public/providers/gemini-cli.png" width="70" alt="Gemini CLI"/><br/>
        <b>Gemini CLI</b><br/>
        <sub>180K/æœˆ å…è´¹</sub>
      </td>
      <td align="center" width="150">
        <img src="../public/providers/kiro.png" width="70" alt="Kiro"/><br/>
        <b>Kiro AI</b><br/>
        <sub>Claude â€¢ æ— é™åˆ¶</sub>
      </td>
    </tr>
  </table>
</div>

### ðŸ”‘ API Key æä¾›å•† (40+)

<div align="center">
  <table>
    <tr>
      <td align="center" width="100">
        <img src="../public/providers/openrouter.png" width="50" alt="OpenRouter"/><br/>
        <sub>OpenRouter</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/glm.png" width="50" alt="GLM"/><br/>
        <sub>GLM</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/kimi.png" width="50" alt="Kimi"/><br/>
        <sub>Kimi</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/minimax.png" width="50" alt="MiniMax"/><br/>
        <sub>MiniMax</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/openai.png" width="50" alt="OpenAI"/><br/>
        <sub>OpenAI</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/anthropic.png" width="50" alt="Anthropic"/><br/>
        <sub>Anthropic</sub>
      </td>
    </tr>
    <tr>
      <td align="center" width="100">
        <img src="../public/providers/gemini.png" width="50" alt="Gemini"/><br/>
        <sub>Gemini</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/deepseek.png" width="50" alt="DeepSeek"/><br/>
        <sub>DeepSeek</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/groq.png" width="50" alt="Groq"/><br/>
        <sub>Groq</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/xai.png" width="50" alt="xAI"/><br/>
        <sub>xAI</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/mistral.png" width="50" alt="Mistral"/><br/>
        <sub>Mistral</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/perplexity.png" width="50" alt="Perplexity"/><br/>
        <sub>Perplexity</sub>
      </td>
    </tr>
    <tr>
      <td align="center" width="100">
        <img src="../public/providers/together.png" width="50" alt="Together"/><br/>
        <sub>Together AI</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/fireworks.png" width="50" alt="Fireworks"/><br/>
        <sub>Fireworks</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/cerebras.png" width="50" alt="Cerebras"/><br/>
        <sub>Cerebras</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/cohere.png" width="50" alt="Cohere"/><br/>
        <sub>Cohere</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/nvidia.png" width="50" alt="NVIDIA"/><br/>
        <sub>NVIDIA</sub>
      </td>
      <td align="center" width="100">
        <img src="../public/providers/siliconflow.png" width="50" alt="SiliconFlow"/><br/>
        <sub>SiliconFlow</sub>
      </td>
    </tr>
  </table>
  <p><i>...ä»¥åŠ 20+ æ›´å¤šæä¾›å•†ï¼ŒåŒ…æ‹¬ Nebius, Chutes, Hyperbolic å’Œè‡ªå®šä¹‰ OpenAI/Anthropic å…¼å®¹ç«¯ç‚¹</i></p>
</div>

---

## ðŸ’¡ æ ¸å¿ƒç‰¹æ€§

| ç‰¹æ€§ | åŠŸèƒ½ | é‡è¦æ€§ |
|---------|--------------|----------------|
|  **æ™ºèƒ½ 3 å±‚å›žé€€** | è‡ªåŠ¨è·¯ç”±ï¼šè®¢é˜… â†’ å»‰ä»· â†’ å…è´¹ | æ°¸ä¸åœæ­¢ç¼–ç¨‹ï¼Œé›¶åœæœºæ—¶é—´ |
| ðŸ“Š **å®žæ—¶é…é¢è¿½è¸ª** | å®žæ—¶ Token è®¡æ•° + é‡ç½®å€’è®¡æ—¶ | æœ€å¤§åŒ–è®¢é˜…ä»·å€¼ |
| ðŸ”„ **æ ¼å¼è½¬æ¢** | OpenAI â†” Claude â†” Gemini æ— ç¼è½¬æ¢ | é€‚ç”¨äºŽä»»ä½• CLI å·¥å…· |
| ðŸ‘¥ **å¤šè´¦æˆ·æ”¯æŒ** | æ¯ä¸ªæä¾›å•†å¤šä¸ªè´¦æˆ· | è´Ÿè½½å‡è¡¡ + å†—ä½™ |
| ðŸ”„ **è‡ªåŠ¨ Token åˆ·æ–°** | OAuth token è‡ªåŠ¨åˆ·æ–° |éœ€æ‰‹åŠ¨é‡æ–°ç™»å½• |
| ðŸŽ¨ **è‡ªå®šä¹‰ç»„åˆ** | åˆ›å»ºæ— é™æ¨¡åž‹ç»„åˆ | æ ¹æ®éœ€æ±‚å®šåˆ¶å›žé€€ç­–ç•¥ |
| ðŸ“ **è¯·æ±‚æ—¥å¿—** | è°ƒè¯•æ¨¡å¼åŒ…å«å®Œæ•´è¯·æ±‚/å“åº”æ—¥å¿— | è½»æ¾æŽ’æŸ¥é—®é¢˜ |
| ðŸ’¾ **äº‘ç«¯åŒæ­¥** | è·¨è®¾å¤‡åŒæ­¥é…ç½® | åˆ°å¤„éƒ½æ˜¯ç›¸åŒçš„è®¾ç½® |
| ðŸ“Š **ä½¿ç”¨åˆ†æž** | è¿½è¸ª Tokenã€æˆæœ¬ã€è¶‹åŠ¿ | ä¼˜åŒ–æ”¯å‡º |
| ðŸŒ **éšå¤„éƒ¨ç½²** | æœ¬åœ°ä¸»æœºã€VPSã€Dockerã€Cloudflare Workers | çµæ´»çš„éƒ¨ç½²é€‰é¡¹ |

<details>
<summary><b>ðŸ“– ç‰¹æ€§è¯¦æƒ…</b></summary>

### ðŸŽ¯ æ™ºèƒ½ 3 å±‚å›žé€€

åˆ›å»ºå…·æœ‰è‡ªåŠ¨å›žé€€åŠŸèƒ½çš„ç»„åˆï¼š

```
Combo: "my-coding-stack"
  1. cc/claude-opus-4-6        (your subscription)
  2. glm/glm-4.7               (cheap backup, $0.6/1M)
  3. if/kimi-k2-thinking       (free fallback)

â†’ Auto switches when quota runs out or errors occur
```

### ðŸ“Š å®žæ—¶é…é¢è¿½è¸ª

- æ¯ä¸ªæä¾›å•†çš„ Token æ¶ˆ
- é‡ç½®å€’è®¡æ—¶ï¼ˆ5 å°æ—¶ã€æ¯æ—¥ã€æ¯å‘¨ï¼‰
- ä»˜è´¹å±‚çš„æˆæœ¬ä¼°ç®—
- æœˆåº¦æ”¯å‡ºæŠ¥å‘Š

### ðŸ”„ æ ¼å¼è½¬æ¢

æ ¼å¼é—´æ— ç¼è½¬æ¢ï¼š
- **OpenAI** â†” **Claude** â†” **Gemini** â†” **OpenAI Responses**
- æ‚¨çš„ CLI å·¥å…·å‘é€ OpenAI æ ¼å¼ â†’ Mirai è½¬æ¢ â†’ æä¾›å•†æŽ¥æ”¶åŽŸç”Ÿæ ¼å¼
- é€‚ç”¨äºŽä»»ä½•æ”¯æŒè‡ªå®šä¹‰ OpenAI ç«¯ç‚¹çš„å·¥å…·

### ðŸ‘¥ å¤šè´¦æˆ·æ”¯æŒ

- æ¯ä¸ªæä¾›å•†æ·»åŠ å¤šä¸ªè´¦æˆ·
- è‡ªåŠ¨è½®è¯¢æˆ–åŸºäºŽä¼˜å…ˆçº§çš„
- å½“ä¸€ä¸ªè´¦æˆ·è¾¾åˆ°é…é¢æ—¶å›žé€€åˆ°ä¸‹ä¸€ä¸ª

### ðŸ”„ è‡ªåŠ¨ Token åˆ·æ–°

- OAuth token åœ¨è¿‡æœŸå‰è‡ªåŠ¨åˆ·æ–°
- æ— éœ€æ‰‹åŠ¨é‡æ–°è®¤è¯
- æ‰€æœ‰æä¾›å•†çš„æ— ç¼ä½“éªŒ

### ðŸŽ¨ è‡ªå®šä¹‰ç»„åˆ

- åˆ›å»ºæ— é™æ¨¡åž‹ç»„åˆ
- æ··åˆè®¢é˜…ã€å»‰ä»·å’Œå…è´¹å±‚
- ä¸ºæ‚¨çš„ç»„åˆå‘½åä»¥ä¾¿è®¿é—®
- é€šè¿‡äº‘ç«¯åŒæ­¥è·¨è®¾å¤‡å…±äº«ç»„åˆ

### ðŸ“ è¯·æ±‚æ—¥å¿—

- å¯ç”¨è°ƒè¯•æ¨¡å¼ä»¥èŽ·å–å®Œæ•´è¯·æ±‚/å“åº”æ—¥å¿—
- è¿½è¸ª API è°ƒç”¨ã€æ ‡å¤´å’Œè´Ÿè½½
- æŽ’æŸ¥é›†æˆ
- å¯¼å‡ºæ—¥å¿—è¿›è¡Œåˆ†æž

### ðŸ’¾ äº‘ç«¯åŒæ­¥

- è·¨è®¾å¤‡åŒæ­¥æä¾›å•†ã€ç»„åˆå’Œè®¾ç½®
- è‡ªåŠ¨åŽå°åŒæ­¥
- å®‰å…¨åŠ å¯†å­˜å‚¨
- ä»Žä»»ä½•åœ°æ–¹è®¿é—®æ‚¨çš„è®¾ç½®

#### äº‘ç«¯è¿è¡Œè¯´æ˜Ž

- åœ¨ç”Ÿäº§çŽ¯å¢ƒä¸­ä¼˜å…ˆä½¿ç”¨æœåŠ¡å™¨ç«¯äº‘å˜é‡ï¼š
  - `BASE_URL`ï¼ˆåŒæ­¥è°ƒåº¦å™¨ä½¿ç”¨çš„å†…éƒ¨å›žè°ƒ URLï¼‰
  - `CLOUD_URL`ï¼ˆäº‘ç«¯åŒæ­¥ç«¯ç‚¹åŸºç¡€ URLï¼‰
- `NEXT_PUBLIC_BASE_URL` å’Œ `NEXT_PUBLIC_CLOUD_URL` ä»æ”¯æŒå…¼å®¹æ€§/UIï¼Œä½†æœåŠ¡å™¨è¿è¡Œæ—¶çŽ°åœ¨ä¼˜å…ˆä½¿ç”¨ `BASE_URL`/`C_URL`ã€‚
- äº‘ç«¯åŒæ­¥è¯·æ±‚çŽ°åœ¨ä½¿ç”¨è¶…æ—¶ + å¿«é€Ÿå¤±è´¥è¡Œä¸ºï¼Œä»¥é¿å…åœ¨äº‘ç«¯ DNS/ç½‘ç»œä¸å¯ç”¨æ—¶ UI æŒ‚èµ·ã€‚

### ðŸ“Š ä½¿ç”¨åˆ†æž

- è¿½è¸ªæ¯ä¸ªæä¾›å•†å’Œæ¨¡åž‹çš„ Token ä½¿ç”¨æƒ…å†µ
- æˆæœ¬ä¼°ç®—å’Œæ”¯å‡ºè¶‹åŠ¿
- æœˆåº¦æŠ¥å‘Šå’Œæ´žå¯Ÿ
- ä¼˜åŒ–æ‚¨çš„ AI æ”¯å‡º

> **ðŸ’¡ é‡è¦ - ç†è§£ä»ªè¡¨æ¿æˆæœ¬ï¼š**
> 
> ä½¿ç”¨åˆ†æžä¸­æ˜¾ç¤ºçš„â€œæˆæœ¬â€**ä»…ç”¨äºŽè¿½è¸ªå’Œæ¯”è¾ƒç›®çš„**ã€‚
> Mirai æœ¬èº«**ä»Žä¸å‘æ‚¨æ”¶è´¹**ã€‚æ‚¨åªéœ€ç›´æŽ¥å‘æä¾›å•†ä»˜æ¬¾ï¼ˆå¦‚æžœä½¿ç”¨ä»˜è´¹æœåŠ¡ï¼‰ã€‚
> 
> **ç¤ºä¾‹ï¼š** å¦‚æžœæ‚¨çš„ä»ªè¡¨æ¿åœ¨ä½¿ç”¨ iFlow æ¨¡åž‹æ—¶æ˜¾ç¤ºâ€œ$290 æ€»æˆæœ¬â€ï¼Œè¿™ä»£è¡¨
> æ‚¨ç›´æŽ¥ä½¿ç”¨ä»˜è´¹ API æ—¶éœ€è¦æ”¯ä»˜çš„é‡‘é¢ã€‚æ‚¨çš„å®žé™…æˆæœ¬ = **$0**ï¼ˆiFlow æ˜¯å…è´¹æ— é™åˆ¶çš„ï¼‰ã€‚
> 
> å°†å…¶è§†ä¸ºâ€œèŠ‚çœè¿½è¸ªå™¨â€ï¼Œæ˜¾ç¤ºæ‚¨é€šè¿‡ä½¿ç”¨å…è´¹æ¨¡åž‹æˆ–
> é€šè¿‡ Mirai è·¯ç”±èŠ‚çœäº†å¤šå°‘ï¼

### ðŸŒ éšå¤„éƒ¨ç½²

- ðŸ’» **æœ¬åœ°ä¸»æœº** - é»˜è®¤ï¼Œç¦»çº¿å·¥ä½œ
- â˜ï¸ **VPS/äº‘** è·¨è®¾å¤‡å…±äº«
- ðŸ³ **Docker** - ä¸€é”®éƒ¨ç½²
- ðŸš€ **Cloudflare Workers** - å…¨çƒè¾¹ç¼˜ç½‘ç»œ

</details>

---

## ðŸ’° å®šä»·ä¸€è§ˆ

| å±‚çº§ | æä¾›å•† | æˆæœ¬ | é…é¢é‡ç½® | æœ€é€‚åˆ |
|------|----------|------|-------------|----------|
| **ðŸ’³ è®¢é˜…** | Claude Code (Pro) | $20/æœˆ | 5h + æ¯å‘¨ | å·²è®¢é˜…ç”¨æˆ· |
| | Codex (Plus/Pro) | $20-200/æœˆ | 5h + æ¯å‘¨ OpenAI ç”¨æˆ· |
| | Gemini CLI | **å…è´¹** | 180K/æœˆ + 1K/å¤© | æ‰€æœ‰äººï¼ |
| | GitHub Copilot | $10-19/æœˆ | æ¯æœˆ | GitHub ç”¨æˆ· |
| **ðŸ’° å»‰ä»·** | GLM-4.7 | $0.6/1M | æ¯æ—¥ 10AM | é¢„ç®—å¤‡ä»½ |
| | MiniMax M2.1 | $0.2/1M | 5 å°æ—¶æ»šåŠ¨ | æœ€ä¾¿å®œé€‰é¡¹ |
| | Kimi K2 | $9/æœˆå›ºå®š | 10M tokens/æœˆ | å¯é¢„æµ‹æˆæœ¬ |
| **ðŸ†“ å…è´¹** | iFlow | $0 | æ— é™åˆ¶ | 8 ä¸ªæ¨¡åž‹å…è´¹ |
| | Qwen | $0 | æ— é™åˆ¶ | 3 ä¸ªæ¨¡åž‹å…è´¹ |
| | Kiro | $0 | æ— é™åˆ¶ | Claude å…è´¹ |

**ðŸ’¡ ä¸“ä¸šæç¤ºï¼š** ä»Ž Gemini CLIï¼ˆ180K å…è´¹/æœˆï¼‰+ iFlowï¼ˆæ— é™åˆ¶å…è´¹ï¼‰ç»„åˆå¼€å§‹ = $0 æˆæœ¬ï¼

---

### ðŸ“Š ç†è§£ Mirai æˆæœ¬å’Œè®¡è´¹

**Mirai è®¡è´¹çŽ°å®žï¼š**

âœ… **Mirai è½¯ä»¶ = æ°¸è¿œå…è´¹**å¼€æºï¼Œä»Žä¸æ”¶è´¹ï¼‰  
âœ… **ä»ªè¡¨æ¿â€œæˆæœ¬â€ = ä»…æ˜¾ç¤º/è¿½è¸ª**ï¼ˆéžå®žé™…è´¦å•ï¼‰  
âœ… **æ‚¨ç›´æŽ¥å‘æä¾›å•†ä»˜æ¬¾**ï¼ˆè®¢é˜…æˆ– API è´¹ç”¨ï¼‰  
âœ… **å…è´¹æä¾›å•†ä¿æŒå…è´¹**ï¼ˆiFlow, Kiro, Qwen = $0 æ— é™åˆ¶ï¼‰  
âŒ **Mirai ä»Žä¸å‘é€å‘ç¥¨**æˆ–å‘æ‚¨çš„å¡æ”¶è´¹

**æˆæœ¬æ˜¾ç¤ºå¦‚ä½•å·¥ä½œï¼š**

ä»ªè¡¨æ¿æ˜¾ç¤º**ä¼°ç®—æˆæœ¬**ï¼Œå°±åƒæ‚¨ç›´æŽ¥ä½¿ç”¨ä»˜è´¹ API ä¸€æ ·ã€‚è¿™**ä¸æ˜¯è®¡è´¹** - å®ƒæ˜¯ä¸€ä¸ªæ¯”è¾ƒå·¥å…·ï¼Œç”¨äºŽæ˜¾ç¤ºæ‚¨çš„èŠ‚çœã€‚

**ç¤ºä¾‹åœºæ™¯ï¼š```
ä»ªè¡¨æ¿æ˜¾ç¤ºï¼š
â€¢ æ€»è¯·æ±‚æ•°ï¼š1,662
â€¢ æ€» Token æ•°ï¼š47M
â€¢ æ˜¾ç¤ºæˆæœ¬ï¼š$290

çŽ°å®žæ£€æŸ¥ï¼š
â€¢ æä¾›å•†ï¼šiFlowï¼ˆå…è´¹æ— é™åˆ¶ï¼‰
â€¢ å®žé™…ä»˜æ¬¾ï¼š$0.00
â€¢ $290 çš„å«ä¹‰ï¼šæ‚¨é€šè¿‡ä½¿ç”¨å…è´¹æ¨¡åž‹èŠ‚çœçš„é‡‘é¢ï¼
```

**ä»˜æ¬¾è§„åˆ™ï¼š**
- **è®¢é˜…æä¾›å•†**ï¼ˆClaude Code, Codexï¼‰ï¼šé€šè¿‡ä»–ä»¬çš„ç½‘ç«™ç›´æŽ¥å‘ä»–ä»¬ä»˜æ¬¾
- **å»‰ä»·æä¾›å•†**ï¼ˆGLM, MiniMaxï¼‰ï¼šç›´æŽ¥å‘ä»–ä»¬ä»˜æ¬¾ï¼ŒMirai åªæ˜¯è·¯ç”±
- **å…è´¹**ï¼ˆiFlow, Kiro, Qwenï¼‰ï¼šçœŸæ­£æ°¸è¿œå…è´¹ï¼Œæ²¡æœ‰éšè—è´¹ç”¨
- **Mirai**ï¼šä»Žä¸æ”¶å–ä»»ä½•è´¹ç”¨ï¼Œæ°¸è¿œ

---

## ðŸŽ¯ ä½¿ç”¨æ¡ˆä¾‹

### æ¡ˆä¾‹ 1ï¼šâ€œæˆ‘æœ‰ Claude Pro è®¢é˜…â€

**é—®é¢˜ï¼š** é…é¢æœªä½¿ç”¨å³è¿‡æœŸï¼Œé‡åº¦ç¼–ç¨‹æ—¶é‡åˆ°é€ŸçŽ‡é™åˆ¶

**è§£å†³æ–¹æ¡ˆï¼š**
```
Combo: "maximize-claude"
  1. cc/claude-opus-4-6        (use subscription fully)
  2. glm/glm-4.7               (cheap backup when quota out)
  3 if/kimi-k2-thinking       (free emergency fallback)

Monthly cost: $20 (subscription) + ~$5 (backup) = $25 total
vs. $20 + hitting limits = frustration
```

### æ¡ˆä¾‹ 2ï¼šâ€œæˆ‘æƒ³è¦é›¶æˆæœ¬â€

**é—®é¢˜ï¼š** è´Ÿæ‹…ä¸èµ·è®¢é˜…ï¼Œéœ€è¦å¯é çš„ AI ç¼–ç¨‹

**è§£å†³æ–¹æ¡ˆï¼š**
```
Combo: "free-forever"
  1. gc/gemini-3-flash         (180K free/month)
  2. if/kimi-k2-thinking       (unlimited free)
  3. qw/qwen3-c-plus       (unlimited free)

Monthly cost: $0
Quality: Production-ready models
```

### æ¡ˆä¾‹ 3ï¼šâ€œæˆ‘éœ€è¦ 24/7 ç¼–ç¨‹ï¼Œæ— ä¸­æ–­â€

**é—®é¢˜ï¼š** æˆªæ­¢æ—¥æœŸï¼Œä¸èƒ½æ‰¿å—åœæœº

**è§£å†³æ–¹æ¡ˆï¼š**
```
Combo: "always-on"
  1. cc/claude-opus-4-6        (best quality)
  2. cx/gpt-5.2-codex          (second subscription)
  3. glm/glm-4.7               (cheap, resets daily)
  4. minimaxMiniMax-M2.1      (cheapest, 5h reset)
  5. if/kimi-k2-thinking       (free unlimited)

Result: 5 layers of fallback = zero downtime
Monthly cost: $20-200 (subscriptions) + $10-20 (backup)
```

### æ¡ˆä¾‹ 4ï¼šâ€œæˆ‘æƒ³åœ¨ OpenClaw ä¸­ä½¿ç”¨å…è´¹ AIâ€

**é—®é¢˜ï¼š** éœ€è¦åœ¨æ¶ˆæ¯åº”ç”¨ï¼ˆWhatsApp, Telegram, Slack...ï¼‰ä¸­ä½¿ç”¨ AI åŠ©æ‰‹ï¼Œå®Œå…¨å…è´¹

**è§£å†³æ–¹æ¡ˆï¼š**
```
Combo: "openclaw-free"
  1. if/glm-4.7                (unlimited free)
  2. if/minimax-m2.1           (unlimited free)
  3. if/kimi-k2-thinking       (unlimited free)

Monthly cost: $0
Access via: WhatsApp, Telegram, Slack, Discord, iMessage, Signal...
```

---

## â“ å¸¸è§é—®é¢˜

<details>
<summary><b>ðŸ“Š ä¸ºä»€ä¹ˆæˆ‘çš„ä»ªè¡¨æ¿æ˜¾ç¤ºé«˜æˆæœ¬ï¼Ÿ</b></summary>

ä»ªè¡¨æ¿è¿½è¸ªæ‚¨çš„ Token ä½¿ç”¨æƒ…å†µï¼Œå¹¶æ˜¾ç¤º**ä¼°ç®—æˆæœ¬**ï¼Œå°±åƒæ‚¨ç›´æŽ¥ä½¿ç”¨ä»˜è´¹ API ä¸€æ ·ã€‚è¿™**ä¸æ˜¯å®žé™…è®¡è´¹** - å®ƒæ˜¯ä¸€ä¸ªå‚è€ƒï¼Œæ˜¾ç¤ºæ‚¨é€šè¿‡ Mirai ä½¿ç”¨å…è´¹æ¨¡åž‹æˆ–çŽ°æœ‰è®¢é˜…èŠ‚çœäº†å¤šå°‘ã€‚

**ç¤ºä¾‹ï¼š**
- **ä»ªè¡¨æ¿æ˜¾ç¤ºï¼š**â€œ$290 æ€»æˆæœ¬â€
- **çŽ°å®žï¼š** æ‚¨æ­£åœ¨ä½¿ç”¨ iFlowï¼ˆå…è´¹æ— é™åˆ¶ï¼‰
- **æ‚¨çš„å®žé™…æˆæœ¬ï¼š** **$0.00**
- **$290 çš„å«ä¹‰ï¼š** æ‚¨é€šè¿‡ä½¿ç”¨å…è´¹æ¨¡åž‹è€Œä¸æ˜¯ä»˜è´¹ API **èŠ‚çœ**çš„é‡‘é¢ï¼

æˆæœ¬æ˜¾ç¤ºæ˜¯ä¸€ä¸ªâ€œèŠ‚çœè¿½è¸ªå™¨â€ï¼Œå¸®åŠ©æ‚¨äº†è§£ä½¿ç”¨æ¨¡å¼å’Œä¼˜åŒ–æœºä¼šã€‚

</details>

<details>
<summary><b>ðŸ’³ Mirai ä¼šå‘æˆ‘æ”¶è´¹å—ï¼Ÿ</b></summary>

**ä¸ä¼šã€‚** 9 æ˜¯å…è´¹çš„å¼€æºè½¯ä»¶ï¼Œåœ¨æ‚¨è‡ªå·±çš„è®¡ç®—æœºä¸Šè¿è¡Œã€‚å®ƒä»Žä¸å‘æ‚¨æ”¶è´¹ã€‚

**æ‚¨åªéœ€æ”¯ä»˜ï¼š**
- âœ… **è®¢é˜…æä¾›å•†**ï¼ˆClaude Code $20/æœˆ, Codex $20-200/æœˆï¼‰â†’ åœ¨ä»–ä»¬çš„ç½‘ç«™ä¸Šç›´æŽ¥å‘ä»–ä»¬ä»˜æ¬¾
- âœ… **å»‰ä»·æä¾›å•†**ï¼ˆGLM, MiniMaxï¼‰â†’ ç›´æŽ¥å‘ä»–ä»¬ä»˜æ¬¾ï¼ŒMirai åªæ˜¯è·¯ç”±æ‚¨çš„è¯·æ±‚
- âŒ **Mirai æœ¬èº«** â†’ **ä»Žä¸æ”¶å–ä»»ä½•è´¹ç”¨ï¼Œæ°¸è¿œ**

Mirai æ˜¯æœ¬åœ°ä»£ç†/è·¯ç”±å™¨ã€‚å®ƒæ²¡æœ‰æ‚¨çš„ä¿¡ç”¨å¡ï¼Œä¸èƒ½å‘é€å‘ç¥¨ï¼Œä¹Ÿæ²¡æœ‰è®¡è´¹ç³»ç»Ÿã€‚å®Œå…¨å…è´¹çš„è½¯ä»¶ã€‚

</details>

<details>
<summary><b>ðŸ†“ å…è´¹æä¾›å•†çœŸçš„æ— é™åˆ¶å—ï¼Ÿ</b></summary>

**æ˜¯çš„ï¼** æ ‡è®°ä¸ºå…è´¹ï¼ˆiFlow, Kiro, Qwenï¼‰çš„æä¾›å•†æ˜¯çœŸæ­£æ— é™åˆ¶çš„ï¼Œ**æ²¡æœ‰éšè—è´¹ç”¨**ã€‚

è¿™äº›æ˜¯å„è‡ªå…¬å¸æä¾›çš„å…è´¹æœåŠ¡ï¼š
- **iFlow**ï¼šé€šè¿‡ OAuth å…è´¹æ— é™åˆ¶è®¿é—® 8+ æ¨¡åž‹
- **Kiro**ï¼šé€šè¿‡ AWS Builder ID å…è´¹æ— é™åˆ¶ Claude æ¨¡åž‹
- **Qwen**ï¼šé€šè¿‡è®¾å¤‡è®¤è¯å…è´¹æ— é™åˆ¶è®¿é—® Qwen æ¨¡åž‹

Router åªæ˜¯å°†æ‚¨çš„è¯·æ±‚è·¯ç”±åˆ°å®ƒä»¬ - æ²¡æœ‰â€œé™·é˜±â€æˆ–æœªæ¥è®¡è´¹ã€‚å®ƒä»¬æ˜¯çœŸæ­£çš„å…è´¹æœåŠ¡ï¼ŒMirai ä½¿å®ƒä»¬æ˜“äºŽä½¿ç”¨å¹¶æ”¯æŒå›žé€€ã€‚

**æ³¨æ„ï¼š** ä¸€äº›è®¢é˜…æä¾›å•†ï¼ˆAntigravity, GitHub Copilotï¼‰å¯èƒ½æœ‰å…è´¹é¢„è§ˆæœŸï¼ŒåŽæ¥å¯èƒ½å˜æˆä»˜è´¹ï¼Œä½†è¿™ä¼šç”±è¿™äº›æä¾›å•†æ˜Žç¡®å®£å¸ƒï¼Œè€Œä¸æ˜¯ Miraiã€‚

</details>

<details>
<summary><b>ðŸ’° å¦‚ä½•æœ€å°åŒ–æˆ‘çš„å®žé™… AI æˆæœ¬ï¼Ÿ</b></summary>

**å…è´¹ä¼˜å…ˆç­–ç•¥ï¼š**

1. **ä»Ž 100% å…è´¹ç»„åˆå¼€å§‹ï¼š**
   ```
   1. gc/gini-3-flash (180K/month free from Google)
   2. if/kimi-k2-thinking (unlimited free from iFlow)
   3. qw/qwen3-coder-plus (unlimited free from Qwen)
   ```
   **æˆæœ¬ï¼š$0/æœˆ**

2. **ä»…åœ¨éœ€è¦æ—¶æ·»åŠ å»‰ä»·å¤‡ä»½ï¼š**
   ```
   4. glm/glm-4.7 ($0.6/1M tokens)
   ```
   **é¢å¤–æˆæœ¬ï¼šä»…ä¸ºæ‚¨å®žé™…ä½¿ç”¨çš„ä»˜è´¹**

3. **æœ€åŽä½¿ç”¨è®¢é˜…æä¾›å•†ï¼š**
   - ä»…å½“æ‚¨å·²ç»æ‹¥æœ‰å®ƒä»¬æ—¶
   - Mirai é€šè¿‡é…é¢è¿½è¸ªå¸®åŠ©æœ€å¤§åŒ–å…¶ä»·å€¼

**ç»“æžœï¼š** å¤§å¤šæ•°ç”¨æˆ·å¯ä»¥ä»…ä½¿ç”¨å…è´¹å±‚ä»¥ $0/æœˆè¿è¡Œï¼

</details>

<details>
<summary><b>ðŸ“ˆ å¦‚æžœæˆ‘çš„ä½¿ç”¨é‡çªç„¶æ¿€å¢žæ€Žä¹ˆåŠžï¼Ÿ</b></summary>

Mirai çš„æ™ºèƒ½å›žé€€å¯é˜²æ­¢æ„å¤–è´¹ç”¨ï¼š

**åœºæ™¯ï¼š** æ‚¨æ­£åœ¨è¿›è¡Œç¼–ç¨‹å†²åˆºå¹¶è€—å°½äº†é…é¢

**æ²¡æœ‰ Miraiï¼š**
- âŒ é‡åˆ°é€ŸçŽ‡é™åˆ¶ â†’ å·¥ä½œåœæ­¢ â†’ æ²®ä¸§
- âŒ æˆ–ï¼šæ„å¤–ç´¯ç§¯å·¨é¢ API è´¦å•

**æœ‰ Miraiï¼š**
- âœ…è®¢é˜…è¾¾åˆ°é™åˆ¶ â†’ è‡ªåŠ¨å›žé€€åˆ°å»‰ä»·å±‚
- âœ… å»‰ä»·å±‚å˜å¾—æ˜‚è´µ â†’ è‡ªåŠ¨å›žé€€åˆ°å…è´¹å±‚
- âœ… æ°¸ä¸åœæ­¢ç¼–ç¨‹ â†’ å¯é¢„æµ‹çš„æˆæœ¬

**æ‚¨åœ¨æŽ§åˆ¶ä¸­ï¼š** åœ¨ä»ªè¡¨æ¿ä¸­è®¾ç½®æ¯ä¸ªæä¾›å•†çš„æ”¯å‡ºé™åˆ¶ï¼ŒMirai ä¼šéµå®ˆå®ƒä»¬ã€‚

</details>

---

## ðŸ“– è®¾ç½®æŒ‡å—

<details>
<summary><b>ðŸ” è®¢é˜…æä¾›å•†ï¼ˆæœ€å¤§åŒ–ä»·å€¼ï¼‰</b></summary>

### Claude Code (Pro/Max)

```bash
Dashboard â†’ Providers â†’ Connect Claude Code
â†’ OAuth login â†’ Auto token refresh
â†’ 5-hour + weekly quota tracking

Models:
  cc/claude-opus-4-6
  cc/claude-sonnet-4-5-20250929
  cc/claude-haiku-4-5-20251001
```

**ä¸“ä¸šæç¤ºï¼š** ä½¿ç”¨ Opus å¤„ç†å¤æ‚ä»»åŠ¡ï¼ŒSonnet è¿½æ±‚é€Ÿåº¦ã€‚Mirai è¿½è¸ªæ¯ä¸ªæ¨¡åž‹çš„é…é¢ï¼

### OpenAI Codex (Plus/Pro)

```bash
Dashboard â†’ Providers â†’ Connect Codex
â†’ OAuth login (port 1455)
â†’ 5-hour + weekly reset

Models:
 /gpt-5.2-codex
  cx/gpt-5.1-codex-max
```

### Gemini CLIï¼ˆå…è´¹ 180K/æœˆï¼ï¼‰

```bash
Dashboard â†’ Providers â†’ Connect Gemini CLI
â†’ Google OAuth
â†’ 180K completions/month + 1K/day

Models:
  gc/gemini-3-flash-preview
  gc/gemini-2.5-pro
```

**æœ€ä½³ä»·å€¼ï¼š** å·¨å¤§çš„å…è´¹å±‚ï¼åœ¨ä»˜è´¹å±‚ä¹‹å‰ä½¿ç”¨è¿™ä¸ªã€‚

### GitHub Copilot

```bash
Dashboard â†’ Providers â†’ Connect GitHub
â†’ OAuth via
â†’ Monthly reset (1st of month)

Models:
  gh/gpt-5
  gh/claude-4.5-sonnet
  gh/gemini-3-pro
```

</details>

<details>
<summary><b>ðŸ’° å»‰ä»·æä¾›å•†ï¼ˆå¤‡ä»½ï¼‰</b></summary>

### GLM-4.7ï¼ˆæ¯æ—¥é‡ç½®ï¼Œ$0.6/1Mï¼‰

1. æ³¨å†Œï¼š[Zhipu AI](https://open.bigmodel.cn/)
2. ä»Ž Coding Plan èŽ·å– API key
3. ä»ªè¡¨æ¿ â†’ æ·»åŠ  API Keyï¼š
   - Provider: `glm`
   - API Key: `your-key`

**ä½¿ç”¨ï¼š** `glm/glm-4.7`

**ä¸“ä¸šæç¤ºï¼š** Coding Plan ä»¥ 1/7 çš„æˆæœ¬æä¾› 3Ã— é…é¢ï¼æ¯æ—¥ 10:00 AM é‡ç½®ã€‚

### MiniMax M2.1ï¼ˆ5h é‡ç½®ï¼Œ$0.20/1Mï¼‰

1. æ³¨å†Œï¼š[MiniMax](https://www.minimax.io/)
2. èŽ·å– API key
3. ä»ªè¡¨æ¿ â†’ æ·»åŠ  API Key

**ä½¿ç”¨ï¼š** `minimax/MiniMax-M2.1`

**ä¸“ä¸šæç¤ºï¼š** é•¿ä¸Šä¸‹æ–‡ï¼ˆ1M tokensï¼‰çš„æœ€ä¾¿å®œé€‰é¡¹ï¼

### Kimi K2ï¼ˆ$9/æœˆå›ºå®šï¼‰

1. è®¢é˜…ï¼š[Moonshot AI](https://platform.moonshot.ai/)
2. èŽ·å– API key
3. ä»ªè¡¨æ¿ â†’ æ·»åŠ  API Key

**ä½¿ç”¨ï¼š** `kimi/kimi-latest`

**ä¸“ä¸šæç¤ºï¼š** å›ºå®š $9/æœˆå¯èŽ·å¾— 10M tokens = $0.90/1M å®žé™…æˆæœ¬ï¼

</details>

<details>
<summary><b>ðŸ†“ å…è´¹æä¾›å•†ï¼ˆç´§æ€¥å¤‡ä»½ï¼‰</b></summary>

### iï¼ˆ8 ä¸ªå…è´¹æ¨¡åž‹ï¼‰

```bash
Dashboard â†’ Connect iFlow
â†’ iFlow OAuth login
â†’ Unlimited usage

Models:
  if/kimi-k2-thinking
  if/qwen3-coder-plus
  if/glm-4.7
  if/minimax-m2
  if/deepseek-r1
```

### Qwenï¼ˆ3 ä¸ªå…è´¹æ¨¡åž‹ï¼‰

```bash
Dashboard â†’ Connect Qwen
â†’ Device code authorization
â†’ Unlimited usage

Models:
  qw/qwen3-coder-plus
  qw/qwen3-coder-flash
```

### Kiroï¼ˆClaude å…è´¹```bash
Dashboard â†’ Connect Kiro
â†’ AWS Builder ID or Google/GitHub
â†’ Unlimited usage

Models:
  kr/claude-sonnet-4.5
  kr/claude-haiku-4.5
```

</details>

<details>
<summary><b>ðŸŽ¨ åˆ›å»ºç»„åˆ</b></summary>

### ç¤ºä¾‹ 1ï¼šæœ€å¤§åŒ–è®¢é˜… â†’ å»‰ä»·å¤‡ä»½

```
Dashboard â†’ Combos â†’ Create New

Name: premium-coding
Models:
  1. cc/claude-opus-4-6 (Subscription primary)
  2. glm/glm4.7 (Cheap backup, $0.6/1M)
  3. minimax/MiniMax-M2.1 (Cheapest fallback, $0.20/1M)

Use in CLI: premium-coding

Monthly cost example (100M tokens):
  80M via Claude (subscription): $0 extra
  15M via GLM: $9
  5M via MiniMax: $1
  Total: $10 + your subscription
```

### ç¤ºä¾‹ 2ï¼šä»…å…è´¹ï¼ˆé›¶æˆæœ¬ï¼‰

```
Name: free-combo
Models:
  1. gc/gemini-3-flash-preview (180K free/month)
  2. if/kimi-k2-thinking (unlimited)
  3. qw/qwen3-coder-plus (unlimited)

Cost: $0 forever!
```

</details>

<details>
<summary><b>ðŸ”§ CLI é›†æˆ</b></summary>

### Cursor IDE

```
Settings â†’ Models â†’ Advanced:
  OpenAI API Base URL: http://localhost:1463/v1
  OpenAI API Key: [from mirai dashboard]
  Model: cc/claude-opus-4-6
```

ä½¿ç”¨ç»„åˆï¼š`premium-coding`

### Claude Code

ç¼–è¾‘ `~/.claude/config.json`ï¼š

```json
{
  "anthropic_api_base": "http://localhost:1463/v1",
  "anthropic_api_key": "your-mirai-api-key"
}
```

### Codex CLI

```bash
export OPENAI_BASE_URL="http://localhost:1463"
export OPENAI_API_KEY="your-mirai-api-key"

codex "your prompt"
```

### OpenClaw

**é€‰é¡¹ 1 â€” ä»ªè¡¨æ¿ï¼ˆæŽ¨èï¼‰ï¼š**

```
Dashboard â†’ CLI Tools â†’Claw â†’ Select Model â†’ Apply
```

**é€‰é¡¹ 2 â€” æ‰‹åŠ¨ï¼š** ç¼–è¾‘ `~/.openclaw/openclaw.json`ï¼š

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "mirai/if/glm-4.7"
      }
    }
  },
  "models": {
    "providers": {
      "mirai": {
        "baseUrl": "http://127.0.0.1:1463/v1",
        "apiKey": "sk_mirai",
        "api": "openai-completions",
        "models": [
          {
            "id": "if/glm-4.7",
            "name": "glm-4.7"
          }
        ]
      }
    }
  }
}
```

> **æ³¨æ„ï¼š** OpenClaw ä»…é€‚ç”¨äºŽæœ¬åœ° Miraiã€‚ä½¿ç”¨ `127.0.0.1` è€Œä¸æ˜¯ `localhost` ä»¥é¿å… IPv6 è§£æžé—®é¢˜ã€‚

### Cline / Continue / RooCode

```
Provider: OpenAI Compatible
Base URL: http://localhost:1463/v1
API Key: [from dashboard]
Model: cc/claudeus-4-6
```

</details>

<details>
<summary><b>ðŸš€ éƒ¨ç½²</b></summary>

### VPS éƒ¨ç½²

```bash
# Clone and install
git clone https://github.com/decolua/mirai.git
cd mirai
npm install
npm run build

# Configure
export JWT_SECRET="your-secure-secret-change-this"
export INITIAL_PASSWORD="your-password"
export DATA_DIR="/var/lib/mirai"
export PORT="1463"
export HOSTNAME="0.0.0.0"
export NODE_ENV="production"
export NEXT_PUBLIC_BASE_URLhttp://localhost:1463"
export NEXT_PUBLIC_CLOUD_URL="https://mirai.local"
export API_KEY_SECRET="endpoint-proxy-api-key-secret"
export MACHINE_ID_SALT="endpoint-proxy-salt"

# Start
npm run start

# Or use PM2
npm install -g pm2
pm2 start npm --name mirai -- start
pm2 save
pm2 startup
```

### Docker

```bash
# Build image (from repository root)
docker build -t mirai .

# Run container (command used in current setup)
docker run -d \
  --name mirai  -p 1463:1463 \
  --env-file /root/dev/mirai/.env \
  -v mirai-data:/app/data \
  -v mirai-usage:/root/.mirai \
  mirai
```

ä¾¿æºå¼å‘½ä»¤ï¼ˆå¦‚æžœæ‚¨å·²åœ¨ä»“åº“æ ¹ç›®å½•ï¼‰ï¼š

```bash
docker run -d \
  --name mirai \
  -p 1463:1463 \
  --env-file ./.env \
  -v mirai-data:/app/data \
  -v mirai-usage:/root/.mirai \
  9
```

å®¹å™¨é»˜è®¤å€¼ï¼š
- `PORT=1463`
- `HOSTNAME=0.0.0.0`

æœ‰ç”¨å‘½ä»¤ï¼š

```bash
docker logs -f mirai
docker restart mirai
docker stop mirai && docker rm mirai
```

### çŽ¯å¢ƒå˜é‡

| å˜é‡ | é»˜è®¤å€¼ | æè¿° |
|----------|---------|-------------|
| `JWT_SECRET` | è‡ªåŠ¨ç”Ÿæˆï¼ˆ`~/.mirai/jwt-secret`ï¼‰ | ä»ªè¡¨æ¿è®¤è¯ cookie çš„ JWT ç­¾åå¯†é’¥ï¼ˆè®¾ç½®å¯åœ¨å¤šå®žä¾‹é—´å…±äº«ï¼‰ |
| `INITIAL_PASSWORD | `123456` | å½“æ²¡æœ‰ä¿å­˜çš„å“ˆå¸Œæ—¶çš„é¦–æ¬¡ç™»å½•å¯†ç  |
| `DATA_DIR` | `~/.mirai` | ä¸»åº”ç”¨æ•°æ®åº“ä½ç½®ï¼ˆ`db.json`ï¼‰ |
| `PORT` | `1463` | Service port (also settable from Settings; persisted in `<DATA_DIR>/config/port.json`) |
| `HOSTNAME` | æ¡†æž¶é»˜è®¤å€¼ | ç»‘å®šä¸»æœºï¼ˆDocker é»˜è®¤ä¸º `0.0.0.0`ï¼‰ |
| `NODE_ENV` | è¿è¡Œæ—¶é»˜è®¤å€¼ | éƒ¨ç½²æ—¶è®¾ç½® `production` |
| `BASE_URL` |http://localhost:1463` | äº‘åŒæ­¥ä½œä¸šä½¿ç”¨çš„æœåŠ¡å™¨ç«¯å†…éƒ¨åŸºç¡€ URL |
| `CLOUD_URL` | `https://mirai.local` | æœåŠ¡å™¨ç«¯äº‘åŒæ­¥ç«¯ç‚¹åŸºç¡€ URL |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | å‘åŽå…¼å®¹/å…¬å…±åŸºç¡€ URLï¼ˆæœåŠ¡å™¨è¿è¡Œæ—¶ä¼˜å…ˆä½¿ç”¨ `BASE_URL`ï¼‰ |
| `NEXT_PUBLIC_CLOUD_URL` | `https://mirai.local` | å‘åŽå…¼å®¹/å…¬å…±äº‘ URLï¼ˆæœåŠ¡å™¨è¿è¡Œæ—¶ä¼˜å…ˆä½¿ç”¨ `CLOUD_URL`ï¼‰ |
| `API_KEY_SECRET` | `endpoint-proxy-api-secret` | ç”Ÿæˆçš„ API Key çš„ HMAC å¯†é’¥ |
| `MACHINE_ID_SALT` | `endpoint-proxy-salt` | ç¨³å®šæœºå™¨ ID å“ˆå¸Œçš„ç›å€¼ |
| `ENABLE_REQUEST_LOGS` | `false` | åœ¨ `logs/` ä¸‹å¯ç”¨è¯·æ±‚/å“åº”æ—¥å¿— |
| `AUTH_COOKIE_SECURE` | `false` | å¼ºåˆ¶ `Secure` è®¤è¯ cookieï¼ˆåœ¨ HTTPS åå‘ä»£ç†åŽè®¾ç½® `true`ï¼‰ |
| `REQUIRE_API_KEY` | `false` | åœ¨ `/v1/*` è·¯ç”±ä¸Šå¼ºåˆ¶æ‰§è¡Œ Bearer API keyæŽ¨èç”¨äºŽæš´éœ²åœ¨äº’è”ç½‘çš„éƒ¨ç½²ï¼‰ |
| `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY` | ç©º | ä¸Šæ¸¸æä¾›å•†è°ƒç”¨çš„å¯é€‰å‡ºç«™ä»£ç† |

æ³¨æ„ï¼š
- ä¹Ÿæ”¯æŒå°å†™ä»£ç†å˜é‡ï¼š`http_proxy`, `https_proxy`, `all_proxy`, `no_proxy`ã€‚
- `.env` ä¸ä¼šçƒ˜ç„™åˆ° Docker é•œåƒä¸­ï¼ˆ`.dockerignore`ï¼‰ï¼›ä½¿ç”¨ `--env-file` æˆ– `-e` æ³¨å…¥è¿è¡Œæ—¶é…ç½®ã€‚
- åœ¨ Windows ä¸Šï¼Œ`APPDATA` å¯ç”¨äºŽæœ¬åœ°å­˜å‚¨è·¯å¾„è§£æžã€‚
- `INSTANCE_NAME` å‡ºçŽ°åœ¨æ—§/çŽ¯å¢ƒæ¨¡æ¿ä¸­ï¼Œä½†ç›®å‰è¿è¡Œæ—¶æœªä½¿ç”¨ã€‚

### è¿è¡Œæ—¶æ–‡ä»¶å’Œå­˜å‚¨

- ä¸»åº”ç”¨çŠ¶æ€ï¼š`${DATA_DIR}/db.json`ï¼ˆæä¾›å•†ã€ç»„åˆã€åˆ«åã€å¯†é’¥ã€è®¾ç½®ï¼‰ï¼Œç”± `src/lib/localDb.js` ç®¡ç†ã€‚
- Persisted server port: `${DATA_DIR}/config/port.json` (`{ "port": N }`) - written when you change the port from Settings.
- ä½¿ç”¨åŽ†å²å’Œæ—¥å¿—ï¼š`~/.mirai/usage.json` å’Œ `~/.mirai/log.txt`ï¼Œç”± `src/lib/usageDb.js` ç®¡ç†ã€‚
- å¯é€‰è¯·æ±‚/è½¬æ¢å™¨æ—¥å¿—ï¼šå½“ `ENABLE_REQUEST_LOGS=true` æ—¶ä¸º `<repo>/logs/...`ã€‚
- ä½¿ç”¨å­˜å‚¨å½“å‰éµå¾ª `~/.9` è·¯å¾„é€»è¾‘ï¼Œç‹¬ç«‹äºŽ `DATA_DIR`ã€‚

</details>

---

## ðŸ“Š å¯ç”¨æ¨¡åž‹

<details>
<summary><b>æŸ¥çœ‹æ‰€æœ‰å¯ç”¨æ¨¡åž‹</b></summary>

**Claude Code (`cc/`)** - Pro/Max:
- `cc/claude-opus-4-6`
- `cc/claude-sonnet-4-5-20250929`
- `cc/claude-haiku-4-5-20251001`

**Codex (`cx/`)** - Plus/Pro:
- `cx/gpt-5.2-codex- `cx/gpt-5.1-codex-max`

**Gemini CLI (`gc/`)** - å…è´¹:
- `gc/gemini-3-flash-preview`
- `gc/gemini-2.5-pro`

**GitHub Copilot (`gh/`)**:
- `gh/gpt-5`
- `gh/claude-4.5-sonnet`

**GLM (`glm/`)** - $0.6/1M:
- `glm/glm-4.7`

**MiniMax (`minimax/`)** - $0.2/1M:
- `imax/MiniMax-M2.1`

**iFlow (`if/`)** - å…è´¹:
- `if/kimi-k2-thinking`
- `if/qwen3-coder-plus`
- `if/deepseek-r1`

**Qwen (`qw/`)** - å…è´¹:
- `qw/qwen3-coder-plus`
- `qw/qwen3-coder-flash`

**Kiro (`kr/`)** - å…è´¹:
- `kr/claude-sonnet-4.5`
- `kr/claude-haiku-4.5`

</details>

---

## ðŸ› æ•…éšœæŽ’é™¤

â€œLanguage model did not provide messagesâ€**
- æä¾›å•†é…é¢è€—å°½ â†’ æ£€æŸ¥ä»ªè¡¨æ¿é…é¢è¿½è¸ªå™¨
- è§£å†³æ–¹æ¡ˆï¼šä½¿ç”¨ç»„åˆå›žé€€æˆ–åˆ‡æ¢åˆ°æ›´ä¾¿å®œçš„å±‚

**é€ŸçŽ‡é™åˆ¶**
- è®¢é˜…é…é¢ç”¨å®Œ â†’ å›žé€€åˆ° GLM/MiniMax
- æ·»åŠ ç»„åˆï¼š`cc/claude-opus-4-6 â†’ glm/glm-4.7 â†’ if/kimi-k2-thinking`

**OAuth token è¿‡æœŸ**
- ç”± Mirai è‡ªåŠ¨åˆ·æ–°
- å¦‚æžœé—®é¢˜æŒç»­ï¼šä»ªè¡¨æ¿ â†’ æä¾›å•† â†’ é‡æ–°

**é«˜æˆæœ¬**
- åœ¨ä»ªè¡¨æ¿ä¸­æ£€æŸ¥ä½¿ç”¨ç»Ÿè®¡
- å°†ä¸»è¦æ¨¡åž‹åˆ‡æ¢ä¸º GLM/MiniMax
- å¯¹éžå…³é”®ä»»åŠ¡ä½¿ç”¨å…è´¹å±‚ï¼ˆGemini CLI, iFlowï¼‰

**ä»ªè¡¨æ¿åœ¨é”™è¯¯çš„ç«¯å£æ‰“å¼€**
- è®¾ç½® `PORT=1463` å’Œ `NEXT_PUBLIC_BASE_URL=http://localhost:1463`

**äº‘ç«¯åŒæ­¥é”™è¯¯**
- éªŒè¯ `BASE_URL` æŒ‡å‘æ‚¨æ­£åœ¨è¿è¡Œçš„å®žä¾‹ï¼ˆä¾‹å¦‚ï¼š`http://localhost:1463`ï¼‰
- éªŒè¯ `CLOUD_URL` æŒ‡å‘æ‚¨é¢„æœŸçš„äº‘ç«¯ç«¯ç‚¹ï¼ˆä¾‹å¦‚ï¼š`https://mirai.local`ï¼‰
- å°½å¯èƒ½ä¿æŒ `NEXT_PUBLIC_*` å€¼ä¸ŽæœåŠ¡å™¨ç«¯å€¼ä¸€è‡´ã€‚

**äº‘ç«¯ç«¯ç‚¹ `stream=false` è¿”å›ž 500ï¼ˆ`Unexpected token 'd'...`ï¼‰**
- ç—‡çŠ¶é€šå¸¸å‡ºçŽ°åœ¨å…¬å…±äº‘ç«¯ç«¯ç‚¹ï¼ˆ`https://mirai.local/v1`ï¼‰çš„éžæµå¼è°ƒç”¨ä¸Šã€‚
- æ ¹æœ¬åŽŸå› ï¼šä¸Šæ¸¸è¿”å›ž SSE è´Ÿè½½ï¼ˆ`data: ...`ï¼‰è€Œå®¢æˆ·ç«¯æœŸæœ› JSONã€‚
- å˜é€šæ–¹æ³•ï¼šå¯¹äº‘ç«¯ç›´æŽ¥è°ƒç”¨ä½¿ç”¨ `stream=true`ã€‚
- å½“ä¸Šæ¸¸è¿”å›ž `text/event-stream` æ—¶ï¼Œæœ¬åœ° Mirai è¿è¡Œæ—¶åŒ…å« SSEâ†’JSON å›žé€€ç”¨äºŽéžæµå¼è°ƒç”¨ã€‚

**äº‘ç«¯æ˜¾ç¤ºå·²è¿žæŽ¥ï¼Œä½†è¯·æ±‚ä»ç„¶å¤±è´¥å¹¶æ˜¾ç¤º `Invalid API key`**
- ä»Žæœ¬åœ°ä»ªè¡¨æ¿ï¼ˆ`/api/keys`ï¼‰åˆ›å»ºæ–°å¯†é’¥å¹¶è¿è¡Œäº‘ç«¯åŒæ­¥ï¼ˆ`Enable Cloud` ç„¶åŽ `Sync Now`ï¼‰ã€‚
- æ—§/æœªåŒæ­¥çš„å¯†é’¥å³ä½¿åœ¨æœ¬åœ°ç«¯ç‚¹å·¥ä½œçš„æƒ…å†µä¸‹ï¼Œä»å¯èƒ½åœ¨äº‘ç«¯è¿”å›ž `401`ã€‚

**é¦–æ¬¡ç™»å½•ä¸å·¥ä½œ**
- æ£€æŸ¥ `.env` ä¸­çš„ `INITIAL_PASSWORD`
- å¦‚æžœæœªè®¾ç½®ï¼Œå›žé€€å¯†ç æ˜¯ `123456`

**`logs/` ä¸‹æ²¡æœ‰è¯·æ±‚æ—¥å¿—**
- è®¾ç½® `ENABLE_REQUEST_LOGS=true`

---

## ðŸ› ï¸ æŠ€æœ¯æ ˆ

- **è¿è¡Œæ—¶**ï¼šNode.js 20+
- **æ¡†æž¶**ï¼šNext.js 16
- **UI**ï¼šReact 19 + Tailwind CSS 4
- **æ•°æ®åº“**ï¼šLowDBï¼ˆåŸºäºŽ JSON æ–‡ä»¶ï¼‰
- **æµå¼ä¼ è¾“**ï¼šServer-Sent Events (SSE)
- **è®¤è¯**ï¼šOAuth 2.0 (PKCE) + JWT + API Keys

---

## ðŸ“ API å‚è€ƒ

### Chat Completions

```bash
POST httplocalhost:1463/v1/chat/completions
Authorization: Bearer your-api-key
Content-Type: application/json

{
  "model": "cc/claude-opus-4-6",
  "messages": [
    {"role": "user", "content": "Write a function to..."}
  ],
  "stream": true
}
```

### åˆ—å‡ºæ¨¡åž‹

```bash
GET http://localhost:1463/v1/models
Authorization: Bearer your-api-key

â†’ Returns all models + combos in OpenAI format
```

### å…¼å®¹æ€§ç«¯ç‚¹

- ` /v1/chat/completions`
- `POST /v1/messages`
- `POST /v1/responses`
- `GET /v1/models`
- `POST /v1/messages/count_tokens`
- `GET /v1beta/models`
- `POST /v1beta/models/{...path}`ï¼ˆGemini é£Žæ ¼ `generateContent`ï¼‰
- `POST /v1/api/chat`ï¼ˆOllama é£Žæ ¼è½¬æ¢è·¯å¾„ï¼‰

### äº‘ç«¯éªŒè¯è„šæœ¬

åœ¨ `tester/security/` ä¸‹æ·»åŠ äº†æµ‹è¯•è„šæœ¬ï¼š

- `tester/security/test-docker-hardening.sh`
  - æž„å»º Docker é•œåƒå¹¶éªŒè¯åŠ å›ºæ£€æŸ¥ï¼ˆ`/api/cloud/auth` è®¤è¯ä¿æŠ¤ã€`REQUIRE_API_KEY`ã€å®‰å…¨è®¤è¯ cookie è¡Œä¸ºï¼‰ã€‚
- `tester/security/test-cloud-openai-compatible.sh`
  - ä½¿ç”¨æä¾›çš„æ¨¡åž‹/å¯†é’¥å‘äº‘ç«¯ç«¯ç‚¹ï¼ˆ`https://mirai.local/v1/chat/completions`ï¼‰å‘é€ç›´æŽ¥çš„ OpenAI å…¼å®¹è¯·æ±‚ã€‚
- `tester/security/test-cloud-sync-and-call.sh`
  - ç«¯åˆ°ç«¯æµç¨‹ï¼šåˆ›å»ºæœ¬åœ°å¯†é’¥ -> å¯ç”¨/åŒæ­¥äº‘ç«¯ -> å¸¦é‡è¯•è°ƒç”¨äº‘ç«¯ç«¯ç‚¹ã€‚
  - åŒ…å«ä½¿ç”¨ `stream` çš„å›žé€€æ£€æŸ¥ï¼Œä»¥åŒºåˆ†è®¤è¯é”™è¯¯å’Œéžæµå¼è§£æžé—®é¢˜ã€‚

äº‘ç«¯æµ‹è¯•è„šæœ¬çš„å®‰å…¨è¯´æ˜Žï¼š

- æ°¸è¿œä¸è¦åœ¨è„šæœ¬/æäº¤ä¸­ç¡¬ç¼–ç çœŸå®žçš„ API å¯†é’¥ã€‚
- ä»…é€šè¿‡çŽ¯å¢ƒå˜é‡æä¾›å¯†é’¥ï¼š
  - `API_KEY`, `CLOUD_API_KEY`, æˆ– `OPENAI_API_KEY`ï¼ˆç”± `test-cloud-openai-compatible.sh` æ”¯æŒï¼‰
- ç¤ºä¾‹ï¼š

```bash
OPENAI_API_KEY="your-cloud-key" bash tester/security/test-cloud-openai-compatible.sh
```

æœ€è¿‘éªŒè¯çš„é¢„æœŸè¡Œä¸ºï¼š

- æœ¬åœ°è¿è¡Œæ—¶ï¼ˆ`http://127.0.0.1:1463/v1/chat/completions`ï¼‰ï¼šä½¿ç”¨ `stream=false` å’Œ `stream=true` éƒ½å¯ä»¥å·¥ä½œã€‚
- Docker è¿è¡Œæ—¶ï¼ˆå®¹å™¨æš´éœ²çš„ç›¸åŒ API è·¯å¾„ï¼‰ï¼šåŠ å›ºæ£€æŸ¥é€šè¿‡ï¼Œäº‘ç«¯è®¤è¯ä¿æŠ¤å·¥ä½œï¼Œå¯ç”¨æ—¶ä¸¥æ ¼ API å¯†é’¥æ¨¡å¼å·¥ä½œã€‚
- å…¬å…±äº‘ç«¯ç«¯ç‚¹ï¼ˆ`https://mirai.local/v1/chat/completions`ï¼‰ï¼š
  - `stream=true`ï¼šé¢„æœŸæˆåŠŸï¼ˆè¿”å›ž SSE å—ï¼‰ã€‚
  - `stream=false`ï¼šå½“ä¸Šæ¸¸å‘éžæµå¼å®¢æˆ·ç«¯è·¯å¾„è¿”å›ž SSE å†…å®¹æ—¶ï¼Œå¯èƒ½å¤±è´¥å¹¶æ˜¾ç¤º `500` + è§£æžé”™è¯¯ï¼ˆ`Unexpected token 'd'`ï¼‰ã€‚

### ä»ªè¡¨æ¿å’Œç®¡ç† API

- è®¤è¯/è®¾ç½®ï¼š`/api/auth/login`, `/api/auth/logout`, `/api/settings`, `/api/settings/require-login`
- æä¾›å•†ç®¡ç†ï¼š`/api/providers`, `/api/providers/[id]`, `/api/providers/[id]/test`, `/api/providers/[id]/models`, `/api/providers/validate`, `/api/provider-nodes*`
- OAuth æµç¨‹ï¼š`/api/oauth/[provider]/[action]`ï¼ˆ+ ç‰¹å®šæä¾›å•†å¯¼å…¥å¦‚ Cursor/Kiroï¼‰
 è·¯ç”±é…ç½®ï¼š`/api/models/alias`, `/api/combos*`, `/api/keys*`, `/api/pricing`
- ä½¿ç”¨/æ—¥å¿—ï¼š`/api/usage/history`, `/api/usage/logs`, `/api/usage/request-logs`, `/api/usage/[connectionId]`
- äº‘ç«¯åŒæ­¥ï¼š`/api/sync/cloud`, `/api/sync/initialize`, `/api/cloud/*`
- CLI åŠ©æ‰‹ï¼š`/api/cli-tools/claude-settings`, `/api/cli-tools/codex-settings`, `/api/cli-tools/droid-settings`, `/api/cli-tools/openaw-settings`

### è®¤è¯è¡Œä¸º

- ä»ªè¡¨æ¿è·¯ç”±ï¼ˆ`/dashboard/*`ï¼‰ä½¿ç”¨ `auth_token` cookie ä¿æŠ¤ã€‚
- ç™»å½•æ—¶å¦‚æžœå­˜åœ¨ä¿å­˜çš„å¯†ç å“ˆå¸Œåˆ™ä½¿ç”¨ï¼›å¦åˆ™å›žé€€åˆ° `INITIAL_PASSWORD`ã€‚
- `requireLogin` å¯ä»¥é€šè¿‡ `/api/settings/require-login` åˆ‡æ¢ã€‚

### è¯·æ±‚å¤„ç†ï¼ˆé«˜çº§ï¼‰

1. å®¢æˆ·ç«¯å‘ `/v1/*` å‘é€è¯·æ±‚ã€‚
2. è·¯ç”±å¤„ç†å™¨è°ƒç”¨ `handleChat`ï¼ˆ`src/sse/handlers/chat.js`ï¼‰ã€‚
3. æ¨¡åž‹è¢«è§£æžç›´æŽ¥æä¾›å•†/æ¨¡åž‹æˆ–åˆ«å/ç»„åˆè§£æžï¼‰ã€‚
4. ä»Žæœ¬åœ°æ•°æ®åº“é€‰æ‹©å‡­æ®ï¼Œå¹¶è¿›è¡Œè´¦æˆ·å¯ç”¨æ€§è¿‡æ»¤ã€‚
5. `handleChatCore`ï¼ˆ`open-sse/handlers/chatCore.js`ï¼‰æ£€æµ‹æ ¼å¼å¹¶è½¬æ¢è¯·æ±‚ã€‚
6. æä¾›å•†æ‰§è¡Œå™¨å‘é€ä¸Šæ¸¸è¯·æ±‚ã€‚
7. éœ€è¦æ—¶å°†æµè½¬æ¢å›žå®¢æˆ·ç«¯æ ¼å¼ã€‚
8. è®°å½•ä½¿ç”¨/æ—¥å¿—ï¼ˆ`src/lib/usageDb.js`ï¼‰ã€‚
9. æ ¹æ®ç»„åˆè§„åˆ™åœ¨æä¾›å•†/è´¦æˆ·/æ¨¡åž‹é”™è¯¯æ—¶åº”ç”¨å›žé€€ã€‚

å®Œæ•´æž¶æž„å‚è€ƒï¼š[`docs/ARCHITECTURE`](../docs/ARCHITECTURE.md)

---

## ðŸ“§ æ”¯æŒ

- **ç½‘ç«™**ï¼š[mirai.local](https://mirai.local)
- **GitHub**ï¼š[github.com/decolua/mirai](https://github.com/decolua/mirai)
- **é—®é¢˜**ï¼š[github.com/decolua/mirai/issues](https://github.com/decolua/mirai/issues)

---

## ðŸ‘¥ è´¡çŒ®è€…

æ„Ÿè°¢æ‰€æœ‰å¸®åŠ©è®© Mirai å˜å¾—æ›´å¥½çš„è´¡çŒ®è€…ï¼

[![Contributors](https://contrib.rocks/image?repo=decolua/mirai&max=100&columns=20&anon=1)](https://github.com/decolua/mirai/graphs/contributors)

---

## ðŸ“Š Star å›¾è¡¨

[![Star Chart](https://starchart.cc/decolua/mirai.svg?variant=adaptive)](https://starchart.cc/decolua/mirai)

### å¦‚ä½•è´¡çŒ®

1. Fork ä»“åº“
2. åˆ›å»ºæ‚¨çš„åŠŸèƒ½åˆ†æ”¯ï¼ˆ`git checkout -b feature/amazing-feature`ï¼‰
3. æäº¤æ‚¨çš„æ›´æ”¹ï¼ˆ`git commit -m 'Add amazing feature'`ï¼‰
4 æŽ¨é€åˆ°åˆ†æ”¯ï¼ˆ`git push origin feature/amazing-feature`ï¼‰
5. æ‰“å¼€ Pull Request

è¯¦ç»†æŒ‡å—è¯·å‚é˜… [Pull Requests](https://github.com/decolua/mirai/pulls)ã€‚

---

## ðŸ”€ åˆ†æ”¯

**[OmniRoute](https://github.com/diegosouzapw/OmniRoute)** â€” Mirai çš„å…¨åŠŸèƒ½ TypeScript åˆ†æ”¯ã€‚æ·»åŠ äº† 36+ æä¾›å•†ã€4 å±‚è‡ªåŠ¨å›žé€€ã€å¤šæ¨¡æ€ APIï¼ˆå›¾åƒã€åµŒå…¥ã€éŸ³é¢‘ã€TTSï¼‰ã€ç†”æ–­å™¨ã€è¯­ä¹‰ç¼“å­˜ã€LLM è¯„ä¼°å’Œç²¾ç¾Žçš„ä»ªè¡¨æ¿ã€‚8+ å•å…ƒæµ‹è¯•ã€‚é€šè¿‡ npm å’Œ Docker å¯ç”¨ã€‚

---

## ðŸ™ è‡´è°¢

ç‰¹åˆ«æ„Ÿè°¢ **CLIProxyAPI** - å¯å‘è¿™ä¸ª JavaScript ç§»æ¤çš„åŽŸå§‹ Go å®žçŽ°ã€‚

---

## ðŸ“„ è®¸å¯è¯

MIT License - è¯¦æƒ…è¯·å‚é˜… [LICENSE](../LICENSE)ã€‚

---

<div align="center">
  <sub>ç”¨ â¤ï¸ ä¸º 24/7 ç¼–ç¨‹çš„å¼€å‘è€…æž„å»º</sub>
</div>
