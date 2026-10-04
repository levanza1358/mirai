import { NextResponse } from "next/server";
import net from "net";
import {
  DEFAULT_PORT,
  RESERVED_PORTS,
  isValidPort,
  readPersistedPort,
  resolvePort,
} from "@/lib/portConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store" };

// Ask the OS whether a TCP port is free to bind on 0.0.0.0.
function testPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (err) => {
      resolve({
        available: false,
        reason: err.code === "EADDRINUSE" ? "in-use" : err.code || "error",
      });
    });
    server.once("listening", () => {
      server.close(() => resolve({ available: true, reason: "free" }));
    });
    // Bind all interfaces so we catch processes that only bound 127.0.0.1 too.
    server.listen({ port, host: "0.0.0.0", exclusive: true });
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("port");

  const current = resolvePort();

  if (raw === null || raw.trim() === "") {
    return NextResponse.json(
      { success: true, currentPort: current, defaultPort: DEFAULT_PORT },
      { headers: HEADERS }
    );
  }

  const port = parseInt(raw, 10);
  if (!isValidPort(port)) {
    return NextResponse.json(
      {
        success: true,
        port: raw,
        available: false,
        reason: RESERVED_PORTS.has(port) ? "reserved" : "invalid",
        currentPort: current,
      },
      { headers: HEADERS }
    );
  }

  // The port this instance is already on is trivially "in use" by us — report it
  // as available so the UI lets the user re-save the same value.
  if (port === current) {
    return NextResponse.json(
      { success: true, port, available: true, reason: "current", currentPort: current },
      { headers: HEADERS }
    );
  }

  const result = await testPortAvailable(port);
  return NextResponse.json(
    {
      success: true,
      port,
      available: result.available,
      reason: result.reason,
      currentPort: current,
      persistedPort: readPersistedPort(),
    },
    { headers: HEADERS }
  );
}
