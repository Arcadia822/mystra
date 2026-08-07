import { NextResponse } from "next/server";
import { taskCreateRequestSchema, taskCreateResponseSchema, taskListResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementException } from "@/lib/management-http";

export async function GET() {
  const db = await getDb();
  return NextResponse.json(taskListResponseSchema.parse({ tasks: await db.listTasks() }));
}

export async function POST(request: Request) {
  try {
    const db = await getDb();
    const task = await db.createTask(taskCreateRequestSchema.parse(await request.json()));
    return NextResponse.json(taskCreateResponseSchema.parse({ task }), { status: 201 });
  } catch (error) {
    return managementException(error, "INVALID_TASK");
  }
}
