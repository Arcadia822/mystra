import { Readable } from "node:stream";

import { getDb } from "@/lib/db";
import { createWorkflowSkillDeliveryService } from "@/lib/workflows/workflow-skill-delivery-service-factory";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string; skillId: string; revisionId: string }> },
) {
  const teamId = request.headers.get("x-mystra-team-id");
  const leaseToken = request.headers.get("x-mystra-lease-token");
  if (!teamId || !leaseToken) return denied();
  try {
    const { sessionId, skillId, revisionId } = await context.params;
    const download = await (await createWorkflowSkillDeliveryService(await getDb())).download({
      sessionId, teamId, leaseToken, skillId, revisionId,
    });
    return new Response(Readable.toWeb(download.body) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(download.contentLength),
        Digest: `sha-256=${Buffer.from(download.revision.zipSha256, "hex").toString("base64")}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return denied();
  }
}

function denied() {
  return Response.json({ error: { code: "WORKFLOW_SKILL_DELIVERY_DENIED", message: "Workflow Skill delivery was denied" } }, { status: 403 });
}
