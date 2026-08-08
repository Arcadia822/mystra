import {
  agentSchema,
  accountViewSchema,
  integrationCapabilitiesSchema,
  integrationConnectionSchema,
  hostRuntimeMetadataSchema,
  providerCapabilitySchema,
  projectSchema,
  projectIssueSourceSchema,
  runtimeViewSchema,
  taskRecordSchema,
  teamRoleSchema,
  teamStatusSchema,
  membershipStatusSchema,
  type IntegrationConnection,
  type Agent,
  type Project,
  type ProjectIssueSource,
  type ProviderCapability,
  type RuntimeView,
  type TaskRecord,
} from "@mystra/shared";

import type {
  Agent as PrismaAgent,
  AuthAccount as PrismaAuthAccount,
  AuthSession as PrismaAuthSession,
  IntegrationConnection as PrismaIntegrationConnection,
  Project as PrismaProject,
  ProjectIssueSource as PrismaProjectIssueSource,
  Runtime as PrismaRuntime,
  RuntimeProvider as PrismaRuntimeProvider,
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

export function mapProjectIssueSource(row: PrismaProjectIssueSource): ProjectIssueSource {
  return projectIssueSourceSchema.parse(row);
}

export function mapTask(row: PrismaTask): TaskRecord {
  return taskRecordSchema.parse({
    id: row.id,
    teamId: row.teamId,
    title: row.title,
    description: row.description,
    projectId: row.projectId,
    issue: row.issueProvider === null ? null : {
      provider: row.issueProvider,
      connectionId: row.issueConnectionId,
      scopeExternalId: row.issueScopeExternalId,
      externalId: row.issueExternalId,
      identifier: row.issueIdentifier,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapAgent(row: PrismaAgent): Agent {
  return agentSchema.parse({
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    systemPrompt: row.systemPrompt,
    revision: row.revision,
    status: row.status,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapRuntime(
  row: PrismaRuntime,
  providers: PrismaRuntimeProvider[],
): RuntimeView {
  return runtimeViewSchema.parse({
    id: row.id,
    name: row.name,
    type: row.type,
    metadata: mapHostRuntimeMetadata(row.metadata),
    // Liveness is intentionally outside relational persistence; API composition
    // replaces these defaults from HostLivenessRegistry on read.
    status: "offline",
    lastSeenAt: null,
    providers: providers.map(mapProviderCapability),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapHostRuntimeMetadata(value: string | null) {
  if (value === null) {
    throw new RdbError("RDB_UNAVAILABLE", "Persisted runtime metadata is invalid");
  }
  return hostRuntimeMetadataSchema.parse(parseJsonObject(value));
}

export function mapProviderCapability(row: PrismaRuntimeProvider): ProviderCapability {
  return providerCapabilitySchema.parse({
    provider: row.provider,
    discovered: row.discovered,
    available: row.available,
    source: row.source,
    resolvedPath: row.resolvedPath,
    version: row.version,
    unavailableReason: row.unavailableReason,
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
