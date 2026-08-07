import {
  accountViewSchema,
  integrationCapabilitiesSchema,
  integrationConnectionSchema,
  projectSchema,
  taskRecordSchema,
  teamRoleSchema,
  teamStatusSchema,
  membershipStatusSchema,
  type IntegrationConnection,
  type Project,
  type TaskRecord,
} from "@mystra/shared";

import type {
  AuthAccount as PrismaAuthAccount,
  AuthSession as PrismaAuthSession,
  IntegrationConnection as PrismaIntegrationConnection,
  Project as PrismaProject,
  Task as PrismaTask,
  Team as PrismaTeam,
  TeamMembership as PrismaTeamMembership,
  User as PrismaUser,
} from "../../generated/prisma/sqlite/client";
import { RdbError } from "./prisma-errors";
import type {
  AuthAccountRecord,
  AuthSessionRecord,
  IntegrationConnectionRecord,
  TeamMembershipRecord,
  TeamRecord,
  UserRecord,
} from "./rdb-provider";

function parseJsonObject(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new RdbError("RDB_UNAVAILABLE", "Persisted JSON value is invalid");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RdbError("RDB_UNAVAILABLE", "Persisted JSON value is invalid");
  }
  return parsed as Record<string, unknown>;
}

export function serializeJson(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

export function mapIntegrationConnectionRecord(
  row: PrismaIntegrationConnection,
): IntegrationConnectionRecord {
  const connection = integrationConnectionSchema.parse({
    id: row.id,
    teamId: row.teamId,
    integration: row.integration,
    provider: row.provider,
    authMethod: row.authMethod,
    providerExternalId: row.providerExternalId,
    displayName: row.displayName,
    providerSubject: parseJsonObject(row.providerSubject),
    connectionConfig: parseJsonObject(row.connectionConfig),
    capabilities: integrationCapabilitiesSchema.parse(parseJsonObject(row.capabilities)),
    credentialState: row.credentialState,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
  return row.credentialRef ? { ...connection, credentialRef: row.credentialRef } : connection;
}

export function mapPublicIntegrationConnection(
  row: PrismaIntegrationConnection,
): IntegrationConnection {
  const { credentialRef: _credentialRef, ...connection } = mapIntegrationConnectionRecord(row);
  return integrationConnectionSchema.parse(connection);
}

export function mapProject(row: PrismaProject): Project {
  return projectSchema.parse({
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    slug: row.slug,
    repositoryConnectionId: row.repositoryConnectionId,
    repositoryExternalId: row.repositoryExternalId,
    repositoryBaseBranch: row.repositoryBaseBranch,
    metadata: parseJsonObject(row.metadata),
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapTask(row: PrismaTask): TaskRecord {
  return taskRecordSchema.parse({
    id: row.id,
    teamId: row.teamId,
    projectId: row.projectId,
    ...(row.issueDispatchKey ? { issueDispatchKey: row.issueDispatchKey } : {}),
    metadata: parseJsonObject(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapUser(row: PrismaUser): UserRecord {
  return {
    ...accountViewSchema.parse({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      status: row.status,
      requirePasswordChange: row.requirePasswordChange,
    }),
    displayUsername: row.displayUsername,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapAuthAccount(row: PrismaAuthAccount): AuthAccountRecord {
  return {
    id: row.id,
    userId: row.userId,
    passwordHash: row.passwordHash,
    passwordSalt: row.passwordSalt,
    passwordParams: row.passwordParams,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapAuthSession(row: PrismaAuthSession): AuthSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    ...(row.activeTeamId ? { activeTeamId: row.activeTeamId } : {}),
    expiresAt: row.expiresAt,
    ...(row.ipAddress ? { ipAddress: row.ipAddress } : {}),
    ...(row.userAgent ? { userAgent: row.userAgent } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTeam(row: PrismaTeam): TeamRecord {
  return {
    id: row.id,
    displayName: row.displayName,
    status: teamStatusSchema.parse(row.status),
    ...(row.archivedAt ? { archivedAt: row.archivedAt } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTeamMembership(row: PrismaTeamMembership): TeamMembershipRecord {
  return {
    id: row.id,
    teamId: row.teamId,
    userId: row.userId,
    role: teamRoleSchema.parse(row.role),
    status: membershipStatusSchema.parse(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
