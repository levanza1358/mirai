const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const core = require("./autostartCore");

const APP_NAME = core.APP_NAME;
const APP_LABEL = core.LAUNCH_AGENT_LABEL;

/**
 * Resolve the absolute path to this package's cli.js.
 *
 * Order of preference:
 *   1. Explicit `cliPath` argument — cleanest, used when called from running
 *      cli.js with `__filename`.
 *   2. `process.argv[1]` if it's our cli.js — true when mirai is currently
 *      running and the tray menu fires this code path.
 *   3. Compute relative to this file's own location. autostart.js lives at
 *      `<pkg>/src/cli/tray/autostart.js`, so cli.js is three levels up.
 *      This works for any global install layout (nvm, Volta, asdf, Homebrew,
 *      /usr/local, etc.) without depending on `npm bin -g` (removed in npm 9)
 *      or a hardcoded `/usr/local/...` path.
 *
 * Returns null if no candidate exists — callers should not write an autostart
 * entry pointing at a non-existent script.
 */
function getCliJsPath(cliPath) {
  if (cliPath) {
    const resolved = path.resolve(cliPath);
    if (fs.existsSync(resolved)) return resolved;
  }
  if (process.argv[1]) {
    const resolved = path.resolve(process.argv[1]);
    if (path.basename(resolved) === "cli.js" && fs.existsSync(resolved)) {
      return resolved;
    }
  }
  const computed = path.resolve(__dirname, "..", "..", "..", "cli.js");
  if (fs.existsSync(computed)) return computed;
  return null;
}

/**
 * Enable auto startup on OS boot.
 *
 * Linux and Windows delegate to the shared core (`autostartCore.js`) so the
 * tray and the dashboard Settings page produce identical registrations.
 * Linux no longer refuses to run when `$DISPLAY` is missing: the core writes a
 * `systemd --user` unit (+ linger), which is exactly what a headless server
 * needs and what the dashboard toggle exposes.
 *
 * macOS keeps its launchd implementation below because it needs the
 * `launchctl` unload/load dance (and the self-SIGTERM guard) that the shared
 * core deliberately does not own.
 *
 * @param {string} cliPath - Optional path to cli.js (defaults to auto-detect)
 * @returns {boolean} success
 */
function enableAutoStart(cliPath) {
  const platform = process.platform;

  if (!["darwin", "win32", "linux"].includes(platform)) return false;

  try {
    if (platform === "darwin") return enableMacOS(cliPath);

    const routerScript = getCliJsPath(cliPath);
    // Don't write a registration pointing at a non-existent script.
    if (!routerScript) return false;

    const result = core[platform === "win32" ? "enableWindows" : "enableLinux"]({
      command: process.execPath,
      args: [routerScript, "--tray"],
    });
    return result.ok === true;
  } catch (err) {
    // Silent fail — autostart is optional
  }
  return false;
}

/**
 * Disable auto startup
 * @returns {boolean} success
 */
function disableAutoStart() {
  const platform = process.platform;
  try {
    if (platform === "darwin") return disableMacOS();
    if (platform === "win32") return core.disableWindows().ok === true;
    if (platform === "linux") return core.disableLinux().ok === true;
  } catch (err) {}
  return false;
}

/**
 * Check if autostart is enabled.
 *
 * On macOS, both the plist file and the launchd registration must be present —
 * otherwise the tray menu would lie about the state (showing "✓ Enabled" even
 * when launchd has the agent in a failed state or hasn't loaded it).
 */
