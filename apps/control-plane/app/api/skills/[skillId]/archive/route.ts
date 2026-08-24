import { NextResponse } from "next/server";
import { skillDetailSchema } from "@mystra/shared";

import { parseIfMatch, skillEtag, skillRequestContext, skillRouteError } from "../../_http";

export async function POST(
  request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const { services, subject, teamId } = await skillRequestContext(request, "skill-archive", "team.skill.manage");
    const { skillId } = await context.params;
    const archived = await services.publication.archive({
      teamId,
      skillId,
      expectedResourceRevision: parseIfMatch(request),
      archivedByUserId: subject.user.id,
    });
    const skill = skillDetailSchema.parse(await services.query.get({ teamId, skillId }));
    return NextResponse.json(skill, { headers: { ETag: skillEtag(archived.resourceRevision) } });
  } catch (error) {
    return skillRouteError(error);
  }
}
