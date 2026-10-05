# Mirai - FREE AI Router & Token Saver

**Never stop coding. Save 20-40% tokens with RTK + auto-fallback to FREE & cheap AI models.**

**Connect All AI Code Tools (Claude Code, Cursor, Antigravity, Copilot, Codex, Gemini, OpenCode, Cline, OpenClaw...) to 40+ AI Providers & 100+ Models.**

[![npm](https://img.shields.io/npm/v/mirai.svg)](https://www.npmjs.com/package/mirai)
[![Downloads](https://img.shields.io/npm/dm/mirai.svg)](https://www.npmjs.com/package/mirai)
[![Docker Pulls](https://img.shields.io/docker/pulls/decolua/mirai.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/decolua/mirai)
[![GHCR](https://img.shields.io/badge/GHCR-decolua%2Fmirai-blue?logo=github)](https://github.com/decolua/mirai/pkgs/container/mirai)
[![License](https://img.shields.io/npm/l/mirai.svg)](https://github.com/decolua/mirai/blob/main/LICENSE)

<a href="https://trendshift.io/repositories/22628" target="_blank"><img src="https://trendshift.io/api/badge/repositories/22628" alt="decolua%2Fmirai | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

[🌐 Website](https://mirai.local) • [📖 Full Docs](https://github.com/decolua/mirai)

---

## 🤔 Why Mirai?

**Stop wasting money, tokens and hitting limits:**

- ❌ Subscription quota expires unused every month
- ❌ Rate limits stop you mid-coding
- ❌ Tool outputs (git diff, grep, ls...) burn tokens fast
- ❌ Expensive APIs ($20-50/month per provider)

**Mirai solves this:**

- ✅ **RTK Token Saver** - Auto-compress tool_result, save 20-40% tokens
- ✅ **Maximize subscriptions** - Track quota, use every bit before reset
- ✅ **Auto fallback** - Subscription → Cheap → Free, zero downtime
- ✅ **Multi-account** - Round-robin between accounts per provider
- ✅ **Universal** - Works with any OpenAI/Claude-compatible CLI

---

## ⚡ Quick Start

**Option 1 — npm (recommended for desktop):**

```bash
npm install -g mirai
mirai

# Or run directly with npx
npx mirai
```

**Option 2 — Docker (server/VPS):**

```bash
docker run -d --name mirai -p 1463:1463 \
  -v "$HOME/.mirai:/app/data" -e DATA_DIR=/app/data \
  decolua/mirai:latest
```

Published images: [Docker Hub](https://hub.docker.com/r/decolua/mirai) • [GHCR](https://github.com/decolua/mirai/pkgs/container/mirai) (multi-platform amd64/arm64).

🎉 Dashboard opens at `http://localhost:1463`

**2. Connect a FREE provider (no signup needed):**

Dashboard → Providers → Connect **Kiro AI** (free Claude unlimited) or **OpenCode Free** (no auth) → Done!

**3. Use in your CLI tool:**

```
Claude Code/Codex/OpenClaw/Cursor/Cline Settings:
  Endpoint: http://localhost:1463/v1
  API Key:  [copy from dashboard]
  Model:    kr/claude-sonnet-4.5
```

That's it! Start coding with FREE AI models.

---

## 🚀 CLI Options

```bash
mirai                    # Start with default settings (port 1463)
mirai start              # Explicit start
mirai --port 8080        # Custom port
mirai --no-browser       # Don't open browser
mirai --help             # Show all options
```

### Commands

```bash
mirai restart              # Restart on the current (remembered) port
mirai restart --port 8080  # Restart on a specific port
mirai connect <server-url> # Point local CLI tools at a remote Mirai
```

**Dashboard**: `http://localhost:1463/dashboard`

### Changing the server port

Mirai runs on `localhost:1463` by default. Change it from the dashboard (**Settings → Server Port**) or the CLI — the new port is only applied after Mirai **tests that it's free**:

1. The port is written to `~/.mirai/config/port.json` (`%APPDATA%/mirai/config/port.json` on Windows).
2. Mirai restarts on the new port (or refuses the change if the port is in use).

Resolution order: `PORT` env → `config/port.json` → default `1463`. Port `20129` is reserved for internal use.

> **From a source checkout** you can use the bundled launchers `./mirai` (bash) or `.\mirai.cmd` (Windows) — e.g. `.\mirai restart` — no global install required.

---

## 🔌 Connect to a Remote Mirai

Already running Mirai on another machine (e.g. a team server on your LAN)? Point this machine's CLI tools at it — no local server is started:

```bash
npx mirai connect http://<server-host>:1463                       # pick tools interactively
npx mirai connect http://<server-host>:1463 --tools claude,codex  # or choose up front
npx mirai connect --reset --tools claude,codex                     # undo
```

It logs in with the dashboard password (hidden prompt), reuses or creates an API key named `cli-<hostname>`, and writes each tool's config (backing up the original once as `*.bak-mirai`).

Supported: `claude`, `codex`, `opencode`, `droid`, `crush`, `kilo`, `cline`, or `all`. Other options: `--model`, `--opus/--sonnet/--haiku/--fable`, `--api-key`, `--key-name`, `--print-env`. See `mirai connect --help`.

> ⚠️ Over plain `http://` the password and API key are sent unencrypted — use a trusted LAN/VPN or put HTTPS in front. The API key is stored in each tool's config file.

---

## 🛠️ Supported CLI Tools

Claude-Code • OpenClaw • Codex • OpenCode • Cursor • Antigravity • Cline • Continue • Droid • Roo • Copilot • Kilo Code • Gemini CLI • Qwen Code • iFlow • Crush • Crusher • Aider

Any tool supporting OpenAI/Claude-compatible API works.

---

## 💾 Data Location

- **macOS/Linux**: `~/.mirai/db/data.sqlite`
- **Windows**: `%APPDATA%/mirai/db/data.sqlite`
- **Docker**: `/app/data/db/data.sqlite` (mount `$HOME/.mirai` to persist)

Server port override: `~/.mirai/config/port.json` (`%APPDATA%/mirai/config/port.json` on Windows).

---

## 📚 Documentation

Full docs, advanced setup, video tutorials & development guide:

- **GitHub**: https://github.com/decolua/mirai
- **Full README**: https://github.com/decolua/mirai/blob/master/README.md
- **Website**: https://mirai.local

---

## 🙏 Acknowledgments

- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** - Original Go implementation

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
