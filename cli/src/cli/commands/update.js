/**
 * `mirai update` — pull the latest code from GitHub, reinstall dependencies,
 * rebuild the production bundle and restart Mirai.
 *
 * The actual work is done by `update.sh` (Linux/macOS) or `update.cmd`
 * (Windows), which live in the repository root next to `install.sh`. Keeping
 * the logic there means the CLI and a manual `./update.sh` can never diverge —
 * this command only locates and runs the right script.
 *
 * Flags:
 *   mirai update              update, rebuild, restart
 *   mirai update --check      report whether an update is available (no change)
 *   mirai update --no-restart pull + build only
 *   mirai update --no-build   pull + install deps only
 *   mirai update --force-install   always run npm install
 *   mirai update --yes        non-interactive; discard local changes
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const HELP = `
Usage: mirai update [options]

Fetch the latest Mirai from GitHub, reinstall dependencies, rebuild, and
restart the server. Your .env and data directory are never touched.

Options:
  --check            Only report whether an update is available
  --no-restart       Do not restart Mirai after updating
  --no-build         Skip the production build
  --force-install    Always run npm install
  --yes, -y          Non-interactive (discard local uncommitted changes)
  --branch <ref>     Git ref to follow   (default: current branch / main)
  -h, --help         Show this help
`;

/** Walk up from this file to find the repo root (the dir holding update.sh). */
function findRepoRoot() {
  const candidates = [];
  if (process.env.MIRAI_INSTALL_DIR) candidates.push(process.env.MIRAI_INSTALL_DIR);
  if (process.argv[1]) candidates.push(path.dirname(path.resolve(process.argv[1])));

  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    candidates.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(process.cwd());

  for (const root of candidates) {
    if (!root) continue;
    const sh = path.join(root, "update.sh");
    const cmd = path.join(root, "update.cmd");
    if (fs.existsSync(sh) || fs.existsSync(cmd)) return root;
  }
  return null;
}

function runUpdate(argv) {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return Promise.resolve(0);
  }

  const root = findRepoRoot();
  if (!root) {
    console.error("❌ Could not find update.sh / update.cmd in this checkout.");
    console.error("   Reinstall Mirai with install.sh (or run ./update.sh from the repo root).");
    return Promise.resolve(1);
  }

  const isWin = process.platform === "win32";
  const script = path.join(root, isWin ? "update.cmd" : "update.sh");

  if (!fs.existsSync(script)) {
    console.error(`❌ Update script not found: ${script}`);
    console.error(`   Your checkout may be outdated. Run the installer again to refresh it.`);
    return Promise.resolve(1);
  }

  const passthrough = argv.filter((a) => a !== "--yes" && a !== "-y");
  const result = isWin
    ? spawnSync("cmd.exe", ["/c", script, ...passthrough], { stdio: "inherit", cwd: root })
    : spawnSync("bash", [script, ...passthrough], { stdio: "inherit", cwd: root });

  if (result.error) {
    console.error(`❌ Failed to run ${path.basename(script)}: ${result.error.message}`);
    return Promise.resolve(1);
  }
  return Promise.resolve(result.status == null ? 1 : result.status);
}

module.exports = { runUpdate, findRepoRoot, HELP };
