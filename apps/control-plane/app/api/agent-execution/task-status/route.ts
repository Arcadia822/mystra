import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { createAgentExecutionService } from "@/lib/tasks/agent-execution-service-factory";
import { executionCode, noStore, taskProductionErrorResponse } from "../../_task-production-http";

export async function GET(request: Request) {
  try {
    return noStore(NextResponse.json(
      await createAgentExecutionService(await getDb()).taskStatus(executionCode(request)),
    ));
  } catch (error) { return taskProductionErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    return noStore(NextResponse.json(
      await createAgentExecutionService(await getDb()).setTaskStatus(executionCode(request), await request.json()),
    ));
  } catch (error) { return taskProductionErrorResponse(error); }
}
