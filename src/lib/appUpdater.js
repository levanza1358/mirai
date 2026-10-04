import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { UPDATER_CONFIG } from "@/shared/constants/config";
const KILL_TIMEOUT_MS = 5000;
const PROCESS_WAIT_MS = 1500;

// Kill MITM server by PID file (MITM may run as admin/sudo)
function killMitmByPidFile() {
  try {
    const mitmPidFile = path.join(
      process.platform === "win32"
        ? path.join(process.env.APPDATA || "", "mirai")
        : path.join(os.homedir(), ".mirai"),
      "mitm",
      ".mitm.pid"
    );
    if (!fs.existsSync(mitmPidFile)) return;
    const pid = parseInt(fs.readFileSync(mitmPidFile, "utf8").trim(), 10);
    if (!pid) return;

    if (process.platform === "win32") {
      // taskkill first (works if same user); fallback to PowerShell Stop-Process which can kill admin process if our token allows
      try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", windowsHide: true, timeout: 3000 }); } catch {
        try { execSync(`powershell -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Id ${pid} -Force"`, { stdio: "ignore", windowsHide: true, timeout: 3000 }); } catch { /* best effort */ }
      }
    } else {
      try {
        execSync(`sudo -n kill -9 ${pid} 2>/dev/null`, { stdio: "ignore", timeout: 3000 });
      } catch {
        try { process.kill(pid, "SIGKILL"); } catch { /* best effort */ }
      }
    }
    try { fs.unlinkSync(mitmPidFile); } catch { /* best effort */ }
  } catch { /* best effort */ }
}

// Collect PIDs of all mirai-related processes (excluding current)
function collectAppPids() {
  const pids = [];
  const platform = process.platform;

  if (platform === "win32") {
    try {
      const psCmd = `powershell -NonInteractive -WindowStyle Hidden -Command "Get-WmiObject Win32_Process -Filter 'Name=\\"node.exe\\"' | Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`;
      const output = execSync(psCmd, { encoding: "utf8", windowsHide: true, timeout: KILL_TIMEOUT_MS });
      const lines = output.split("\n").slice(1).filter(l => l.trim());
      lines.forEach(line => {
        const lower = line.toLowerCase();
        // Match anything running from mirai install dir or wrapper cli.js
        const isAppProcess = lower.includes("mirai") ||
          lower.includes("next-server") ||
          lower.includes("\\bin\\app\\") ||
          lower.includes("/bin/app/") ||
          lower.includes("cli.js");
        if (isAppProcess) {
          const match = line.match(/^"(\d+)"/);
          if (match && match[1] && match[1] !== process.pid.toString()) pids.push(match[1]);
        }
      });
    } catch { /* no processes */ }

    // Kill cloudflared + tray binaries (hold app dir lock)
    for (const procName of ["cloudflared", "tray_windows_release"]) {
      try {
        const cmd = `powershell -NonInteractive -WindowStyle Hidden -Command "Get-Process ${procName} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"`;
        const out = execSync(cmd, { encoding: "utf8", windowsHide: true, timeout: KILL_TIMEOUT_MS });
        out.split("\n").forEach(l => {
          const pid = l.trim();
          if (pid && !isNaN(pid)) pids.push(pid);
        });
      } catch { /* not running */ }
    }
  } else {
    try {
      const output = execSync("ps aux 2>/dev/null", { encoding: "utf8", timeout: KILL_TIMEOUT_MS });
      output.split("\n").forEach(line => {
        const isAppProcess = line.includes("mirai") ||
          line.includes("next-server") ||
          line.includes("cloudflared") ||
          line.includes("/bin/app/") ||
          line.includes("tray_darwin") ||
          line.includes("tray_linux");
        if (isAppProcess) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && !isNaN(pid) && pid !== process.pid.toString()) pids.push(pid);
        }
      });
    } catch { /* no processes */ }
  }

  return pids;
}

// Copy updater.js into DATA_DIR so npm -g can overwrite node_modules safely
function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "mirai");
  }
  return path.join(os.homedir(), ".mirai");
}

function resolveBundledUpdaterPath() {
  if (process.env.UPDATER_SCRIPT_PATH && fs.existsSync(process.env.UPDATER_SCRIPT_PATH)) {
    return process.env.UPDATER_SCRIPT_PATH;
  }
  // Production standalone: cwd is binAppDir (see bin/cli.js)
  // Dev: cwd is app/
  const fromCwd = path.join(process.cwd(), "src", "lib", "updater", "updater.js");
  if (fs.existsSync(fromCwd)) return fromCwd;
  const fromParent = path.join(process.cwd(), "..", "src", "lib", "updater", "updater.js");
  if (fs.existsSync(fromParent)) return fromParent;
  return fromCwd;
}

