import { NextResponse } from "next/server";
import {
  disableAutoStart,
  enableAutoStart,
  getAutoStartStatus,
} from "@/lib/autostart";
import { buildLauncherEnv, resolveLauncher } from "@/lib/launcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Auth is enforced globally by the proxy in `src/dashboardGuard.js`: every
// `/api/*` path is deny-by-default and `/api/settings/*` is protected, so both
// GET and POST here already require a valid dashboard session (or CLI token).

const HEADERS = { "Cache-Control": "no-store" };

function json(body, init) {
  return NextResponse.json(body, { ...init, headers: HEADERS });
}

export async function GET() {
  const status = getAutoStartStatus();
  const launcher = resolveLauncher();

  return json({
    success: true,
    ...status,
    // Surfaced so the UI can explain *what* will be started, and warn when the
    // launcher cannot be located (autostart would point at nothing).
    launcher: launcher
      ? { source: launcher.source, command: launcher.command, args: launcher.args, cwd: launcher.cwd }
      : null,
    launcherResolved: !!launcher,
  });
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action || body.enabled || "").toLowerCase();
  const wantsEnable = action === "enable" || action === "true" || body.enabled === true;

  const support = getAutoStartStatus();
  if (!support.supported) {
    return json(
      { success: false, error: `Autostart is not supported on ${support.platform}.` },
      { status: 400 }
    );
  }
  if (!support.manageable) {
    return json(
      {
        success: false,
        error:
          "On macOS the autostart agent is managed by the Mirai tray helper, not the dashboard.",
      },
      { status: 400 }
    );
  }

  let result;
  if (wantsEnable) {
    const launcher = resolveLauncher();
    if (!launcher) {
      return json(
        {
          success: false,
          error:
            "Could not locate the Mirai launcher (cli/cli.js). Reinstall with install.sh so autostart has something to run.",
        },
        { status: 409 }
      );
    }
    result = enableAutoStart({
      command: launcher.command,
      args: launcher.args,
      cwd: launcher.cwd,
      env: buildLauncherEnv(),
    });
  } else {
    result = disableAutoStart();
  }

  if (!result?.ok) {
    return json(
      { success: false, error: result?.error || "Autostart operation failed." },
      { status: 500 }
    );
  }

  const status = getAutoStartStatus();
  return json({
    success: true,
    enabled: status.enabled,
    mechanism: result.mechanism || status.mechanism,
    warning: result.warning || null,
    ...status,
  });
}
