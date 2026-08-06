import {
  integrationCapabilitiesSchema,
  integrationConnectionSchema,
  projectSchema,
  taskRecordSchema,
  type IntegrationConnection,
  type Project,
  type TaskRecord,
} from "@mystra/shared";

import type {
  IntegrationConnection as PrismaIntegrationConnection,
  Project as PrismaProject,
  Task as PrismaTask,
} from "../../generated/prisma/sqlite/client";
import type { IntegrationConnectionRecord } from "./rdb-provider";

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Persisted JSON value is not an object");
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
    projectId: row.projectId,
    ...(row.issueDispatchKey ? { issueDispatchKey: row.issueDispatchKey } : {}),
    metadata: parseJsonObject(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
