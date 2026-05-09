import { NextResponse } from "next/server";
import { jobSpecSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET() {
  return NextResponse.json({ jobs: getDb().listJobs() });
}

export async function POST(request: Request) {
  try {
    const snapshot = getDb().createJob(jobSpecSchema.parse(await request.json()));
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}
