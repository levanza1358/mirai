import fs from "fs";
import path from "path";

// Single source of truth for the server port.
//
// The CLI launcher (`cli/cli.js`) and the standalone server (`custom-server.js`)
// both read this file so that a port chosen from the dashboard survives a
// restart. Precedence (highest first):
//   1. `--port` / `PORT` env passed by the CLI launcher
//   2. this persisted config file
//   3. DEFAULT_PORT
//
// Default is 1463 (localhost:1463).
export const DEFAULT_PORT = 1463;
export const MIN_PORT = 1;
export const MAX_PORT = 65535;

// Reserved for the updater status server; never usable as the app port.
export const RESERVED_PORTS = new Set([20129]);

let cachedDataDir;

function resolveDataDir() {
  if (cachedDataDir) return cachedDataDir;
  const fromEnv = process.env.DATA_DIR || process.env.MIRAI_DATA_DIR;
  if (fromEnv) {
    cachedDataDir = fromEnv;
    return cachedDataDir;
  }
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
    cachedDataDir = path.join(appData, "mirai");
  } else {
    cachedDataDir = path.join(process.env.HOME || process.env.USERPROFILE || ".", ".mirai");
  }
  return cachedDataDir;
}

export function getPortConfigPath() {
  return path.join(resolveDataDir(), "config", "port.json");
}

export function isValidPort(value) {
  const port = typeof value === "number" ? value : parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT && !RESERVED_PORTS.has(port);
}

export function getDefaultPort() {
  const fromEnv = process.env.PORT && String(process.env.PORT).trim();
  if (fromEnv && isValidPort(fromEnv)) return parseInt(fromEnv, 10);
  return DEFAULT_PORT;
}

// Never throw: a missing/corrupt config must fall back to the default.
export function readPersistedPort() {
  try {
    const raw = fs.readFileSync(getPortConfigPath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && isValidPort(parsed.port)) return parseInt(parsed.port, 10);
  } catch {
    /* no config yet or unreadable */
  }
  return null;
}

export function writePersistedPort(port) {
  const numeric = parseInt(String(port), 10);
  if (!isValidPort(numeric)) throw new Error(`Invalid port: ${port}`);
  const file = getPortConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ port: numeric }, null, 2) + "\n", "utf-8");
  return numeric;
}

// Resolve the effective port for this process: PORT env wins, then the file.
export function resolvePort() {
  const fromEnv = process.env.PORT && String(process.env.PORT).trim();
  if (fromEnv && isValidPort(fromEnv)) return parseInt(fromEnv, 10);
  return readPersistedPort() ?? DEFAULT_PORT;
}