function isAutoStartEnabled() {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${APP_LABEL}.plist`);
      if (!fs.existsSync(plistPath)) return false;
      try {
        execSync(`launchctl list ${APP_LABEL}`, {
          stdio: ["ignore", "ignore", "ignore"],
          timeout: 3000
        });
        return true;
      } catch (e) {
        return false;
      }
    } else if (platform === "win32") {
      return core.windowsStatus().enabled;
    } else if (platform === "linux") {
      return core.linuxStatus().enabled;
    }
  } catch (e) {}
  return false;
}

// ============ macOS ============

/**
 * Returns true when the current Node process IS the running instance that
 * launchd is managing under our agent label.
 *
 * `launchctl unload <plist>` (and `load`) for an Aqua user-domain agent sends
 * SIGTERM to the running process. When the running mirai cli.js was itself
 * spawned by the autostart launchd agent (i.e. user enabled autostart at
 * some point, then rebooted, then clicked the tray icon's "Disable
 * Auto-start" menu item), an unload would kill the very process executing
 * the click handler — and the tray icon would disappear instead of the menu
 * label flipping back to "Enable Auto-start". This helper lets the enable
 * and disable paths sidestep that by skipping launchctl when we'd otherwise
 * be killing ourselves.
 */
function isAgentSelfMacOS() {
  try {
    const output = execSync(`launchctl list ${APP_LABEL}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000
    });
    const match = output.match(/"PID"\s*=\s*(\d+)/);
    return !!(match && parseInt(match[1], 10) === process.pid);
  } catch (e) {
    return false;
  }
}

function enableMacOS(cliPath) {
  const launchAgentsDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(launchAgentsDir, `${APP_LABEL}.plist`);

  if (!fs.existsSync(launchAgentsDir)) {
    fs.mkdirSync(launchAgentsDir, { recursive: true });
  }

  const nodePath = process.execPath;
  const routerScript = getCliJsPath(cliPath);
  // Don't write a broken plist that references a non-existent script.
  if (!routerScript) return false;

  // Invoke node + cli.js directly with absolute paths — no shell wrapper.
  // The previous design ran `zsh -l -c "..."` so a login shell would source
  // nvm/.zshrc and set PATH; that's fragile (nvm.sh sourcing varies by user,
  // some setups don't put node on PATH from a non-interactive login shell).
  // EnvironmentVariables.PATH explicitly includes node's bin dir so child
  // processes spawned by cli.js (npm install at runtime, etc.) resolve.
  const launchPath = `${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin`;

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${APP_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${routerScript}</string>
        <string>--tray</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${launchPath}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/mirai.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/mirai.error.log</string>
</dict>
</plist>`;

  fs.writeFileSync(plistPath, plistContent);

  // If we're the running agent already, launchctl unload/load would send
  // ourselves SIGTERM. Skip it — the plist file is updated on disk and
  // launchd will pick it up at next login. isAutoStartEnabled() will still
  // return true because launchctl already has the agent loaded.
  if (isAgentSelfMacOS()) {
    return true;
  }

  // Register with launchd in the current session. Without this, the agent
  // only takes effect on the next user login and the user has no signal that
  // anything actually happened. `unload` first defends against re-enable
  // replacing an existing plist.
  try {
    execSync(`launchctl unload "${plistPath}"`, { stdio: "ignore" });
  } catch (e) {}
  try {
    execSync(`launchctl load -w "${plistPath}"`, { stdio: "ignore" });
  } catch (e) {
    // Even if load fails, the plist is on disk and will be picked up at next
    // login; report success based on the file write.
  }
  return true;
}

function disableMacOS() {
  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${APP_LABEL}.plist`);

  // Don't kill ourselves: when the current process is the running agent,
  // `launchctl unload` would send SIGTERM and the user clicking
  // "Disable Auto-start" from the tray menu would lose their tray icon
  // instead of just flipping the menu label. Skip the unload — removing the
  // plist file is enough to prevent the agent from starting on next login.
  if (!isAgentSelfMacOS()) {
    try {
      execSync(`launchctl unload "${plistPath}"`, { stdio: "ignore" });
    } catch (e) {}
  }

  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
  }
  return true;
}

// ============ Windows / Linux ============
//
// Registration for these platforms lives in the shared core
// (`./autostartCore.js`) — Windows writes a Startup-folder `.vbs`, Linux
// writes a `systemd --user` unit. Both the tray and the dashboard Settings
// page go through that module so the two can never drift apart. macOS keeps
// its launchd handling above.

module.exports = {
  enableAutoStart,
  disableAutoStart,
  isAutoStartEnabled
};
