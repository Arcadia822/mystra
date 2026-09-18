import { NextResponse } from "next/server";
import { workflowCurrentResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { createWorkflowWorkloadService } from "@/lib/workflows/workflow-workload-service-factory";
import { executionCode, noStore } from "../../../_task-production-http";
import { workflowRouteError } from "../../../_workflow-http";

export async function GET(request: Request) {
  try {
    const result = await createWorkflowWorkloadService(await getDb()).current(executionCode(request));
    return noStore(NextResponse.json(workflowCurrentResponseSchema.parse(result)));
  } catch (error) {
    return noStore(workflowRouteError(error));
  }
}
