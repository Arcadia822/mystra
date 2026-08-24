import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SKILL_MAX_ARCHIVE_BYTES, managementErrorResponseSchema, type Permission } from "@mystra/shared";

import { getDb } from "@/lib/db";
import { SkillFailure, asSkillFailure, skillHttpStatus } from "@/lib/skills/skill-errors";
import { createSkillServices } from "@/lib/skills/skill-service-factory";
import { authorizationErrorResponse, requireHumanSession, requireTeamPermission } from "../_auth";

export async function skillRequestContext(
  request: Request,
  operation: string,
  permission: Permission,
) {
  const db = await getDb();
  const subject = await requireHumanSession(db, request, operation);
  const active = await requireTeamPermission(db, subject, permission);
  return {
    db,
    subject,
    teamId: active.team.id,
    services: await createSkillServices(db),
  };
}

export function skillRouteError(error: unknown): NextResponse {
  try {
    return authorizationErrorResponse(error);
  } catch {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: { code: "invalid_request", message: "Invalid request", details: { issues: error.issues } },
      }, { status: 400 });
    }
    const failure = asSkillFailure(error);
    return NextResponse.json(managementErrorResponseSchema.parse({
      error: {
        code: failure.code,
        message: failure.message,
        ...(failure.details ? { details: failure.details } : {}),
      },
    }), { status: skillHttpStatus(failure.code) });
  }
}

export async function readZipRequest(request: Request): Promise<Buffer> {
  if (request.headers.get("content-type")?.toLowerCase() !== "application/zip") {
    throw new SkillFailure("invalid_content_type", "Content-Type must be application/zip");
  }
  const rawLength = request.headers.get("content-length");
  if (!rawLength || !/^(?:0|[1-9][0-9]*)$/u.test(rawLength)) {
    throw new SkillFailure("content_length_required", "A valid Content-Length header is required");
  }
  const contentLength = Number(rawLength);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > SKILL_MAX_ARCHIVE_BYTES) {
    throw new SkillFailure("skill_zip_too_large", "ZIP exceeds the upload limit", { limit: SKILL_MAX_ARCHIVE_BYTES });
  }
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length !== contentLength || buffer.length > SKILL_MAX_ARCHIVE_BYTES) {
    throw new SkillFailure("invalid_skill_zip", "ZIP body length does not match Content-Length");
  }
  return buffer;
}

export function parseIfMatch(request: Request): number {
  const match = /^"([1-9][0-9]*)"$/u.exec(request.headers.get("if-match") ?? "");
  if (!match) throw new SkillFailure("revision_conflict", "If-Match must contain the quoted current resource revision");
  const revision = Number(match[1]);
  if (!Number.isSafeInteger(revision)) throw new SkillFailure("revision_conflict", "If-Match revision is invalid");
  return revision;
}

export function skillEtag(resourceRevision: number): string {
  return `"${resourceRevision}"`;
}
