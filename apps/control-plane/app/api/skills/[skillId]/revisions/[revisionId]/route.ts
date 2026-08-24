import { NextResponse } from "next/server";
import { skillRevisionDetailSchema } from "@mystra/shared";

import { skillRequestContext, skillRouteError } from "../../../_http";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillId: string; revisionId: string }> },
) {
  try {
    const { services, teamId } = await skillRequestContext(request, "skill-revision-get", "team.resource.access");
    const { skillId, revisionId } = await context.params;
    return NextResponse.json(skillRevisionDetailSchema.parse(
      await services.query.getRevision({ teamId, skillId, revisionId }),
    ));
  } catch (error) {
    return skillRouteError(error);
  }
}
