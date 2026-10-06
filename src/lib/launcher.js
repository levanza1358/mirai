import fs from "node:fs";
import path from "node:path";

/**
 * Resolve the command that the OS autostart entry should launch — i.e. the
 * Mirai CLI launcher, which in turn starts the standalone server with the
 * right runtime env and tray/background mode.
 *
 * Preference order (first existing wins):
 *   1. `<MIRAI_INSTALL_DIR>/cli/cli.js` — an explicit checkout root, or the
 *      repo root inferred from the server's own CWD/entry path. In a source
 *      checkout (`git clone` + `install.sh`) this is the canonical launcher.
 *   2. `cli/cli.js` under `process.cwd()` — covers a standalone build whose
 *      CWD is the install root.
 *   3. The globally installed `mirai` launcher on PATH (npm global install).
 *
 * Returns `{ command, args, cwd, source }` or `null` when nothing is found.
 * Never throws.
 */
export function resolveLauncher() {
  const node = process.execPath;

  const candidates = [];
  if (process.env.MIRAI_INSTALL_DIR) candidates.push(process.env.MIRAI_INSTALL_DIR);

  // The server entry (`process.argv[1]`) in a standalone build lives inside
  // `<root>/.next/standalone/...`; walk up to find a `cli/cli.js` sibling.
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (entry) {
    let dir = path.dirname(entry);
    for (let i = 0; i < 6; i += 1) {
      candidates.push(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  candidates.push(process.cwd());

  const seen = new Set();
  for (const root of candidates) {
    if (!root || seen.has(root)) continue;
    seen.add(root);
    const cli = path.join(root, "cli", "cli.js");
    try {
      if (fs.existsSync(cli) && fs.statSync(cli).isFile()) {
        return { command: node, args: [cli, "--tray"], cwd: root, source: "source-checkout" };
      }
    } catch {
      /* keep looking */
    }
  }

  // Global `mirai` on PATH (installed via `npm i -g mirai`).
  const binDirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const names = process.platform === "win32" ? ["mirai.cmd", "mirai"] : ["mirai"];
  for (const dir of binDirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          return { command: full, args: ["--tray"], cwd: dir, source: "global-cli" };
        }
      } catch {
        /* keep looking */
      }
    }
  }

  return null;
}

/**
 * Runtime env that the autostart entry must carry so the booted instance lands
 * in the same data dir / port as the dashboard it was enabled from.
 */
export function buildLauncherEnv() {
  const env = {};
  for (const key of ["DATA_DIR", "MIRAI_DATA_DIR", "PORT", "HOSTNAME", "MIRAI_HOST", "NODE_ENV"]) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      env[key] = String(value);
    }
  }
  return env;
}
