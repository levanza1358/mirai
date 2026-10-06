#!/usr/bin/env node

const { spawn, exec, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const os = require("os");

// Poll until the server accepts TCP connections on port, or timeout — avoids blind fixed waits.
function waitServerReady(port, { timeoutMs = 15000, intervalMs = 150 } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tryConnect = () => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(tryConnect, intervalMs);
      });
    };
    tryConnect();
  });
}

const pkg = require("./package.json");
const { ensureSqliteRuntime, buildEnvWithRuntime } = require("./hooks/sqliteRuntime");
const { ensureTrayRuntime } = require("./hooks/trayRuntime");
const args = process.argv.slice(2);

// Subcommands (`mirai xai video …`) run against an already-running gateway
// and bypass the launcher flow (no runtime self-heal, no server spawn).
if (args[0] === "xai" && args[1] === "video") {
  const { run } = require("./src/cli/commands/xaiVideo");
  run(args.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`❌ ${err?.message || err}`);
      process.exit(1);
    });
  return;
}

// `mirai connect <url>` configures local CLI tools against a remote server —
// no local server, no runtime deps. Usable via `npx mirai connect …`.
if (args[0] === "connect") {
  const { run } = require("./src/cli/commands/connect");
  run(args.slice(1))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`❌ ${err?.message || err}`);
      process.exit(1);
    });
  return;
}

// `mirai restart` stops the running server (all mirai/next-server processes and
// whatever holds the app port) and starts it again on the same port. Use this
// after changing the port from the dashboard Settings page.
// NOTE: this block runs after the configuration constants/functions below are
// initialized (it references DEFAULT_PORT and readPersistedPort).
function killByPort(port) {
  // Force-kill whatever LISTENs on `port` (any launcher: cli.js, standalone
  // custom-server.js, next-server). Returns the killed PID or null.
  if (!port) return null;
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8", shell: true, windowsHide: true, timeout: 5000,
      });
      const line = out.split(/\r?\n/).find((l) => l.includes("LISTENING"));
      if (!line) return null;
      const pid = line.trim().split(/\s+/).pop();
      if (!pid || pid === "0") return null;
      execSync(`taskkill /F /T /PID ${pid} 2>nul`, { stdio: "ignore", shell: true, windowsHide: true, timeout: 3000 });
      return pid;
    }
    const out = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: "utf8", shell: true, timeout: 5000 });
    const pid = out.trim().split(/\n/)[0];
    if (!pid) return null;
    execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: "ignore", shell: true, timeout: 3000 });
    return pid;
  } catch {
    return null;
  }
}

function handleRestartCommand() {
  const portArg = (() => {
    const i = args.findIndex((a) => a === "--port" || a === "-p");
    return i >= 0 ? args[i + 1] : null;
  })();
  const persisted = readPersistedPort();
  const targetPort = parseInt(portArg, 10) || persisted || DEFAULT_PORT;

  console.log(`🔄 Restarting Mirai on port ${targetPort}...`);

  // Kill the target port AND the currently-persisted port (they can differ right
  // after a port change, leaving an old server on the previous port).
  const portsToKill = [...new Set([targetPort, persisted].filter(Boolean))];
  const killed = portsToKill.map((p) => killByPort(p)).filter(Boolean);

  killAllAppProcesses(targetPort)
    .then(() => killProcessOnPort(targetPort))
    .then(() => new Promise((r) => setTimeout(r, 500)))
    .then(() => {
      if (killed.length) console.log(`   Stopped process(es) on port ${portsToKill.join(", ")}.`);
      // Hand off to the launcher flow so the server is spawned with the right env
      // (sqlite runtime self-heal, update check, tray/foreground mode preserved).
      // The relaunch is always detached with no TTY, so force background/tray mode:
      // otherwise the interactive launcher would try to open its TUI menu and exit.
      const relaunchArgs = ["--tray"];
      const { spawn } = require("child_process");
      const child = spawn(process.execPath, [__filename, "--port", String(targetPort), ...relaunchArgs], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: { ...process.env, TRAY_MODE: "1" },
      });
      child.unref();
      console.log("✅ Restart triggered. Server is starting in the background.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(`❌ Restart failed: ${err?.message || err}`);
      process.exit(1);
    });
}

