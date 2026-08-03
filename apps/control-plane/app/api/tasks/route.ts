import { NextResponse } from "next/server";
import { taskCreateRequestSchema, taskCreateResponseSchema, taskListResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { managementException } from "@/lib/management-http";

export async function GET() {
  return NextResponse.json(taskListResponseSchema.parse({ tasks: getDb().listTasks() }));
}

export async function POST(request: Request) {
  try {
    const task = getDb().createTask(taskCreateRequestSchema.parse(await request.json()));
    return NextResponse.json(taskCreateResponseSchema.parse({ task }), { status: 201 });
  } catch (error) {
    return managementException(error, "INVALID_TASK");
  }
}
