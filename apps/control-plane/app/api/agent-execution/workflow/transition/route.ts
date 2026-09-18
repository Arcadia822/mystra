import { NextResponse } from "next/server";
import { workflowTransitionResponseSchema } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { createWorkflowWorkloadService } from "@/lib/workflows/workflow-workload-service-factory";
import { executionCode, noStore } from "../../../_task-production-http";
import { workflowRouteError } from "../../../_workflow-http";

export async function POST(request: Request) {
  try {
    const result = await createWorkflowWorkloadService(await getDb()).transition(
      executionCode(request), await request.json(),
    );
    return noStore(NextResponse.json(workflowTransitionResponseSchema.parse(result)));
  } catch (error) {
    return noStore(workflowRouteError(error));
  }
}
