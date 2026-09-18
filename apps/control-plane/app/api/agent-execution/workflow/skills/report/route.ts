import { getDb } from "@/lib/db";
import { createWorkflowSkillExecutionDeliveryService } from "@/lib/workflows/workflow-skill-execution-delivery-service-factory";
import { executionCode } from "../../../../_task-production-http";

export async function POST(request: Request) {
  try {
    const result = await (await createWorkflowSkillExecutionDeliveryService(await getDb())).report({
      code: executionCode(request), report: await request.json(),
    });
    return Response.json(result, { status: result.accepted ? 200 : 409, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "workflow_skill_projection_failed", message: "Workflow Skill report failed" } }, { status: 403, headers: { "cache-control": "no-store" } });
  }
}
