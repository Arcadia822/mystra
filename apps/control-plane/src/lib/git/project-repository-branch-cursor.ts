import { z } from "zod";

import { GitRemoteRepositoryError } from "./remote-repository-reader";

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  projectId: z.string().uuid(),
  connectionId: z.string().uuid(),
  repositoryExternalId: z.string().min(1).max(1_000),
  query: z.string().max(200),
  lastRef: z.string().startsWith("refs/heads/").max(256),
}).strict();

export type ProjectRepositoryBranchCursorScope = Omit<
  z.infer<typeof cursorPayloadSchema>,
  "version" | "lastRef"
>;

export function encodeProjectRepositoryBranchCursor(
  scope: ProjectRepositoryBranchCursorScope,
  lastRef: string,
): string {
  return Buffer.from(JSON.stringify(cursorPayloadSchema.parse({
    version: 1,
    ...scope,
    lastRef,
  })), "utf8").toString("base64url");
}

export function decodeProjectRepositoryBranchCursor(
  cursor: string,
  expected: ProjectRepositoryBranchCursorScope,
): string {
  try {
    const parsed = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (
      parsed.projectId !== expected.projectId
      || parsed.connectionId !== expected.connectionId
      || parsed.repositoryExternalId !== expected.repositoryExternalId
      || parsed.query !== expected.query
    ) {
      throw new Error("cursor scope mismatch");
    }
    return parsed.lastRef;
  } catch {
    throw new GitRemoteRepositoryError(
      "repository_branches_unavailable",
      "Repository branch cursor is invalid for this Project source",
    );
  }
}
