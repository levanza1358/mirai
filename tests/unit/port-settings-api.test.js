import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Integration-ish test for the port settings API. Runs against a real data dir
// (tmpdir) so portConfig's persistence is exercised for real. The availability
// probe binds a real socket, so we hold a port open to simulate "in use".

let tmpDir;

function findFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "0.0.0.0", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function loadRoutes() {
  vi.resetModules();
  vi.doMock("next/server", () => ({
    NextResponse: {
      json(body, init = {}) {
        return new Response(JSON.stringify(body), {
          status: init.status || 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  }));
  // Never actually restart the process during tests.
  vi.doMock("@/lib/appUpdater", () => ({
    spawnDetachedRestart: vi.fn(() => "none"),
  }));
  const portRoute = await import("@/app/api/settings/port/route.js");
  const checkRoute = await import("@/app/api/settings/port/check/route.js");
  return {
    portRoute,
    checkRoute,
    appUpdater: await import("@/lib/appUpdater"),
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-port-api-"));
  process.env.DATA_DIR = tmpDir;
  delete process.env.PORT;
});

afterEach(() => {
  delete process.env.DATA_DIR;
  delete process.env.PORT;
  vi.doUnmock("next/server");
  vi.doUnmock("@/lib/appUpdater");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("GET /api/settings/port", () => {
  it("reports the default port and no persisted value", async () => {
    const { portRoute } = await loadRoutes();
    const res = await portRoute.GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.currentPort).toBe(1463);
    expect(body.defaultPort).toBe(1463);
    expect(body.persistedPort).toBeNull();
  });
});

describe("GET /api/settings/port/check", () => {
  it("marks the current port as available (reason: current)", async () => {
    const { checkRoute } = await loadRoutes();
    const res = await checkRoute.GET(new Request("http://x/api/settings/port/check?port=1463"));
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.reason).toBe("current");
  });

  it("reports a free port as available", async () => {
    const { checkRoute } = await loadRoutes();
    const free = await findFreePort();
    const res = await checkRoute.GET(new Request(`http://x/api/settings/port/check?port=${free}`));
    const body = await res.json();
    expect(body.available).toBe(true);
    expect(body.reason).toBe("free");
  });

  it("reports an occupied port as in-use", async () => {
    const { checkRoute } = await loadRoutes();
    const busy = await findFreePort();
    const blocker = net.createServer();
    await new Promise((r) => blocker.listen(busy, "0.0.0.0", r));
    try {
      const res = await checkRoute.GET(new Request(`http://x/api/settings/port/check?port=${busy}`));
      const body = await res.json();
      expect(body.available).toBe(false);
      expect(body.reason).toBe("in-use");
    } finally {
      await new Promise((r) => blocker.close(r));
    }
  });

  it("rejects the reserved updater port", async () => {
    const { checkRoute } = await loadRoutes();
    const res = await checkRoute.GET(new Request("http://x/api/settings/port/check?port=20129"));
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.reason).toBe("reserved");
  });
});

describe("POST /api/settings/port", () => {
  it("persists a free port and triggers a restart", async () => {
    const { portRoute, appUpdater } = await loadRoutes();
    const free = await findFreePort();
    const res = await portRoute.POST(
      new Request("http://x/api/settings/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: free }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.port).toBe(free);
    expect(body.restarting).toBe(true);
    expect(appUpdater.spawnDetachedRestart).toHaveBeenCalledWith(free);

    const persisted = JSON.parse(fs.readFileSync(path.join(tmpDir, "config", "port.json"), "utf-8"));
    expect(persisted).toEqual({ port: free });
  });

  it("refuses an in-use port with 409 and does not persist", async () => {
    const { portRoute, appUpdater } = await loadRoutes();
    const busy = await findFreePort();
    const blocker = net.createServer();
    await new Promise((r) => blocker.listen(busy, "0.0.0.0", r));
    try {
      const res = await portRoute.POST(
        new Request("http://x/api/settings/port", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ port: busy }),
        })
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.reason).toBe("in-use");
      expect(appUpdater.spawnDetachedRestart).not.toHaveBeenCalled();
      expect(fs.existsSync(path.join(tmpDir, "config", "port.json"))).toBe(false);
    } finally {
      await new Promise((r) => blocker.close(r));
    }
  });

  it("rejects invalid input with 400", async () => {
    const { portRoute } = await loadRoutes();
    const res = await portRoute.POST(
      new Request("http://x/api/settings/port", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: 70000 }),
      })
    );
    expect(res.status).toBe(400);
  });
});
