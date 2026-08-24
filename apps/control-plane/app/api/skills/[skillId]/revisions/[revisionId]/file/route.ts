import { NextResponse } from "next/server";
import { skillFilePreviewResponseSchema } from "@mystra/shared";

import { SkillFailure } from "@/lib/skills/skill-errors";
import { skillRequestContext, skillRouteError } from "../../../../_http";

export async function GET(
  request: Request,
  context: { params: Promise<{ skillId: string; revisionId: string }> },
) {
  try {
    const { services, teamId } = await skillRequestContext(request, "skill-file-preview", "team.resource.access");
    const { skillId, revisionId } = await context.params;
    const path = new URL(request.url).searchParams.get("path");
    if (!path) throw new SkillFailure("skill_file_not_found", "Skill file not found");
    const preview = skillFilePreviewResponseSchema.parse(
      await services.preview.preview({ teamId, skillId, revisionId, path }),
    );
    return NextResponse.json(preview, {
      headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    return skillRouteError(error);
  }
}
