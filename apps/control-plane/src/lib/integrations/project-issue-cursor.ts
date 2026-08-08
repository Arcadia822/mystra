import { z } from "zod";

import { IntegrationFailure } from "./errors";

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  provider: z.enum(["github", "linear"]),
  projectId: z.string().uuid(),
  connectionId: z.string().uuid(),
  scopeExternalId: z.string().min(1).max(1_000),
  upstreamCursor: z.string().min(1).max(4_096),
}).strict();

export type ProjectIssueCursorScope = Omit<z.infer<typeof cursorPayloadSchema>, "version" | "upstreamCursor">;

export function encodeProjectIssueCursor(
  scope: ProjectIssueCursorScope,
  upstreamCursor: string,
): string {
  return Buffer.from(JSON.stringify(cursorPayloadSchema.parse({
    version: 1,
    ...scope,
    upstreamCursor,
  })), "utf8").toString("base64url");
}

export function decodeProjectIssueCursor(
  cursor: string,
  expected: ProjectIssueCursorScope,
): string {
  try {
    const parsed = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (
      parsed.provider !== expected.provider
      || parsed.projectId !== expected.projectId
      || parsed.connectionId !== expected.connectionId
      || parsed.scopeExternalId !== expected.scopeExternalId
    ) {
      throw new Error("cursor scope mismatch");
    }
    return parsed.upstreamCursor;
  } catch {
    throw new IntegrationFailure({
      code: "ISSUE_CURSOR_INVALID",
      message: "Issue cursor is invalid for this Project source",
    });
  }
}
