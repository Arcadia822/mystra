import type { MemberView, Permission, TeamRole } from "@mystra/shared";

import type { AuthenticatedSession } from "../auth/service";
import type {
  RdbProvider,
  ResolvedActiveTeam,
  TeamMembershipRecord,
} from "../db/rdb-provider";
import { hasPermission } from "./permissions";

export class AuthorizationError extends Error {
  readonly code = "forbidden";

  constructor() {
    super("forbidden");
    this.name = "AuthorizationError";
  }
}

export async function resolveActiveTeam(
  db: Pick<RdbProvider, "resolveActiveTeam">,
  subject: Pick<AuthenticatedSession, "session">,
): Promise<ResolvedActiveTeam> {
  const context = await db.resolveActiveTeam(subject.session.id);
  if (!context) throw new AuthorizationError();
  return context;
}

export function requirePermission(
  context: ResolvedActiveTeam,
  permission: Permission,
  requestedTeamId?: string,
): ResolvedActiveTeam {
  if (
    (requestedTeamId && requestedTeamId !== context.team.id)
    || !hasPermission(context.role, permission)
  ) {
    throw new AuthorizationError();
  }
  return context;
}

export async function authorizeTeamResource<T>(
  db: Pick<RdbProvider, "resolveActiveTeam">,
  subject: Pick<AuthenticatedSession, "session">,
  permission: Permission,
  load: (teamId: string) => Promise<T | undefined>,
): Promise<T> {
  const context = requirePermission(await resolveActiveTeam(db, subject), permission);
  const resource = await load(context.team.id);
  if (!resource) throw new AuthorizationError();
  return resource;
}

export function assertCanManageMember(
  context: ResolvedActiveTeam,
  target: Pick<TeamMembershipRecord | MemberView, "role">,
): void {
  requirePermission(context, "team.member.manage");
  if (context.role === "admin" && target.role === "owner") {
    throw new AuthorizationError();
  }
}

export async function changeMemberRole(
  db: Pick<RdbProvider, "listMembers" | "resolveActiveTeam" | "setMemberRole">,
  subject: Pick<AuthenticatedSession, "session">,
  userId: string,
  role: TeamRole,
): Promise<TeamMembershipRecord> {
  const context = requirePermission(
    await resolveActiveTeam(db, subject),
    "team.role.manage",
  );
  const target = (await db.listMembers(context.team.id)).find((member) => member.userId === userId);
  if (!target) throw new AuthorizationError();
  const updated = await db.setMemberRole(context.team.id, userId, role);
  if (!updated) throw new AuthorizationError();
  return updated;
}

export async function removeMember(
  db: Pick<RdbProvider, "listMembers" | "removeMember" | "resolveActiveTeam">,
  subject: Pick<AuthenticatedSession, "session">,
  userId: string,
): Promise<void> {
  const context = requirePermission(
    await resolveActiveTeam(db, subject),
    "team.member.manage",
  );
  const target = (await db.listMembers(context.team.id)).find((member) => member.userId === userId);
  if (!target) throw new AuthorizationError();
  assertCanManageMember(context, target);
  if (!await db.removeMember(context.team.id, userId)) throw new AuthorizationError();
}

export async function archiveTeam(
  db: Pick<RdbProvider, "archiveTeam" | "resolveActiveTeam">,
  subject: Pick<AuthenticatedSession, "session">,
): Promise<void> {
  const context = requirePermission(
    await resolveActiveTeam(db, subject),
    "team.delete",
  );
  if (!await db.archiveTeam(context.team.id)) throw new AuthorizationError();
}

export { hasPermission, rolePermissions } from "./permissions";
