#!/usr/bin/env node

// Postinstall: warm-up SQLite deps into ~/.mirai/runtime so the first
// `mirai` start doesn't need network. Failure here is non-fatal —
// cli.js will retry at runtime if anything is missing.
// `npx mirai …` (npm_command=exec) is typically a one-shot `connect` — skip
// the runtime warm-up; cli.js self-heals it if the server is started later.
if (process.env.npm_command === "exec") process.exit(0);

const { ensureSqliteRuntime } = require("./sqliteRuntime");
const { ensureTrayRuntime } = require("./trayRuntime");

try {
  ensureSqliteRuntime({ silent: false });
  console.log("[mirai] runtime SQLite deps ready");
} catch (e) {
  console.warn(`[mirai] runtime warm-up skipped: ${e.message}`);
}

try {
  ensureTrayRuntime({ silent: false });
} catch (e) {
  console.warn(`[mirai] tray runtime skipped: ${e.message}`);
}

process.exit(0);