// Self-heal SQLite runtime deps (sql.js + better-sqlite3) into ~/.mirai/runtime
// so the server can resolve them via NODE_PATH. Best-effort — sql.js is required,
// better-sqlite3 is optional. Logs to stderr only on failure.
try { ensureSqliteRuntime({ silent: true }); } catch {}

// Self-heal tray runtime (systray for macOS/Linux only). Windows skipped.
try { ensureTrayRuntime({ silent: true }); } catch {}

// Configuration constants
const APP_NAME = pkg.name; // Use from package.json

const DEFAULT_PORT = 1463;
const DEFAULT_HOST = "0.0.0.0";

// Persistent port config lives next to the app data dir so a port chosen from
// the dashboard survives a restart. Mirrors src/lib/portConfig.js.
function getPortConfigPath() {
  const dataDir =
    process.env.DATA_DIR ||
    process.env.MIRAI_DATA_DIR ||
    (process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"), "mirai")
      : path.join(process.env.HOME || process.env.USERPROFILE || ".", ".mirai"));
  return path.join(dataDir, "config", "port.json");
}

function readPersistedPort() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getPortConfigPath(), "utf-8"));
    const n = parseInt(parsed && parsed.port, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 65535 && n !== 20129) return n;
  } catch {
    /* no config yet */
  }
  return null;
}

// Handle lifecycle commands after the port helpers/constants above are initialized.
// `start` is accepted explicitly so scripts and users get the same behavior as the
// default launcher. `stop` tears down the complete local Mirai process tree.
function handleStopCommand() {
  const persisted = readPersistedPort();
  const requested = (() => {
    const i = args.findIndex((a) => a === "--port" || a === "-p");
    return i >= 0 ? parseInt(args[i + 1], 10) : null;
  })();
  const portsToKill = [...new Set([requested, persisted, DEFAULT_PORT].filter(Boolean))];

  console.log("🛑 Stopping Mirai and related processes...");
  Promise.all(portsToKill.map((p) => killByPort(p)))
    .then(() => killAllAppProcesses(requested || persisted || DEFAULT_PORT))
    .then(() => Promise.all(portsToKill.map((p) => killProcessOnPort(p))))
    .then(() => {
      console.log("✅ Mirai stopped.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(`❌ Stop failed: ${err?.message || err}`);
      process.exit(1);
    });
}

if (args[0] === "stop") {
  handleStopCommand();
  return;
}

if (args[0] === "restart") {
  handleRestartCommand();
  return;
}

// `mirai update` pulls the latest code from GitHub, reinstalls deps, rebuilds
// and restarts. It delegates to the repo's update.sh / update.cmd so the heavy
// lifting lives next to the installer (single source of truth).
if (args[0] === "update" || args[0] === "upgrade") {
  const { runUpdate } = require("./src/cli/commands/update");
  runUpdate(args.slice(1)).then((code) => process.exit(code));
  return;
}

// `start` is a lifecycle alias; remove it before normal option parsing.
if (args[0] === "start") args.shift();

// First non-internal IPv4 — the address remote peers actually reach when bound to 0.0.0.0.
function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return null;
}

// Local URL stays "localhost"; warn separately when bound to all interfaces (network-exposed).
function getDisplayHost() {
  return host === DEFAULT_HOST ? "localhost" : host;
}
const MAX_PORT_ATTEMPTS = 10;
// Identifiers for killAllAppProcesses - only kill mirai specifically
const PROCESS_IDENTIFIERS = [
  'mirai'  // Only package name - avoid killing other apps
];

