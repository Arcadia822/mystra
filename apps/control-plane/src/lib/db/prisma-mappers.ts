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
  taskWorkspaceTrustedSchema,
  teamRoleSchema,
  teamStatusSchema,
  membershipStatusSchema,
  sessionSchema,
  sessionEventSchema,
  type IntegrationConnection,
  type Agent,
  type Project,
  type ProjectIssueSource,
  type ProviderCapability,
  type RuntimeView,
  type TaskRecord,
  type TaskWorkspaceTrusted,
  type WorkspacePreparationAttempt,
  type Session,
  type SessionEvent,
  workspacePreparationAttemptSchema,
  taskExecutionContextSchema,
  taskStatusTransitionSchema,
  type TaskExecutionContext,
  type TaskStatusTransition,
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
  TaskWorkspace as PrismaTaskWorkspace,
  Team as PrismaTeam,
  TeamMembership as PrismaTeamMembership,
  User as PrismaUser,
  WorkspacePreparationAttempt as PrismaWorkspacePreparationAttempt,
  Session as PrismaSession,
  SessionEvent as PrismaSessionEvent,
  TaskExecutionContext as PrismaTaskExecutionContext,
  TaskStatusTransition as PrismaTaskStatusTransition,
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
    status: row.status,
    metadata: parseJsonObject(row.metadata),
    runtimeId: row.runtimeId,
    statusRevision: row.statusRevision,
    statusNote: row.statusNote,
    statusUpdatedAt: row.statusUpdatedAt,
    statusActor: parseJsonObject(row.statusActor),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapTaskExecutionContext(row: PrismaTaskExecutionContext): TaskExecutionContext {
  return taskExecutionContextSchema.parse({
    ...row,
    taskIssue: row.taskIssue === null ? null : parseJsonObject(row.taskIssue),
  });
}

export function mapTaskStatusTransition(row: PrismaTaskStatusTransition): TaskStatusTransition {
  return taskStatusTransitionSchema.parse({
    ...row,
    actor: parseJsonObject(row.actor),
  });
}

export function mapSession(row: PrismaSession): Session {
  return sessionSchema.parse({
    id: row.id,
    teamId: row.teamId,
    taskId: row.taskId,
    projectId: row.projectId,
    runtimeId: row.runtimeId,
    providerKey: row.providerKey,
    agentId: row.agentId,
    agentRevision: row.agentRevision,
    state: row.state,
    activeMessageId: row.activeMessageId,
    lastMessageId: row.lastMessageId,
    interruptKind: row.interruptKind,
    continuationMode: row.continuationMode,
    failureCode: row.failureCode,
    metadata: parseJsonObject(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function mapSessionEvent(row: PrismaSessionEvent): SessionEvent {
  return sessionEventSchema.parse({
    eventId: row.eventId,
    sessionId: row.sessionId,
    sourceId: row.sourceId,
    sourceSequence: row.sourceSequence,
    globalSequence: row.globalSequence,
    kind: row.kind,
    version: row.version,
    messageId: row.messageId ?? undefined,
    payload: parseJsonObject(row.payload),
    metadata: parseJsonObject(row.metadata),
    occurredAt: row.occurredAt,
    acceptedAt: row.acceptedAt,
  });
}

export function mapTaskWorkspace(row: PrismaTaskWorkspace): TaskWorkspaceTrusted {
  return taskWorkspaceTrustedSchema.parse(row);
}

export function mapWorkspacePreparationAttempt(
  row: PrismaWorkspacePreparationAttempt,
): WorkspacePreparationAttempt {
  return workspacePreparationAttemptSchema.parse(row);
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
