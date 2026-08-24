import { Readable } from "node:stream";

import { skillRequestContext, skillRouteError } from "../../../../_http";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillId: string; revisionId: string }> },
) {
  try {
    const { services, teamId } = await skillRequestContext(request, "skill-revision-download", "team.resource.access");
    const { skillId, revisionId } = await context.params;
    const download = await services.preview.download({ teamId, skillId, revisionId });
    const digest = Buffer.from(download.revision.zipSha256, "hex").toString("base64");
    return new Response(Readable.toWeb(download.body) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(download.contentLength),
        "Content-Disposition": `attachment; filename="${download.skill.name}-r${download.revision.sequence}.zip"`,
        Digest: `sha-256=${digest}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return skillRouteError(error);
  }
}