// Parse arguments
let port = readPersistedPort() ?? DEFAULT_PORT;
let host = DEFAULT_HOST;
let noBrowser = false;
let showLog = false;
let trayMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") {
    port = parseInt(args[i + 1], 10) || readPersistedPort() || DEFAULT_PORT;
    i++;
  } else if (args[i] === "--host" || args[i] === "-H") {
    host = args[i + 1] || DEFAULT_HOST;
    i++;
  } else if (args[i] === "--no-browser" || args[i] === "-n") {
    noBrowser = true;
  } else if (args[i] === "--log" || args[i] === "-l") {
    showLog = true;
  } else if (args[i] === "--tray" || args[i] === "-t") {
    trayMode = true;
    process.env.TRAY_MODE = "1";
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Usage: ${APP_NAME} [options]

Options:
  -p, --port <port>   Port to run the server (default: ${DEFAULT_PORT}, or the
                      port saved in Settings)
  -H, --host <host>   Host to bind (default: ${DEFAULT_HOST})
  -n, --no-browser    Don't open browser automatically
  -l, --log           Show server logs (default: hidden)
  -t, --tray          Run in system tray mode (background)
  -h, --help          Show this help message
  -v, --version       Show version

Commands:
  start               Build the standalone app if needed, then start Mirai
  stop                Stop Mirai, proxy, tunnels, and processes on its ports
  restart             Stop and start Mirai again on the same port. Use after
                      changing the port in the dashboard Settings.
  update [--check]    Pull the latest code from GitHub, reinstall deps, rebuild
                      and restart. Your .env and data dir are kept.
                      (see: ${APP_NAME} update --help)
  connect <server-url> Configure Claude Code for a remote mirai server
                      (npx mirai connect http://host:1463 — no install needed)
  xai video --prompt "..." --output video.mp4
                      Generate a Grok Imagine video via the running gateway
                      (see: ${APP_NAME} xai video --help)
`);
    process.exit(0);
  } else if (args[i] === "--version" || args[i] === "-v") {
    console.log(pkg.version);
    process.exit(0);
  }
}

// A detached / non-interactive launch (no TTY, e.g. `mirai start` from a script,
// a service, or a background spawn) cannot drive the interactive TUI menu. Fall
// back to background/tray mode so the server still comes up and stays alive.
if (!trayMode && !process.stdin.isTTY) {
  trayMode = true;
  process.env.TRAY_MODE = "1";
}

// Always use Node.js runtime with absolute path
const RUNTIME = process.execPath;

// Get app data dir (matches app/src/lib/dataDir.js convention)
function getAppDataDir() {
  return process.platform === "win32"
    ? path.join(process.env.APPDATA || "", "mirai")
    : path.join(os.homedir(), ".mirai");
}

// Kill PID from file (best-effort, removes file after)
function killByPidFile(pidFile) {
  try {
    if (!fs.existsSync(pidFile)) return;
    const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    if (!pid) return;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", windowsHide: true, timeout: 3000 });
      } else {
        process.kill(pid, "SIGKILL");
      }
    } catch { }
    try { fs.unlinkSync(pidFile); } catch { }
  } catch { }
}

// Kill tunnel processes (cloudflared/tailscale) by their PID files
function killTunnelByPidFile() {
  const tunnelDir = path.join(getAppDataDir(), "tunnel");
  killByPidFile(path.join(tunnelDir, "cloudflared.pid"));
  killByPidFile(path.join(tunnelDir, "tailscale.pid"));
}

// Kill cloudflared whose --url targets this app's port (covers stale PID file case)
function killCloudflaredByAppPort(appPort) {
  if (!appPort) return [];
  const portMatchers = [`localhost:${appPort}`, `127.0.0.1:${appPort}`];
  const pids = [];
  try {
    if (process.platform === "win32") {
      const psCmd = `powershell -NonInteractive -WindowStyle Hidden -Command "Get-WmiObject Win32_Process -Filter 'Name=\\"cloudflared.exe\\"' | Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`;
      const output = execSync(psCmd, { encoding: "utf8", windowsHide: true, timeout: 5000 });
      const lines = output.split("\n").slice(1).filter(l => l.trim());
      lines.forEach(line => {
        if (portMatchers.some(m => line.includes(m))) {
          const match = line.match(/^"(\d+)"/);
          if (match && match[1]) pids.push(match[1]);
        }
      });
    } else {
      const output = execSync("ps -eo pid,command 2>/dev/null", { encoding: "utf8", timeout: 5000 });
      output.split("\n").forEach(line => {
        if (line.includes("cloudflared") && portMatchers.some(m => line.includes(m))) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[0];
          if (pid && !isNaN(pid)) pids.push(pid);
        }
      });
    }
  } catch { }
  return pids;
}

