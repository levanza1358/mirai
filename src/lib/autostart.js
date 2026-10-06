import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Shared, web-safe autostart core.
 *
 * Historically this logic lived only inside the CLI tray helper
 * (`cli/src/cli/tray/autostart.js`) and was reachable exclusively from the
 * desktop tray menu. The dashboard Settings page needs the exact same
 * capability, so the platform implementations were extracted here:
 *
 *   - Linux   → `systemd --user` unit + `loginctl enable-linger`, so Mirai
 *               boots with the machine even on a headless server with no
 *               desktop session (`~/.config/autostart/*.desktop` is only
 *               honoured by a GUI session, which is why the old helper
 *               refused to run without `$DISPLAY`).
 *   - Windows → a hidden `mirai.vbs` in the per-user Startup folder.
 *   - macOS   → NOT handled here; the launchd agent needs the `launchctl`
 *               unload/load dance that already lives in the CLI helper.
 *
 * Everything is user-scoped (no sudo): systemd --user units, `loginctl
 * enable-linger` without arguments, and files under the user's home/config.
 */

export const APP_NAME = "mirai";
const SYSTEMD_UNIT = "mirai.service";
const LAUNCH_AGENT_LABEL = "com.mirai.autostart";
const LAUNCH_AGENT_PLIST = `${LAUNCH_AGENT_LABEL}.plist`;

function run(cmd, args, opts = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: opts.timeout ?? 5000,
        windowsHide: true,
      }),
    };
  } catch (err) {
    return { ok: false, error: err, stdout: err?.stdout ? String(err.stdout) : "" };
  }
}

function hasCommand(cmd) {
  // `command -v` is a shell builtin — invoke it through `sh -c` for the linux
  // path. On Windows `where` is a real executable.
  if (process.platform === "win32") return run("where", [cmd]).ok;
  return run("sh", ["-c", `command -v ${cmd}`]).ok;
}

/**
 * Reject file paths that would break a unit file / shell quoting. Mirrors
 * create-systemd-unit semantics: paths are quoted but embedder-controlled, so
 * we refuse the couple of characters that can escape a quoted string.
 */
function assertSafePath(value, label) {
  if (!value || typeof value !== "string") throw new Error(`${label} is not set`);
  if (/[\n\r\0]/.test(value)) throw new Error(`${label} contains an illegal character`);
  return value;
}

// ============ Platform capability matrix ============

/**
 * Which platforms can be driven by the dashboard.
 *   - linux:  managed here (systemd --user)
 *   - win32:  managed here (Startup folder)
 *   - darwin: managed by the CLI tray helper; the dashboard can only read state
 */
export function getPlatformSupport() {
  const platform = process.platform;
  const supported = ["linux", "win32", "darwin"].includes(platform);
  let mechanism = null;
  if (platform === "linux") mechanism = "systemd --user";
  else if (platform === "win32") mechanism = "Startup folder";
  else if (platform === "darwin") mechanism = "launchd agent";

  return {
    platform,
    supported,
    mechanism,
    // Whether the dashboard can toggle it. macOS = read-only (tray-owned).
    manageable: platform === "linux" || platform === "win32",
  };
}

// ============ Linux (systemd --user) ============

function systemdUserDir() {
  const base =
    process.env.XDG_CONFIG_HOME && path.isAbsolute(process.env.XDG_CONFIG_HOME)
      ? process.env.XDG_CONFIG_HOME
      : path.join(os.homedir(), ".config");
  return { base, dir: path.join(base, "systemd", "user") };
}

function systemdUnitPath() {
  return path.join(systemdUserDir().dir, SYSTEMD_UNIT);
}

function unitFilePath(file) {
  // systemd wants an absolute path; if it has spaces, quote it.
  return /\s/.test(file) ? `"${file}"` : file;
}

function quoteEnv(value) {
  const s = String(value ?? "");
  // systemd Environment= uses shell-like quoting; escape the rare baddies.
  return `"${s.replace(/(["\\$])/g, "\\$1")}"`;
}

