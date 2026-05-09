import { NextResponse } from "next/server";

import { createLocalJob, listLocalJobs } from "@/lib/local-store";
import { jsonError } from "@/lib/http";

export async function GET() {
  return NextResponse.json({ jobs: listLocalJobs() });
}

export async function POST(request: Request) {
  try {
    const snapshot = createLocalJob(await request.json());
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
