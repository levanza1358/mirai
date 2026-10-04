import { NextResponse } from "next/server";
import net from "net";
import {
  DEFAULT_PORT,
  isValidPort,
  readPersistedPort,
  resolvePort,
  writePersistedPort,
} from "@/lib/portConfig";
import { spawnDetachedRestart } from "@/lib/appUpdater";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store" };

function testPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (err) => {
      resolve({ available: false, reason: err.code === "EADDRINUSE" ? "in-use" : err.code || "error" });
    });
    server.once("listening", () => {
      server.close(() => resolve({ available: true, reason: "free" }));
    });
    server.listen({ port, host: "0.0.0.0", exclusive: true });
  });
}

export async function GET() {
  return NextResponse.json(
    { success: true, currentPort: resolvePort(), persistedPort: readPersistedPort(), defaultPort: DEFAULT_PORT },
    { headers: HEADERS }
  );
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400, headers: HEADERS });
  }

  const port = parseInt(body.port, 10);
  if (!isValidPort(port)) {
    return NextResponse.json({ success: false, error: "Port must be between 1 and 65535" }, { status: 400, headers: HEADERS });
  }

  const current = resolvePort();

  // Requirement: the new port must be tested first, and only applied when free.
  // Re-applying the port we are already on is allowed.
  if (port !== current) {
    const result = await testPortAvailable(port);
    if (!result.available) {
      return NextResponse.json(
        {
          success: false,
          error:
            result.reason === "in-use"
              ? `Port ${port} is already in use. Pick another port.`
              : `Port ${port} cannot be used (${result.reason}).`,
          reason: result.reason,
        },
        { status: 409, headers: HEADERS }
      );
    }
  }

  try {
    writePersistedPort(port);
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: HEADERS });
  }

  // The new port only takes effect after a restart. Prefer the CLI launcher
  // (`mirai restart`) so the server keeps its tray/foreground mode and runtime env;
  // fall back to an in-process relaunch when the launcher is unavailable.
  const restartMode = spawnDetachedRestart(port);

  const response = NextResponse.json(
    {
      success: true,
      port,
      restarting: true,
      restartMode,
      message: `Port set to ${port}. Mirai is restarting — reconnect at http://localhost:${port}.`,
    },
    { headers: HEADERS }
  );

  // Let the HTTP response flush before this process exits (fallback path only).
  if (restartMode === "in-process") setTimeout(() => process.exit(0), 800);
  return response;
}
