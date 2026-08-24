import { NextResponse } from "next/server";
import {
  skillPublicationResponseSchema,
  skillRevisionListQuerySchema,
  skillRevisionPageSchema,
} from "@mystra/shared";

import { parseIfMatch, readZipRequest, skillEtag, skillRequestContext, skillRouteError } from "../../_http";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const { services, teamId } = await skillRequestContext(request, "skill-revisions-list", "team.resource.access");
    const { skillId } = await context.params;
    const query = skillRevisionListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(skillRevisionPageSchema.parse(await services.query.listRevisions({ teamId, skillId, ...query })));
  } catch (error) {
    return skillRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const { services, subject, teamId } = await skillRequestContext(request, "skill-revision-publish", "team.skill.manage");
    const { skillId } = await context.params;
    const published = await services.publication.publishRevision({
      teamId,
      skillId,
      expectedResourceRevision: parseIfMatch(request),
      createdByUserId: subject.user.id,
      zipBuffer: await readZipRequest(request),
    });
    const [skill, revision] = await Promise.all([
      services.query.get({ teamId, skillId }),
      services.query.getRevision({ teamId, skillId, revisionId: published.revision.id }),
    ]);
    return NextResponse.json(skillPublicationResponseSchema.parse({ skill, revision }), {
      status: 201,
      headers: { ETag: skillEtag(skill.resourceRevision) },
    });
  } catch (error) {
    return skillRouteError(error);
  }
}
