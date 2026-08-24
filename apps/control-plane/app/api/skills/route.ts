import { NextResponse } from "next/server";
import { skillListQuerySchema, skillPageSchema, skillPublicationResponseSchema } from "@mystra/shared";

import { readZipRequest, skillEtag, skillRequestContext, skillRouteError } from "./_http";

export async function GET(request: Request) {
  try {
    const { services, teamId } = await skillRequestContext(request, "skill-list", "team.resource.access");
    const query = skillListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json(skillPageSchema.parse(await services.query.list({ teamId, ...query })));
  } catch (error) {
    return skillRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { services, subject, teamId } = await skillRequestContext(request, "skill-create", "team.skill.manage");
    const published = await services.publication.create({
      teamId,
      createdByUserId: subject.user.id,
      zipBuffer: await readZipRequest(request),
    });
    const [skill, revision] = await Promise.all([
      services.query.get({ teamId, skillId: published.skill.id }),
      services.query.getRevision({ teamId, skillId: published.skill.id, revisionId: published.revision.id }),
    ]);
    return NextResponse.json(skillPublicationResponseSchema.parse({ skill, revision }), {
      status: 201,
      headers: { ETag: skillEtag(skill.resourceRevision) },
    });
  } catch (error) {
    return skillRouteError(error);
  }
}
