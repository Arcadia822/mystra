import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ runners: getDb().listRunners() });
}
