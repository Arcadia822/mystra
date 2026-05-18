import { NextResponse } from "next/server";
import { taskSpecSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET() {
  return NextResponse.json({ tasks: getDb().listTasks() });
}

export async function POST(request: Request) {
  try {
    const snapshot = getDb().createTask(taskSpecSchema.parse(await request.json()));
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return jsonError(error, 400);
  }
}
