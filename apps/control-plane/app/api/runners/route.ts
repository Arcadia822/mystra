import { NextResponse } from "next/server";

import { listLocalRunners } from "@/lib/local-store";

export async function GET() {
  return NextResponse.json({ runners: listLocalRunners() });
}