// Kill all mirai processes
function killAllAppProcesses(appPort) {
  return new Promise((resolve) => {
    try {
      // Background: MITM + tunnel/cloudflared run on separate ports/processes —
      // killing them doesn't free the app port, so don't block the critical path.
      // Server-side MITM manager has stale-lock recovery and starts deferred (~3s).
      setImmediate(() => {
        try { killProxyByPidFile(); } catch {}
        try { killTunnelByPidFile(); } catch {}
        try { killCloudflaredByAppPort(appPort); } catch {}
      });

      const platform = process.platform;
      let pids = [];

      if (platform === "win32") {
        // Windows: use WMI to get full CommandLine (tasklist /V doesn't include it)
        try {
          const psCmd = `powershell -NonInteractive -WindowStyle Hidden -Command "Get-WmiObject Win32_Process -Filter 'Name=\\"node.exe\\"' | Select-Object ProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`;
          const output = execSync(psCmd, {
            encoding: "utf8",
            windowsHide: true,
            timeout: 5000
          });
          const lines = output.split("\n").slice(1).filter(l => l.trim());
          lines.forEach(line => {
            // Whitelist: real node process running mirai/cli.js, or next-server.
            // Avoids killing editors/grep/strace/cursor that just have "mirai" in cmdline.
            const cmd = line.toLowerCase();
            const isAppProcess =
              (cmd.includes("node") && cmd.includes("mirai") && (cmd.includes("cli.js") || cmd.includes("\\mirai") || cmd.includes("/mirai")))
              || cmd.includes("next-server");
            if (isAppProcess) {
              const match = line.match(/^"(\d+)"/);
              if (match && match[1] && match[1] !== process.pid.toString()) {
                pids.push(match[1]);
              }
            }
          });
        } catch (e) {
          // No processes found or error - continue
        }
      } else {
        // macOS/Linux: use ps to find all matching processes
        try {
          const output = execSync('ps aux 2>/dev/null', {
            encoding: 'utf8',
            timeout: 5000
          });
          const lines = output.split('\n');

          lines.forEach(line => {
            // Whitelist: real node process running mirai/cli.js, or next-server.
            // Avoids killing grep/strace/editors/cursor that incidentally match "mirai".
            const cmd = line.toLowerCase();
            const isAppProcess =
              (cmd.includes("node") && cmd.includes("mirai") && (cmd.includes("cli.js") || cmd.includes("/mirai")))
              || cmd.includes("next-server");
            if (isAppProcess) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[1];
              if (pid && !isNaN(pid) && pid !== process.pid.toString()) {
                pids.push(pid);
              }
            }
          });
        } catch (e) {
          // No processes found or error - continue
        }
      }

      // Kill all found processes
      if (pids.length > 0) {
        pids.forEach(pid => {
          try {
            if (platform === "win32") {
              execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore', shell: true, windowsHide: true, timeout: 3000 });
            } else {
              execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 });
            }
          } catch (err) {
            // Process already dead or can't kill - continue
          }
        });

        // Wait for processes to fully terminate
        setTimeout(() => resolve(), 1000);
      } else {
        resolve();
      }
    } catch (err) {
      // Silent fail - continue anyway
      resolve();
    }
  });
}

// Sleep helper using SharedArrayBuffer wait (sync, no busy-loop)
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* ignore */ }
}

