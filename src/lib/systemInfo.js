import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Hardware + OS inventory for the dashboard Settings page.
 *
 * Everything here is derived from Node's `os` module plus a few cheap file
 * reads (`/etc/os-release`), so it is safe to call on every request and never
 * shells out. Values are best-effort: a field is `null` rather than throwing
 * when the platform does not expose it.
 */

function readLinuxRelease() {
  if (process.platform !== "linux") return null;
  const candidates = ["/etc/os-release", "/usr/lib/os-release"];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const map = {};
      for (const line of raw.split("\n")) {
        const match = line.match(/^([A-Z_]+)=(.*)$/);
        if (!match) continue;
        map[match[1]] = match[2].replace(/^"|"$/g, "").replace(/\\"/g, '"');
      }
      if (map.PRETTY_NAME || map.NAME) {
        return {
          name: map.NAME || null,
          prettyName: map.PRETTY_NAME || map.NAME || null,
          version: map.VERSION || map.VERSION_ID || null,
          id: map.ID || null,
          idLike: map.ID_LIKE ? map.ID_LIKE.split(" ").filter(Boolean) : [],
        };
      }
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

function readWindowsRelease() {
  if (process.platform !== "win32") return null;
  // `os.version()` already returns "Windows 11 Pro" style strings, and
  // `os.release()` gives the kernel build (e.g. 10.0.22631), so we only add
  // the marketing name here without shelling out to a WMI query.
  return {
    name: os.version() || null,
    prettyName: os.version() || null,
    version: os.release() || null,
    id: "windows",
    idLike: [],
  };
}

export function getOsRelease() {
  if (process.platform === "linux") return readLinuxRelease();
  if (process.platform === "win32") return readWindowsRelease();
  if (process.platform === "darwin") {
    return { name: "macOS", prettyName: `macOS ${os.release()}`, version: os.release(), id: "macos", idLike: [] };
  }
  return { name: os.type(), prettyName: `${os.type()} ${os.release()}`, version: os.release(), id: process.platform, idLike: [] };
}

const PLATFORM_LABELS = {
  win32: "Windows",
  linux: "Linux",
  darwin: "macOS",
  freebsd: "FreeBSD",
  openbsd: "OpenBSD",
  sunos: "SunOS",
  aix: "AIX",
};

function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const decimals = value >= 100 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

function getCpuInfo() {
  let cpus = [];
  try {
    cpus = os.cpus() || [];
  } catch {
    cpus = [];
  }
  const first = cpus[0] || {};
  return {
    model: (first.model || "").trim() || null,
    speedMhz: typeof first.speed === "number" ? first.speed : null,
    logicalCores: cpus.length || null,
    // os.cpus() lists logical processors; SMT-aware physical count is not
    // reliably available cross-platform, so it is left out rather than guessed.
  };
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = typeof total === "number" && typeof free === "number" ? total - free : null;
  const usedPercent =
    typeof used === "number" && total ? Math.round((used / total) * 1000) / 10 : null;
  return {
    totalBytes: total || null,
    freeBytes: free || null,
    usedBytes: used,
    total: formatBytes(total),
    free: formatBytes(free),
    used: formatBytes(used),
    usedPercent,
  };
}

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const [name, list] of Object.entries(interfaces || {})) {
    for (const entry of list || []) {
      if (entry.internal) continue;
      if (entry.family !== "IPv4" && entry.family !== 4) continue;
      addresses.push({ interface: name, address: entry.address });
    }
  }
  return {
    hostname: os.hostname() || null,
    lanAddresses: addresses,
  };
}

/**
 * Full snapshot for the Settings UI.
 */
export function getSystemInfo() {
  const release = getOsRelease();
  const platform = process.platform;

  return {
    generatedAt: new Date().toISOString(),
    os: {
      platform,
      platformLabel: PLATFORM_LABELS[platform] || platform,
      type: os.type(),
      release: os.release(),
      version: os.version(),
      arch: os.arch(),
      endianness: os.endianness(),
      releaseName: release?.prettyName || release?.name || null,
      distro: release,
      uptimeSeconds: Math.floor(os.uptime()),
    },
    host: getNetworkInfo(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    runtime: {
      node: process.version,
      // process.versions reports the V8 engine version — handy context when
      // diagnosing native module / better-sqlite3 issues.
      v8: process.versions.v8 || null,
      uv: process.versions.uv || null,
      pid: process.pid,
      cwd: process.cwd(),
      processUptimeSeconds: Math.floor(process.uptime()),
    },
    app: {
      dataDir: process.env.DATA_DIR || null,
      nodeEnv: process.env.NODE_ENV || null,
    },
  };
}
