// Ensure proxyFetch is loaded to patch globalThis.fetch
import "open-sse/index.js";

import { getProviderConnectionById } from "@/lib/localDb";
import { checkInCodeBuddy, getCodeBuddyCheckinStatus, isCodeBuddyCheckinProvider } from "open-sse/services/usage.js";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { refreshAndUpdateCredentials } from "../route.js";

const AUTH_EXPIRED_PATTERNS = ["expired", "authentication", "unauthorized", "401", "403", "re-authorize"];

function isAuthExpiredMessage(message) {
  if (!message) return false;
  const value = String(message).toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some((pattern) => value.includes(pattern));
}

async function resolveCheckinConnection(connectionId) {
  const connection = await getProviderConnectionById(connectionId);
  if (!connection) {
    return { response: Response.json({ error: "Connection not found" }, { status: 404 }) };
  }
  if (!isCodeBuddyCheckinProvider(connection.provider)) {
    return {
      response: Response.json(
        { error: "Daily check-in is only available for CodeBuddy (CN/International) connections." },
        { status: 400 },
      ),
    };
  }

  const proxyConfig = await resolveConnectionProxyConfig(connection.providerSpecificData);
  const proxyOptions = {
    connectionProxyEnabled: proxyConfig.connectionProxyEnabled === true,
    connectionProxyUrl: proxyConfig.connectionProxyUrl || "",
    connectionNoProxy: proxyConfig.connectionNoProxy || "",
    vercelRelayUrl: proxyConfig.vercelRelayUrl || "",
    strictProxy: false,
  };

  return { connection, proxyOptions };
}

// Refresh the OAuth token (persisting the new one) before hitting the billing
// host — the check-in endpoints reject stale tokens with HTTP 401.
async function refreshIfNeeded(connection, proxyOptions) {
  if (connection.authType !== "oauth" || !connection.refreshToken) {
    return { connection };
  }
  try {
    const result = await refreshAndUpdateCredentials(connection, false, proxyOptions);
    return { connection: result.connection };
  } catch (refreshError) {
    console.warn("[CodeBuddy Check-in] Credential refresh skipped:", refreshError.message);
    return { connection };
  }
}

export async function GET(_request, { params }) {
  let connection;
  try {
    const { connectionId } = await params;
    const resolved = await resolveCheckinConnection(connectionId);
    if (resolved.response) return resolved.response;
    ({ connection } = resolved);
    const { proxyOptions } = resolved;

    const refreshed = await refreshIfNeeded(connection, proxyOptions);
    connection = refreshed.connection;

    const status = await getCodeBuddyCheckinStatus(connection, proxyOptions);
    return Response.json(status);
  } catch (error) {
    const provider = connection?.provider ?? "unknown";
    console.warn(`[CodeBuddy Check-in] status ${provider}: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(_request, { params }) {
  let connection;
  try {
    const { connectionId } = await params;
    const resolved = await resolveCheckinConnection(connectionId);
    if (resolved.response) return resolved.response;
    ({ connection } = resolved);
    const { proxyOptions } = resolved;

    const refreshed = await refreshIfNeeded(connection, proxyOptions);
    connection = refreshed.connection;

    let result = await checkInCodeBuddy(connection, proxyOptions);

    // A 401-flavoured failure on the check-in itself means the token went stale
    // mid-flight — force one refresh and retry.
    if (
      result.status === "failed" &&
      connection.authType === "oauth" &&
      connection.refreshToken &&
      isAuthExpiredMessage(result.message)
    ) {
      try {
        const retry = await refreshAndUpdateCredentials(connection, true, proxyOptions);
        connection = retry.connection;
        result = await checkInCodeBuddy(connection, proxyOptions);
      } catch (retryError) {
        console.warn(`[CodeBuddy Check-in] force refresh failed: ${retryError.message}`);
      }
    }

    return Response.json(result);
  } catch (error) {
    const provider = connection?.provider ?? "unknown";
    console.warn(`[CodeBuddy Check-in] ${provider}: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