// Wait until process dies or timeout reached
function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); } catch { return true; }
    sleepSync(100);
  }
  return false;
}

// Kill MIT server by PID file (runs privileged, needs special handling)
// Sends SIGTERM first so MIT can clean up host entries before dying.
function killProxyByPidFile() {
  try {
    const pidFile = path.join(getAppDataDir(), "mitm", ".mitm.pid");
    if (!fs.existsSync(pidFile)) return;
    const pid = parseInt(fs.readFileSync(pidFile, "utf8").trim(), 10);
    if (!pid) return;

    if (process.platform === "win32") {
      // Graceful first (lets server cleanup hosts), then force
      try { execSync(`taskkill /T /PID ${pid}`, { stdio: "ignore", windowsHide: true, timeout: 2000 }); } catch { }
      if (!waitForExit(pid, 1500)) {
        try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore", windowsHide: true, timeout: 3000 }); } catch { }
      }
      // Last-resort: PowerShell Stop-Process (sometimes succeeds where taskkill fails on admin processes)
      if (!waitForExit(pid, 500)) {
        try { execSync(`powershell -NonInteractive -WindowStyle Hidden -Command "Stop-Process -Id ${pid} -Force"`, { stdio: "ignore", windowsHide: true, timeout: 3000 }); } catch { }
      }
    } else {
      // SIGTERM via cached sudo token first
      try { execSync(`sudo -n kill -TERM ${pid} 2>/dev/null`, { stdio: "ignore", timeout: 2000 }); }
      catch { try { process.kill(pid, "SIGTERM"); } catch { } }
      if (!waitForExit(pid, 1500)) {
        try { execSync(`sudo -n kill -9 ${pid} 2>/dev/null`, { stdio: "ignore", timeout: 2000 }); }
        catch { try { process.kill(pid, "SIGKILL"); } catch { } }
      }
    }
    try { fs.unlinkSync(pidFile); } catch { }
  } catch { }
}