function ensureRuntimeUpdater(bundledPath) {
  try {
    if (!bundledPath || !fs.existsSync(bundledPath)) return bundledPath;
    const runtimeDir = path.join(getDataDir(), "runtime", "updater");
    const runtimePath = path.join(runtimeDir, "updater.js");
    if (fs.existsSync(runtimePath)) {
      try {
        if (fs.statSync(bundledPath).size === fs.statSync(runtimePath).size) return runtimePath;
      } catch { /* recopy */ }
    }
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.copyFileSync(bundledPath, runtimePath);
    return runtimePath;
  } catch {
    return bundledPath;
  }
}

// Kill all app-related processes to release file locks (esp. on Windows)
export async function killAppProcesses() {
  killMitmByPidFile();
  const pids = collectAppPids();
  const platform = process.platform;

  pids.forEach(pid => {
    try {
      if (platform === "win32") {
        execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: "ignore", shell: true, windowsHide: true, timeout: 3000 });
      } else {
        execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: "ignore", timeout: 3000 });
      }
    } catch { /* already dead */ }
  });

  if (pids.length > 0) {
    await new Promise(r => setTimeout(r, PROCESS_WAIT_MS));
  }
}

// Resolve npx/mirai binary to relaunch after update (cross-platform)
function resolveRelaunchCommand() {
  const isWin = process.platform === "win32";
  // Prefer `npx mirai` — works regardless of global bin path changes after npm i -g
  const npx = isWin ? "npx.cmd" : "npx";
  return { cmd: npx, args: [UPDATER_CONFIG.npmPackageName] };
}

// Spawn detached headless updater (Node process) then exit current server
export function spawnUpdaterAndExit(packageName = UPDATER_CONFIG.npmPackageName) {
  const updaterPath = ensureRuntimeUpdater(resolveBundledUpdaterPath());
  const isTray = process.env.TRAY_MODE === "1";
  const relaunch = resolveRelaunchCommand();
  // Relaunch matching original env: tray stays tray, foreground stays foreground
  const relaunchArgs = isTray
    ? [...relaunch.args, "--tray", "--skip-update"]
    : [...relaunch.args, "--skip-update"];

  spawn(process.execPath, [updaterPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      UPDATER_PKG_NAME: packageName,
      UPDATER_PORT: String(UPDATER_CONFIG.statusPort),
      UPDATER_TAIL_LINES: String(UPDATER_CONFIG.statusLogTailLines),
      UPDATER_RETRIES: String(UPDATER_CONFIG.installRetries),
      UPDATER_RETRY_DELAY_MS: String(UPDATER_CONFIG.installRetryDelayMs),
      UPDATER_LINGER_MS: String(UPDATER_CONFIG.lingerAfterDoneMs),
      UPDATER_WAIT_MIN_MS: String(UPDATER_CONFIG.waitForExitMinMs),
      UPDATER_WAIT_MAX_MS: String(UPDATER_CONFIG.waitForExitMaxMs),
      UPDATER_WAIT_CHECK_MS: String(UPDATER_CONFIG.waitForExitCheckMs),
      UPDATER_APP_PORT: String(UPDATER_CONFIG.appPort),
      UPDATER_RELAUNCH: "1",
      UPDATER_RELAUNCH_CMD: relaunch.cmd,
      UPDATER_RELAUNCH_ARGS: JSON.stringify(relaunchArgs),
    },
  }).unref();

  setTimeout(() => process.exit(0), UPDATER_CONFIG.exitDelayMs);
}

// Whether the global `mirai` CLI can be spawned (used to decide between the
// detached CLI relaunch and the in-process relauncher).
function isCliAvailable(isWin) {
  try {
    const probe = isWin
      ? 'where mirai.cmd >nul 2>nul || where mirai >nul 2>nul'
      : "command -v mirai >/dev/null 2>&1";
    execSync(probe, {
      stdio: "ignore",
      windowsHide: true,
      timeout: 3000,
      shell: isWin ? "cmd.exe" : "/bin/sh",
    });
    return true;
  } catch {
    return false;
  }
}

