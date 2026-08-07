import { NextResponse } from "next/server";

import {
  AuthError,
  assertPasswordChangeAllowed,
  authenticateRequest,
  type AuthenticatedSession,
} from "@/lib/auth";
import type { RdbProvider } from "@/lib/db/rdb-provider";
import {
  AuthorizationError,
  requirePermission,
  resolveActiveTeam,
} from "@/lib/rbac";
import type { Permission } from "@mystra/shared";

export function authorizationErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    const status = error.code === "unauthenticated" ? 401 : 403;
    return NextResponse.json(
      { error: { code: error.code, message: error.code } },
      { status },
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "forbidden" } },
      { status: 403 },
    );
  }
  throw error;
}

export async function requireHumanSession(
  db: RdbProvider,
  request: Request,
  operation: string,
): Promise<AuthenticatedSession> {
  const subject = await authenticateRequest(db, request);
  assertPasswordChangeAllowed(subject.user, operation);
  return subject;
}

export async function requireTeamPermission(
  db: RdbProvider,
  subject: AuthenticatedSession,
  permission: Permission,
  requestedTeamId?: string,
) {
  return requirePermission(
    await resolveActiveTeam(db, subject),
    permission,
    requestedTeamId,
  );
}

export function teamScopedPatConnectionDb(db: RdbProvider, teamId: string): Pick<
  RdbProvider,
  | "deleteIntegrationConnection"
  | "deleteIntegrationConnectionWithSecret"
  | "getIntegrationConnection"
  | "getIntegrationConnectionRecord"
  | "listIntegrationConnectionRecords"
  | "listProjectsForIntegrationConnection"
  | "replaceIntegrationConnectionWithSecret"
  | "upsertIntegrationConnectionWithSecret"
> {
  return {
    deleteIntegrationConnection: (id) => db.deleteIntegrationConnection(id),
    deleteIntegrationConnectionWithSecret: (id, reference) => (
      db.deleteIntegrationConnectionWithSecret(id, reference)
    ),
    getIntegrationConnection: async (id) => {
      const connection = await db.getIntegrationConnection(id);
      return connection?.teamId === teamId ? connection : undefined;
    },
    getIntegrationConnectionRecord: async (id) => {
      const connection = await db.getIntegrationConnectionRecord(id);
      return connection?.teamId === teamId ? connection : undefined;
    },
    listIntegrationConnectionRecords: (options = {}) => (
      db.listIntegrationConnectionRecords({ ...options, teamId })
    ),
    listProjectsForIntegrationConnection: (id) => (
      db.listProjectsForIntegrationConnection(id, { teamId })
    ),
    replaceIntegrationConnectionWithSecret: (id, input, envelope, previousReference) => (
      db.replaceIntegrationConnectionWithSecret(
        id,
        { ...input, teamId },
        envelope,
        previousReference,
      )
    ),
    upsertIntegrationConnectionWithSecret: (input, envelope, previousReference) => (
      db.upsertIntegrationConnectionWithSecret({ ...input, teamId }, envelope, previousReference)
    ),
  };
}
