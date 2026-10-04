import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const cliPath = path.join(root, "cli", "cli.js");
const cliSrc = fs.readFileSync(cliPath, "utf-8");

describe("mirai CLI launcher", () => {
  it("defaults to port 1463 (matches src/lib/portConfig.js)", () => {
    expect(cliSrc).toMatch(/const\s+DEFAULT_PORT\s*=\s*1463\s*;/);
  });

  it("persists the port to <dataDir>/config/port.json", () => {
    expect(cliSrc).toMatch(/"config",\s*"port\.json"/);
  });

  it("reserves the updater status port 20129", () => {
    expect(cliSrc).toMatch(/n\s*!==\s*20129/);
  });

  it("implements the restart command with --port support", () => {
    expect(cliSrc).toMatch(/function\s+handleRestartCommand\s*\(/);
    expect(cliSrc).toMatch(/args\[0\]\s*===\s*"restart"/);
    expect(cliSrc).toMatch(/a\s*===\s*"--port"\s*\|\|\s*a\s*===\s*"-p"/);
  });

  it("kills whatever holds the target/persisted port before relaunching", () => {
    expect(cliSrc).toMatch(/function\s+killByPort\s*\(/);
    // must consider both the target port and the persisted port
    expect(cliSrc).toMatch(/portsToKill\s*=\s*\[\.\.\.new\s+Set\(\[targetPort,\s*persisted\]/);
  });

  it("relaunches detached in background/tray mode so no TTY is required", () => {
    expect(cliSrc).toMatch(/const\s+relaunchArgs\s*=\s*\["--tray",\s*"--skip-update"\]/);
    expect(cliSrc).toMatch(/detached:\s*true/);
  });

  it("falls back to the local .next/standalone build when app/ is absent", () => {
    expect(cliSrc).toMatch(/\.next",\s*"standalone"/);
  });
});

describe("project launcher files", () => {
  it("ships a mirai.cmd launcher for Windows cmd", () => {
    const f = path.join(root, "mirai.cmd");
    expect(fs.existsSync(f)).toBe(true);
    const src = fs.readFileSync(f, "utf-8");
    expect(src).toMatch(/cli\\cli\.js/);
  });

  it("ships a bash mirai launcher", () => {
    const f = path.join(root, "mirai");
    expect(fs.existsSync(f)).toBe(true);
    const src = fs.readFileSync(f, "utf-8");
    expect(src).toMatch(/cli\/cli\.js/);
  });
});
