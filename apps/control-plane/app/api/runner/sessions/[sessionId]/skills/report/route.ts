import { getDb } from "@/lib/db";
import { createWorkflowSkillDeliveryService } from "@/lib/workflows/workflow-skill-delivery-service-factory";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const teamId = request.headers.get("x-mystra-team-id");
  const leaseToken = request.headers.get("x-mystra-lease-token");
  if (!teamId || !leaseToken) return denied();
  try {
    const { sessionId } = await context.params;
    const result = await (await createWorkflowSkillDeliveryService(await getDb())).report({
      sessionId, teamId, leaseToken, report: await request.json(),
    });
    return Response.json(result, { status: result.accepted ? 200 : 409 });
  } catch {
    return denied();
  }
}

function denied() {
  return Response.json({ error: { code: "WORKFLOW_SKILL_DELIVERY_DENIED", message: "Workflow Skill delivery was denied" } }, { status: 403 });
}
