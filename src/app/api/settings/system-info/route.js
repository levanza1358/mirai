import { NextResponse } from "next/server";
import { getSystemInfo } from "@/lib/systemInfo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Auth enforced globally by src/dashboardGuard.js (deny-by-default on /api/*).
export async function GET() {
  try {
    return NextResponse.json(
      { success: true, ...getSystemInfo() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read system info" },
      { status: 500 }
    );
  }
}
