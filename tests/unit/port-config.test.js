import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// portConfig caches the resolved data dir at module scope, so each test gets a
// fresh module instance via resetModules() after pointing DATA_DIR at a tmpdir.

let tmpDir;

async function loadModule() {
  vi.resetModules();
  return import("../../src/lib/portConfig.js");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-port-"));
  delete process.env.PORT;
  process.env.DATA_DIR = tmpDir;
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  delete process.env.PORT;
  delete process.env.DATA_DIR;
  delete process.env.MIRAI_DATA_DIR;
});

describe("portConfig", () => {
  it("defaults to 1463", async () => {
    const { DEFAULT_PORT, resolvePort } = await loadModule();
    expect(DEFAULT_PORT).toBe(1463);
    expect(resolvePort()).toBe(1463);
  });

  it("validates port ranges and reserved ports", async () => {
    const { isValidPort } = await loadModule();
    expect(isValidPort(1463)).toBe(true);
    expect(isValidPort("1463")).toBe(true);
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort("abc")).toBe(false);
    expect(isValidPort(20129)).toBe(false); // reserved updater status port
  });

  it("persists and reads a port", async () => {
    const { writePersistedPort, readPersistedPort, getPortConfigPath } = await loadModule();
    expect(readPersistedPort()).toBeNull();
    writePersistedPort(8123);
    expect(readPersistedPort()).toBe(8123);
    const raw = JSON.parse(fs.readFileSync(getPortConfigPath(), "utf-8"));
    expect(raw).toEqual({ port: 8123 });
  });

  it("rejects invalid persisted ports", async () => {
    const { writePersistedPort } = await loadModule();
    expect(() => writePersistedPort(20129)).toThrow();
    expect(() => writePersistedPort(-1)).toThrow();
    expect(() => writePersistedPort("nope")).toThrow();
  });

  it("treats a corrupt config file as absent", async () => {
    const { getPortConfigPath, readPersistedPort } = await loadModule();
    const file = getPortConfigPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{ not-json", "utf-8");
    expect(readPersistedPort()).toBeNull();
  });

  it("lets the PORT env override the persisted port", async () => {
    const { writePersistedPort, resolvePort, readPersistedPort } = await loadModule();
    writePersistedPort(8123);
    process.env.PORT = "9123";
    expect(resolvePort()).toBe(9123);
    expect(readPersistedPort()).toBe(8123);
  });
});
