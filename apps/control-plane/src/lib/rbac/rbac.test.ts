import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { Permission, TeamRole } from "@mystra/shared";

import type { AuthenticatedSession } from "../auth/service";
import type { RdbProvider, TeamMembershipRecord, TeamRecord, UserRecord } from "../db/rdb-provider";
import {
  AuthorizationError,
  assertCanManageMember,
  authorizeTeamResource,
  changeMemberRole,
  removeMember,
  requirePermission,
  resolveActiveTeam,
} from "./index";
import { hasPermission } from "./permissions";

const team: TeamRecord = {
  id: randomUUID(),
  displayName: "Personal",
  status: "active",
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

async function expectRejectedCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

function expectThrownCode(action: () => void, code: string): void {
  try {
    action();
    throw new Error("Expected action to throw");
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

function subject(): AuthenticatedSession {
  const user: UserRecord = {
    id: randomUUID(),
    username: "operator",
    displayUsername: "Operator",
    displayName: "Operator",
    status: "active",
    requirePasswordChange: false,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
  };
  return {
    user,
    session: {
      id: randomUUID(),
      userId: user.id,
      tokenHash: "digest",
      activeTeamId: team.id,
      expiresAt: "2026-09-07T00:00:00.000Z",
      createdAt: "2026-08-07T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
    },
    source: "bearer",
  };
}

const matrix: Record<TeamRole, Record<Permission, boolean>> = {
  owner: {
    "team.settings.manage": true,
    "team.member.manage": true,
    "team.role.manage": true,
    "team.delete": true,
    "team.integration.manage": true,
    "team.skill.manage": true,
    "team.resource.access": true,
  },
  admin: {
    "team.settings.manage": false,
    "team.member.manage": true,
    "team.role.manage": false,
    "team.delete": false,
    "team.integration.manage": true,
    "team.skill.manage": true,
    "team.resource.access": true,
  },
  member: {
    "team.settings.manage": false,
    "team.member.manage": false,
    "team.role.manage": false,
    "team.delete": false,
    "team.integration.manage": false,
    "team.skill.manage": false,
    "team.resource.access": true,
  },
};

describe("permission catalog", () => {
  it.each(Object.entries(matrix) as Array<[TeamRole, Record<Permission, boolean>]>)(
    "applies the complete contract matrix for %s",
    (role, expected) => {
      for (const [permission, allowed] of Object.entries(expected) as Array<[Permission, boolean]>) {
        expect(hasPermission(role, permission)).toBe(allowed);
      }
    },
  );
});

describe("active Team authorization", () => {
  it("fails closed when the membership is disabled or the Team is archived", async () => {
    const db = {
      resolveActiveTeam: async () => undefined,
    } satisfies Pick<RdbProvider, "resolveActiveTeam">;

    await expect(resolveActiveTeam(db, subject())).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("uses the provider fallback and rejects a requested cross-Team context without revealing it", async () => {
    const db = {
      resolveActiveTeam: async () => ({ team, role: "member" as const }),
    } satisfies Pick<RdbProvider, "resolveActiveTeam">;
    const active = await resolveActiveTeam(db, subject());

    expect(active.team.id).toBe(team.id);
    expectThrownCode(
      () => requirePermission(active, "team.resource.access", randomUUID()),
      "forbidden",
    );
    expectThrownCode(() => requirePermission(active, "team.settings.manage"), "forbidden");
  });

  it("loads resources only through the active Team filter and hides missing or cross-Team resources", async () => {
    const db = {
      resolveActiveTeam: async () => ({ team, role: "member" as const }),
    } satisfies Pick<RdbProvider, "resolveActiveTeam">;
    const caller = subject();
    let scopedTeamId: string | undefined;

    await expectRejectedCode(authorizeTeamResource(db, caller, "team.resource.access", async (teamId) => {
      scopedTeamId = teamId;
      return undefined;
    }), "forbidden");
    expect(scopedTeamId).toBe(team.id);
  });
});

describe("member lifecycle guard", () => {
  const target: TeamMembershipRecord = {
    id: randomUUID(),
    teamId: team.id,
    userId: randomUUID(),
    role: "owner",
    status: "active",
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-07T00:00:00.000Z",
  };

  it("does not allow Admins to operate on Owners", () => {
    expectThrownCode(() => assertCanManageMember({ team, role: "admin" }, target), "forbidden");
  });

  it("delegates role changes to provider lifecycle checks after Owner authorization", async () => {
    let called: { teamId: string; userId: string; role: TeamRole } | undefined;
    const db = {
      resolveActiveTeam: async () => ({ team, role: "owner" as const }),
      listMembers: async () => [{
        userId: target.userId,
        username: "target",
        displayName: "Target",
        role: target.role,
        status: target.status,
        allowedActions: [],
      }],
      setMemberRole: async (teamId: string, userId: string, role: TeamRole) => {
        called = { teamId, userId, role };
        return { ...target, role };
      },
    } satisfies Pick<RdbProvider, "resolveActiveTeam" | "listMembers" | "setMemberRole">;

    await changeMemberRole(db, subject(), target.userId, "admin");
    expect(called).toEqual({ teamId: team.id, userId: target.userId, role: "admin" });
  });

  it("delegates last-owner and last-active-Team enforcement to the provider after authorization", async () => {
    let called: { teamId: string; userId: string } | undefined;
    const db = {
      resolveActiveTeam: async () => ({ team, role: "owner" as const }),
      listMembers: async () => [{
        userId: target.userId,
        username: "target",
        displayName: "Target",
        role: "member" as const,
        status: "active" as const,
        allowedActions: [],
      }],
      removeMember: async (teamId: string, userId: string) => {
        called = { teamId, userId };
        return true;
      },
    } satisfies Pick<RdbProvider, "resolveActiveTeam" | "listMembers" | "removeMember">;

    await removeMember(db, subject(), target.userId);
    expect(called).toEqual({ teamId: team.id, userId: target.userId });
  });
});