/**
 * Build the unit file contents.
 *
 * @param {object} opts
 * @param {string} opts.command  Absolute path to the executable to run.
 * @param {string[]} [opts.args] Arguments passed to the executable.
 * @param {string} [opts.cwd]    Working directory (server root).
 * @param {Record<string,string>} [opts.env] Extra environment variables.
 * @param {string} [opts.description]
 */
export function buildSystemdUnit(opts) {
  const command = assertSafePath(opts?.command, "command");
  const args = Array.isArray(opts?.args) ? opts.args : [];
  const env = opts?.env && typeof opts.env === "object" ? opts.env : {};

  const nodeBinDir = path.dirname(command);
  const envLines = [
    `Environment="PATH=${nodeBinDir}:/usr/local/bin:/usr/bin:/bin"`,
    ...Object.entries(env)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `Environment=${k}=${quoteEnv(v)}`),
  ];

  return [
    "[Unit]",
    `Description=${opts?.description || "Mirai — local AI API proxy"}`,
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${[command, ...args].map(unitFilePath).join(" ")}`,
    opts?.cwd ? `WorkingDirectory=${unitFilePath(opts.cwd)}` : null,
    ...envLines,
    "Restart=on-failure",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function enableLinuxSystemd({ command, args, cwd, env }) {
  const { dir } = systemdUserDir();
  fs.mkdirSync(dir, { recursive: true });
  const unitPath = systemdUnitPath();
  fs.writeFileSync(unitPath, buildSystemdUnit({ command, args, cwd, env }), "utf-8");

  const hasSystemctl = hasCommand("systemctl");

  // Never leave `linger` disabled on a headless box: without it the user
  // manager is torn down when the last SSH session closes, so the service
  // stops on logout. Enable it opportunistically and keep going if it fails
  // (it may be policy-blocked on shared hosts).
  if (hasCommand("loginctl")) {
    run("loginctl", ["enable-linger"]);
  }

  if (hasSystemctl) {
    // Reload picks up the new/changed unit; `enable --now` both arms it for
    // boot and starts it immediately.
    run("systemctl", ["--user", "daemon-reload"]);
    const enable = run("systemctl", ["--user", "enable", "--now", SYSTEMD_UNIT]);
    if (!enable.ok) {
      // Some minimal containers lack a usable user bus. The unit is still on
      // disk for the next real login; report the raw reason for the UI.
      return {
        ok: true,
        mechanism: "systemd --user",
        warning: `Unit written but \`systemctl --user enable\` failed: ${
          enable.error?.message || "unknown error"
        }. The unit will be picked up on the next session.`,
        unitPath,
        startedNow: false,
      };
    }
    run("systemctl", ["--user", "restart", SYSTEMD_UNIT]);
    return { ok: true, mechanism: "systemd --user", unitPath, startedNow: true };
  }

  return {
    ok: true,
    mechanism: "systemd --user",
    warning: "systemctl not found — unit file written to disk only.",
    unitPath,
    startedNow: false,
  };
}

function disableLinuxSystemd() {
  const hasSystemctl = hasCommand("systemctl");
  if (hasSystemctl) {
    run("systemctl", ["--user", "stop", SYSTEMD_UNIT]);
    run("systemctl", ["--user", "disable", SYSTEMD_UNIT]);
  }

  const unitPath = systemdUnitPath();
  let removed = false;
  try {
    if (fs.existsSync(unitPath)) {
      fs.unlinkSync(unitPath);
      removed = true;
    }
  } catch {
    /* ignore */
  }
  if (hasSystemctl) run("systemctl", ["--user", "daemon-reload"]);

  // Linger is intentionally NOT disabled: other user services may rely on it,
  // and leaving it on is harmless for a machine the user just set up to
  // autostart Mirai.
  return { ok: true, mechanism: "systemd --user", removed, unitPath };
}

