const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

/**
 * Shared autostart core (CommonJS).
 *
 * This is the single source of truth for *how* Mirai registers itself to start
 * on boot. Two callers use it:
 *
 *   1. The CLI / tray  → `cli/src/cli/tray/autostart.js` (requires this file
 *      directly so a standalone CLI build still works without the src/ tree).
 *   2. The dashboard   → `src/lib/autostart.js` (ESM) which re-implements the
 *      same contract for Next.js. The two files are intentionally kept in
 *      lock-step; the platform behaviour (systemd --user on Linux, Startup
 *      folder on Windows, launchd on macOS) must match.
 *
 * User-scoped only: no sudo, no machine-wide changes.
 */

const APP_NAME = "mirai";
const SYSTEMD_UNIT = "mirai.service";
const LAUNCH_AGENT_LABEL = "com.mirai.autostart";

/** Run a command, never throw. */
function run(cmd, args, opts = {}) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: opts.timeout || 5000,
        windowsHide: true,
      }),
    };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function hasCommand(cmd) {
  if (process.platform === "win32") return run("where", [cmd]).ok;
  return run("sh", ["-c", `command -v ${cmd}`]).ok;
}

function assertSafePath(value, label) {
  if (!value || typeof value !== "string") throw new Error(`${label} is not set`);
  if (/[\n\r\0]/.test(value)) throw new Error(`${label} contains an illegal character`);
  return value;
}

// ============ Linux (systemd --user) ============

function systemdUserDir() {
  const base =
    process.env.XDG_CONFIG_HOME && path.isAbsolute(process.env.XDG_CONFIG_HOME)
      ? process.env.XDG_CONFIG_HOME
      : path.join(os.homedir(), ".config");
  return path.join(base, "systemd", "user");
}

function systemdUnitPath() {
  return path.join(systemdUserDir(), SYSTEMD_UNIT);
}

function unitFilePath(file) {
  return /\s/.test(file) ? `"${file}"` : file;
}

function quoteEnv(value) {
  return `"${String(value == null ? "" : value).replace(/(["\\$])/g, "\\$1")}"`;
}

function buildSystemdUnit(opts) {
  const command = assertSafePath(opts && opts.command, "command");
  const args = Array.isArray(opts && opts.args) ? opts.args : [];
  const env = (opts && opts.env) || {};
  const nodeBinDir = path.dirname(command);

  const lines = [
    "[Unit]",
    `Description=${(opts && opts.description) || "Mirai — local AI API proxy"}`,
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${[command].concat(args).map(unitFilePath).join(" ")}`,
  ];
  if (opts && opts.cwd) lines.push(`WorkingDirectory=${unitFilePath(opts.cwd)}`);
  lines.push(`Environment="PATH=${nodeBinDir}:/usr/local/bin:/usr/bin:/bin"`);
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`Environment=${key}=${quoteEnv(value)}`);
  }
  lines.push("Restart=on-failure", "RestartSec=5", "", "[Install]", "WantedBy=default.target", "");
  return lines.join("\n");
}

function enableLinux(opts) {
  const dir = systemdUserDir();
  fs.mkdirSync(dir, { recursive: true });
  const unitPath = systemdUnitPath();
  fs.writeFileSync(unitPath, buildSystemdUnit(opts), "utf-8");

  const hasSystemctl = hasCommand("systemctl");

  // Headless servers need lingering: without it `systemd --user` is torn down
  // when the last SSH session closes. Best-effort — some hosts block it.
  if (hasCommand("loginctl")) run("loginctl", ["enable-linger"]);

  if (!hasSystemctl) {
    return { ok: true, mechanism: "systemd --user", unitPath, warning: "systemctl not found — unit written to disk only." };
  }

  run("systemctl", ["--user", "daemon-reload"]);
  const enabled = run("systemctl", ["--user", "enable", "--now", SYSTEMD_UNIT]);
  if (!enabled.ok) {
    return {
      ok: true,
      mechanism: "systemd --user",
      unitPath,
      warning: "Unit written, but `systemctl --user enable` failed; it will load on next session.",
    };
  }
  run("systemctl", ["--user", "restart", SYSTEMD_UNIT]);
  return { ok: true, mechanism: "systemd --user", unitPath };
}

function disableLinux() {
  if (hasCommand("systemctl")) {
    run("systemctl", ["--user", "stop", SYSTEMD_UNIT]);
    run("systemctl", ["--user", "disable", SYSTEMD_UNIT]);
  }
  const unitPath = systemdUnitPath();
  try {
    if (fs.existsSync(unitPath)) fs.unlinkSync(unitPath);
  } catch (e) {
    /* ignore */
  }
  if (hasCommand("systemctl")) run("systemctl", ["--user", "daemon-reload"]);
  return { ok: true, mechanism: "systemd --user", unitPath };
}

function linuxStatus() {
  const unitPath = systemdUnitPath();
  const unitExists = fs.existsSync(unitPath);
  let active = false;
  if (unitExists && hasCommand("systemctl")) {
    active = run("systemctl", ["--user", "is-active", SYSTEMD_UNIT]).stdout?.trim() === "active";
  }
  // Legacy entry written by older tray-based Mirai versions.
  const legacyPath = path.join(os.homedir(), ".config", "autostart", `${APP_NAME}.desktop`);
  return {
    enabled: unitExists,
    active,
    legacyDesktopEntry: fs.existsSync(legacyPath),
    unitPath,
    mechanism: "systemd --user",
  };
}

// ============ Windows (Startup folder) ============

function windowsStartupDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

function windowsVbsPath() {
  return path.join(windowsStartupDir(), `${APP_NAME}.vbs`);
}

function enableWindows(opts) {
  const dir = windowsStartupDir();
  if (!fs.existsSync(dir)) return { ok: false, mechanism: "Startup folder", error: `Startup folder not found: ${dir}` };

  const quote = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const cmdline = [opts.command].concat(opts.args || []).map(quote).join(" ");
  // ASCII only: Windows Script Host reads .vbs as ANSI unless a BOM is present,
  // so non-ASCII (em dashes, etc.) would render as mojibake.
  const vbs =
    "' Mirai autostart - generated by the dashboard Settings page. Delete to disable.\r\n" +
    'Set WshShell = CreateObject("WScript.Shell")\r\n' +
    `WshShell.Run ${quote(cmdline)}, 0, False\r\n`;
  fs.writeFileSync(windowsVbsPath(), vbs, "utf-8");
  return { ok: true, mechanism: "Startup folder", vbsPath: windowsVbsPath() };
}

function disableWindows() {
  const vbsPath = windowsVbsPath();
  try {
    if (fs.existsSync(vbsPath)) fs.unlinkSync(vbsPath);
  } catch (e) {
    /* ignore */
  }
  return { ok: true, mechanism: "Startup folder", vbsPath };
}

function windowsStatus() {
  return { enabled: fs.existsSync(windowsVbsPath()), vbsPath: windowsVbsPath(), mechanism: "Startup folder" };
}

module.exports = {
  APP_NAME,
  SYSTEMD_UNIT,
  LAUNCH_AGENT_LABEL,
  buildSystemdUnit,
  enableLinux,
  disableLinux,
  linuxStatus,
  enableWindows,
  disableWindows,
  windowsStatus,
};
