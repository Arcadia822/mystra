import { Readable } from "node:stream";

import { getDb } from "@/lib/db";
import { createWorkflowSkillExecutionDeliveryService } from "@/lib/workflows/workflow-skill-execution-delivery-service-factory";
import { executionCode } from "../../../../../../../_task-production-http";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillId: string; revisionId: string }> },
) {
  try {
    const { skillId, revisionId } = await context.params;
    const download = await (await createWorkflowSkillExecutionDeliveryService(await getDb())).download({
      code: executionCode(request), skillId, revisionId,
    });
    return new Response(Readable.toWeb(download.body) as ReadableStream, { headers: {
      "Content-Type": "application/zip", "Content-Length": String(download.contentLength),
      Digest: `sha-256=${Buffer.from(download.revision.zipSha256, "hex").toString("base64")}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return Response.json({ error: { code: "workflow_skill_projection_failed", message: "Workflow Skill delivery failed" } }, { status: 403, headers: { "cache-control": "no-store" } });
  }
}