function linuxStatus() {
  const unitPath = systemdUnitPath();
  const unitExists = fs.existsSync(unitPath);

  let systemdEnabled = false;
  let systemdActive = false;
  if (unitExists && hasCommand("systemctl")) {
    systemdEnabled = run("systemctl", ["--user", "is-enabled", SYSTEMD_UNIT]).stdout.trim() === "enabled";
    systemdActive = run("systemctl", ["--user", "is-active", SYSTEMD_UNIT]).stdout.trim() === "active";
  }

  // A leftover legacy desktop entry from the old tray-based helper also counts.
  const legacyPath = path.join(os.homedir(), ".config", "autostart", `${APP_NAME}.desktop`);
  const legacyExists = fs.existsSync(legacyPath);

  return {
    enabled: unitExists,
    active: systemdActive,
    systemdEnabled,
    legacyDesktopEntry: legacyExists,
    unitPath,
    mechanism: "systemd --user",
  };
}

// ============ Windows (Startup folder) ============

function windowsStartupDir() {
  const appData =
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

function windowsVbsPath() {
  return path.join(windowsStartupDir(), `${APP_NAME}.vbs`);
}

function enableWindows({ command, args }) {
  const dir = windowsStartupDir();
  if (!fs.existsSync(dir)) {
    return { ok: false, mechanism: "Startup folder", error: `Startup folder not found: ${dir}` };
  }

  // VBScript escapes a double quote by doubling it.
  const quote = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const cmdline = [command, ...(args || [])].map(quote).join(" ");
  // ASCII only: Windows Script Host reads .vbs as ANSI unless a BOM is present,
  // so non-ASCII (em dashes, etc.) would render as mojibake.
  const vbs = `' Mirai autostart - generated by the dashboard Settings page. Delete to disable.\r\nSet WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run ${quote(cmdline)}, 0, False\r\n`;
  fs.writeFileSync(windowsVbsPath(), vbs, "utf-8");

  return { ok: true, mechanism: "Startup folder", vbsPath: windowsVbsPath() };
}

function disableWindows() {
  const vbsPath = windowsVbsPath();
  let removed = false;
  if (fs.existsSync(vbsPath)) {
    try {
      fs.unlinkSync(vbsPath);
      removed = true;
    } catch {
      /* ignore */
    }
  }
  return { ok: true, mechanism: "Startup folder", removed, vbsPath };
}

function windowsStatus() {
  const vbsPath = windowsVbsPath();
  return { enabled: fs.existsSync(vbsPath), vbsPath, mechanism: "Startup folder" };
}

// ============ macOS (read-only from the dashboard) ============

function macStatus() {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", LAUNCH_AGENT_PLIST);
  return {
    enabled: fs.existsSync(plistPath),
    plistPath,
    mechanism: "launchd agent",
  };
}

// ============ Public API ============

/**
 * Enable autostart for the current user.
 *
 * @param {object} opts
 * @param {string} opts.command        Absolute executable path (usually process.execPath).
 * @param {string[]} opts.args         Arguments (e.g. ["/path/cli.js"]).
 * @param {string} [opts.cwd]          Working directory (server root).
 * @param {Record<string,string>} [opts.env]
 * @returns {{ok:boolean, mechanism?:string, warning?:string, error?:string}}
 */
export function enableAutoStart(opts) {
  const platform = process.platform;
  try {
    if (platform === "linux") return enableLinuxSystemd(opts || {});
    if (platform === "win32") return enableWindows(opts || {});
    if (platform === "darwin") {
      return {
        ok: false,
        mechanism: "launchd agent",
        error: "macOS autostart is managed by the Mirai tray helper, not the dashboard.",
      };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
  return { ok: false, error: `Unsupported platform: ${platform}` };
}

export function disableAutoStart() {
  const platform = process.platform;
  try {
    if (platform === "linux") return disableLinuxSystemd();
    if (platform === "win32") return disableWindows();
    if (platform === "darwin") {
      return {
        ok: false,
        mechanism: "launchd agent",
        error: "macOS autostart is managed by the Mirai tray helper, not the dashboard.",
      };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
  return { ok: false, error: `Unsupported platform: ${platform}` };
}

export function getAutoStartStatus() {
  const support = getPlatformSupport();
  let details = {};
  try {
    if (process.platform === "linux") details = linuxStatus();
    else if (process.platform === "win32") details = windowsStatus();
    else if (process.platform === "darwin") details = macStatus();
  } catch {
    /* keep details empty */
  }
  return { ...support, ...details, enabled: details.enabled === true };
}