// Kill any process on specific port
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    try {
      const platform = process.platform;
      let pid;

      if (platform === "win32") {
        try {
          const output = execSync(`netstat -ano | findstr :${port}`, {
            encoding: 'utf8',
            shell: true,
            windowsHide: true,
            timeout: 5000
          }).trim();
          const lines = output.split('\n').filter(l => l.includes('LISTENING'));
          if (lines.length > 0) {
            pid = lines[0].trim().split(/\s+/).pop();
            execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore', shell: true, windowsHide: true, timeout: 3000 });
          }
        } catch (e) {
          // Port is free or error
        }
      } else {
        // macOS/Linux
        try {
          const pidOutput = execSync(`lsof -ti:${port}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
          }).trim();
          if (pidOutput) {
            pid = pidOutput.split('\n')[0];
            execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore', timeout: 3000 });
          }
        } catch (e) {
          // Port is free or error
        }
      }

      // Wait for port to be released
      setTimeout(() => resolve(), 500);
    } catch (err) {
      // Silent fail - continue anyway
      resolve();
    }
  });
}


// Detect if running in restricted environment (Codespaces, Docker)
function isRestrictedEnvironment() {
  // Check for Codespaces
  if (process.env.CODESPACES === "true" || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    return "GitHub Codespaces";
  }

  // Check for Docker
  if (fs.existsSync("/.dockerenv") || (fs.existsSync("/proc/1/cgroup") && fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker"))) {
    return "Docker";
  }

  return null;
}

// Open browser
function openBrowser(url) {
  const platform = process.platform;
  let cmd;

  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, { windowsHide: true }, (err) => {
    if (err) {
      console.log(`Open browser manually: ${url}`);
    }
  });
}

// Find standalone server (bundled in bin/app for published package).
// Prefer custom-server.js (injects real socket IP) when present.
// When running from a source checkout (no bundled app/), fall back to the
// locally-built Next standalone output so `./mirai` works after `npm run build`.
const standaloneDir = path.join(__dirname, "app");
let customServerPath = path.join(standaloneDir, "custom-server.js");
if (!fs.existsSync(customServerPath)) {
  const localStandalone = path.join(__dirname, "..", ".next", "standalone");
  const localCustom = path.join(localStandalone, "custom-server.js");
  if (fs.existsSync(localCustom)) customServerPath = localCustom;
}
let serverPath = fs.existsSync(customServerPath)
  ? customServerPath
  : path.join(standaloneDir, "server.js");

if (!fs.existsSync(serverPath)) {
  // A source checkout should be usable with `mirai start` without requiring a
  // separate build command. Build the bundled standalone app once, then retry
  // path resolution so published packages keep their existing fast path.
  console.log("📦 Mirai build belum tersedia. Menjalankan build otomatis...");
  try {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const cliDir = path.join(__dirname);
    const cliNodeModules = path.join(cliDir, "node_modules");
    if (!fs.existsSync(cliNodeModules)) {
      console.log("📥 Dependensi CLI belum tersedia. Menjalankan npm install...");
      execSync(`${npmCommand} --prefix "${cliDir}" install`, {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
        env: { ...process.env },
      });
    }
    execSync(`${npmCommand} --prefix "${cliDir}" run build`, {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch (err) {
    console.error(`❌ Build Mirai gagal: ${err?.message || err}`);
    process.exit(1);
  }

  customServerPath = path.join(standaloneDir, "custom-server.js");
  const rebuiltLocal = path.join(__dirname, "..", ".next", "standalone", "custom-server.js");
  if (!fs.existsSync(customServerPath) && fs.existsSync(rebuiltLocal)) customServerPath = rebuiltLocal;
  const rebuiltServerPath = fs.existsSync(customServerPath)
    ? customServerPath
    : path.join(standaloneDir, "server.js");
  serverPath = rebuiltServerPath;
  if (!fs.existsSync(rebuiltServerPath)) {
    console.error("❌ Build selesai tetapi standalone server tidak ditemukan.");
    process.exit(1);
  }
}

// Start server immediately, then show the interface menu.
killAllAppProcesses(port)
  .then(() => killProcessOnPort(port))
  .then(() => startServer());

// Show interface selection menu
async function showInterfaceMenu() {
  const { selectMenu } = require("./src/cli/utils/input");
  const { clearScreen } = require("./src/cli/utils/display");
  const { getEndpoint } = require("./src/cli/utils/endpoint");

  clearScreen();

  const displayHost = getDisplayHost();

  // Detect tunnel/local mode for server URL display
  let serverUrl;
  try {
    const { endpoint, tunnelEnabled } = await getEndpoint(port);
    serverUrl = tunnelEnabled ? endpoint.replace(/\/v1$/, "") : `http://${displayHost}:${port}`;
  } catch (e) {
    serverUrl = `http://${displayHost}:${port}`;
  }

  const subtitle = `🚀 Server: \x1b[32m${serverUrl}\x1b[0m`;

  const menuItems = [];

  menuItems.push(
    { label: "Web UI (Open in Browser)", icon: "🌐" },
    { label: "Terminal UI (Interactive CLI)", icon: "💻" },
    { label: "Hide to Tray (Background)", icon: "🔔" },
    { label: "Exit", icon: "🚪" }
  );

  const selected = await selectMenu(`Choose Interface (v${pkg.version})`, menuItems, 0, subtitle);

  if (selected === 0) return "web";
  if (selected === 1) return "terminal";
  if (selected === 2) return "hide";
  return "exit";
}

const MAX_RESTARTS = 2;
const RESTART_RESET_MS = 30000; // Reset counter if alive > 30s

function startServer() {
  const displayHost = getDisplayHost();
  const url = `http://${displayHost}:${port}/dashboard`;
  // Surface real network exposure when bound to all interfaces (default 0.0.0.0).
  if (host === DEFAULT_HOST) {
    const lanIp = getLanIp();
    if (lanIp) console.log(`\x1b[33m⚠ Network-exposed: reachable at http://${lanIp}:${port} (bound 0.0.0.0). Use --host 127.0.0.1 for local-only.\x1b[0m`);
  }

  let restartCount = 0;
  let serverStartTime = Date.now();

  const CRASH_LOG_LINES = 50;
  let crashLog = [];

  function spawnServer() {
    serverStartTime = Date.now();
    crashLog = [];
    const child = spawn(RUNTIME, ["--dns-result-order=ipv4first", "--max-old-space-size=6144", serverPath], {
      cwd: path.dirname(serverPath),
      stdio: showLog ? "inherit" : ["ignore", "ignore", "pipe"],
      detached: true,
      windowsHide: true,
      env: {
        ...buildEnvWithRuntime(process.env),
        PORT: port.toString(),
        HOSTNAME: host
      }
    });
    if (!showLog && child.stderr) {
      child.stderr.on("data", (data) => {
        const lines = data.toString().split("\n").filter(Boolean);
        crashLog.push(...lines);
        if (crashLog.length > CRASH_LOG_LINES) crashLog = crashLog.slice(-CRASH_LOG_LINES);
      });
    }
    return child;
  }

  let server = spawnServer();

  // Cleanup function - force kill server process
  let isCleaningUp = false;
  function cleanup() {
    if (isCleaningUp) return;
    isCleaningUp = true;
    try {
      // Kill tray if running
      try {
        const { killTray } = require("./src/cli/tray/tray");
        killTray();
      } catch (e) { }
      // Kill MIT server (privileged process) via PID file
      killProxyByPidFile();
      // Kill cloudflared/tailscale via PID file (only this app's tunnel)
      killTunnelByPidFile();
      // Kill server process directly
      if (server.pid) {
        process.kill(server.pid, "SIGKILL");
      }
      // Also try to kill process group
      process.kill(-server.pid, "SIGKILL");
    } catch (e) { }
  }

  // Suppress all errors during shutdown (systray lib throws JSON parse errors)
  let isShuttingDown = false;
  process.on("uncaughtException", (err) => {
    if (isShuttingDown) return;
    console.error("Error:", err.message);
  });

  // Handle all exit scenarios
  process.on("SIGINT", () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("\nExiting...");
    cleanup();
    setTimeout(() => process.exit(0), 100);
  });
  process.on("SIGTERM", () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    cleanup();
    setTimeout(() => process.exit(0), 100);
  });
  process.on("SIGHUP", () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    cleanup();
    setTimeout(() => process.exit(0), 100);
  });

  // Initialize tray icon (runs alongside TUI)
  const initTrayIcon = () => {
    try {
      const { initTray } = require("./src/cli/tray/tray");
      initTray({
        port,
        onQuit: () => {
          isShuttingDown = true;
          console.log("\n👋 Shutting down from tray...");
          cleanup();
          setTimeout(() => process.exit(0), 100);
        },
        onOpenDashboard: () => openBrowser(url)
      });
    } catch (err) {
      // Tray not available - continue without it
    }
  };

  // Tray-only mode: no TUI, just tray icon
  if (trayMode) {
    // Ignore SIGHUP so macOS terminal close doesn't kill the background tray process
    process.removeAllListeners("SIGHUP");
    process.on("SIGHUP", () => {});

    console.log(`\n🚀 ${pkg.name} v${pkg.version}`);
    console.log(`Server: http://${displayHost}:${port}`);

    waitServerReady(port).then(() => {
      initTrayIcon();
      console.log("\n💡 Router is now running in system tray. Close this terminal if you want.");
      console.log("   Right-click tray icon to open dashboard or quit.\n");
    });

    return;
  }

  // Wait for server to be ready, then show interface menu loop + tray
  waitServerReady(port).then(async () => {
    // Start tray icon alongside TUI
    initTrayIcon();

    try {
      while (true) {
        const choice = await showInterfaceMenu();

        if (choice === "web") {
          openBrowser(url);
          // Wait for user to come back
          const { pause } = require("./src/cli/utils/input");
          await pause("\nPress Enter to go back to menu...");
        } else if (choice === "terminal") {
          // Start Terminal UI - it will return when user selects Back
          const { startTerminalUI } = require("./src/cli/terminalUI");
          await startTerminalUI(port);
          // Loop continues, show menu again
        } else if (choice === "hide") {
          const { clearScreen } = require("./src/cli/utils/display");
          clearScreen();

          // Enable auto startup on OS boot
          try {
            const { enableAutoStart } = require("./src/cli/tray/autostart");
            enableAutoStart(__filename);
          } catch (e) { }

          if (process.platform === "darwin") {
            // macOS: keep current process alive — spawning a detached child puts
            // it outside the login session so NSStatusItem silently fails.
            process.removeAllListeners("SIGHUP");
            process.on("SIGHUP", () => {});

            console.log(`\n⏳ Switching to tray mode... (icon already visible in menu bar)`);
            console.log(`🔔 Mirai is running in tray (PID: ${process.pid})`);
            console.log(`   Server: http://${displayHost}:${port}`);
            console.log(`\n💡 You can close this terminal. Right-click tray icon to quit.\n`);

            // Tray already init'd at startup — just keep event loop alive.
            return;
          }

          // Windows/Linux: spawn detached bgProcess (systray works fine in child)
          console.log(`\n⏳ Starting background process... (tray icon will appear in ~3s)`);

          const bgProcess = spawn(process.execPath, ["--dns-result-order=ipv4first", __filename, "--tray", "-p", port.toString()], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
            env: { ...process.env }
          });
          bgProcess.unref();

          console.log(`🔔 Mirai is now running in background (PID: ${bgProcess.pid})`);
          console.log(`   Server: http://${displayHost}:${port}`);
          console.log(`\n💡 You can close this terminal. Right-click tray icon to quit.\n`);

          // cleanup() kills server so bgProcess can claim the port fresh
          cleanup();
          process.exit(0);
        } else if (choice === "exit") {
          isShuttingDown = true;
          console.log("\nExiting...");
          cleanup();
          setTimeout(() => process.exit(0), 100);
        }
      }
    } catch (err) {
      console.error("Error:", err.message);
      cleanup();
      process.exit(1);
    }
  });

  function attachServerEvents() {
    server.on("error", (err) => {
      console.error("Failed to start server:", err.message);
      if (!isShuttingDown) tryRestart();
      else { cleanup(); process.exit(1); }
    });

    server.on("close", (code) => {
      if (isShuttingDown || code === 0) {
        process.exit(code || 0);
        return;
      }
      tryRestart(code);
    });
  }

  function tryRestart(code) {
    const aliveMs = Date.now() - serverStartTime;
    // Reset counter if last run was stable
    if (aliveMs >= RESTART_RESET_MS) restartCount = 0;

    if (restartCount >= MAX_RESTARTS) {
      console.error(`\n⚠️  Server crashed ${MAX_RESTARTS} times. Disabling MIT and restarting...`);
      try {
        const dbPath = path.join(os.homedir(), process.platform === "win32" ? path.join("AppData", "Roaming", "mirai", "db.json") : path.join(".mirai", "db.json"));
        if (fs.existsSync(dbPath)) {
          const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
          if (db.settings) db.settings.mitmEnabled = false;
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        }
      } catch { /* best effort */ }
      restartCount = 0;
      server = spawnServer();
      attachServerEvents();
      return;
    }

    restartCount++;
    const delay = Math.min(1000 * restartCount, 10000);
    console.error(`\n⚠️  Server exited (code=${code ?? "unknown"}). Restarting in ${delay / 1000}s... (${restartCount}/${MAX_RESTARTS})`);
    if (crashLog.length) {
      console.error("\n--- Server crash log ---");
      crashLog.forEach(l => console.error(l));
      console.error("--- End crash log ---\n");
    }

    setTimeout(() => {
      server = spawnServer();
      attachServerEvents();
    }, delay);
  }

  attachServerEvents();
}