// Restart the server on a new port (used after the user changes the port from
// Settings). Preference order:
//   1. Detached `mirai restart --port <port>` (preserves launcher tray/foreground
//      mode + runtime env), used only when the CLI is actually on PATH.
//   2. In-process: a detached relauncher that waits for this process to die, then
//      re-execs the same server entrypoint with PORT=<new port>.
// Returns the chosen mode so the caller knows how the app came back up.
export function spawnDetachedRestart(port) {
  const isWin = process.platform === "win32";
  const newPort = String(port);

  // How this process was started, so the relauncher can reproduce it.
  const entry = process.argv[1] || "";
  const isStandaloneServer = !!entry && fs.existsSync(entry);

  const childEnv = { ...process.env, PORT: newPort, MIRAI_RESTART_PORT: newPort };

  // Schedule a hard exit that cannot be starved by the Next.js event loop.
  // `unref()` the timer's work by using a dedicated child that kills us by PID,
  // and also try process.exit() directly as a best-effort.
  const scheduleExit = () => {
    const selfPid = process.pid;
    try {
      if (isWin) {
        // Detached killer survives our exit and force-kills us after a short delay.
        const killCmd = `powershell -NonInteractive -WindowStyle Hidden -Command "Start-Sleep -Milliseconds ${UPDATER_CONFIG.exitDelayMs + 800}; Stop-Process -Id ${selfPid} -Force -ErrorAction SilentlyContinue"`;
        spawn("cmd.exe", ["/c", killCmd], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      } else {
        spawn("/bin/sh", ["-c", `sleep 2; kill -9 ${selfPid} 2>/dev/null`], {
          detached: true,
          stdio: "ignore",
        }).unref();
      }
    } catch {
      /* fall back to direct exit below */
    }
    // Best-effort graceful exit; the killer above guarantees termination.
    setTimeout(() => process.exit(0), UPDATER_CONFIG.exitDelayMs);
  };

  // 1) Preferred: detached `mirai restart --port <port>` (preserves launcher
  //    tray/foreground mode + runtime env). Only used when the CLI is available.
  if (isCliAvailable(isWin)) {
    try {
      const cliCmd = isWin ? "mirai.cmd" : "mirai";
      const child = spawn(cliCmd, ["restart", "--port", newPort], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: childEnv,
      });
      child.unref();
      scheduleExit();
      return "cli";
    } catch {
      /* fall through to in-process relaunch */
    }
  }

  // 2) In-process fallback: a detached relauncher that waits for this process to
  //    die, then starts the server again with the new PORT. Never depends on the
  //    CLI being installed.
  try {
    if (!isStandaloneServer) {
      // We cannot reconstruct the entrypoint — let the caller exit gracefully so
      // an external supervisor (mirai CLI / tray) can bring us back up.
      scheduleExit();
      return "none";
    }

    const scriptDir = getDataDir();
    fs.mkdirSync(scriptDir, { recursive: true });
    const scriptPath = path.join(scriptDir, `restart-${Date.now()}${isWin ? ".cmd" : ".sh"}`);
    const waitMs = UPDATER_CONFIG.exitDelayMs + 1500;

    if (isWin) {
      const cmd = [
        "@echo off",
        `ping 127.0.0.1 -n ${Math.ceil(waitMs / 1000) + 1} > nul`,
        `set PORT=${newPort}`,
        `cd /d "${path.dirname(entry)}"`,
        `start "" /b "${process.execPath}" "${entry}"`,
        `del "%~f0"`,
      ].join("\r\n");
      fs.writeFileSync(scriptPath, cmd, "utf-8");
      spawn("cmd.exe", ["/c", scriptPath], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: childEnv,
      }).unref();
    } else {
      const cmd = [
        "#!/bin/sh",
        `sleep ${Math.ceil(waitMs / 1000) + 1}`,
        `export PORT=${newPort}`,
        `cd "${path.dirname(entry)}"`,
        `"${process.execPath}" "${entry}" </dev/null >/dev/null 2>&1 &`,
        `rm -f "${scriptPath}"`,
      ].join("\n");
      fs.writeFileSync(scriptPath, cmd, { mode: 0o755 });
      spawn("/bin/sh", [scriptPath], { detached: true, stdio: "ignore", env: childEnv }).unref();
    }

    scheduleExit();
    return "in-process";
  } catch {
    scheduleExit();
    return "none";
  }
}
