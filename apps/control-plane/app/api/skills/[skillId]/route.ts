import { NextResponse } from "next/server";
import { skillDetailSchema } from "@mystra/shared";

import { skillEtag, skillRequestContext, skillRouteError } from "../_http";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const { services, teamId } = await skillRequestContext(request, "skill-get", "team.resource.access");
    const { skillId } = await context.params;
    const skill = skillDetailSchema.parse(await services.query.get({ teamId, skillId }));
    return NextResponse.json(skill, { headers: { ETag: skillEtag(skill.resourceRevision) } });
  } catch (error) {
    return skillRouteError(error);
  }
}
