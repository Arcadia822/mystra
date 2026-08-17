import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const dbDirectory = path.dirname(fileURLToPath(import.meta.url));
const controlPlaneDirectory = path.resolve(dbDirectory, "../../..");

function readSchema(provider: "sqlite" | "postgresql"): string {
  return readFileSync(path.join(controlPlaneDirectory, "prisma", provider, "schema.prisma"), "utf8");
}

function modelSection(schema: string): string {
  return schema
    .replace(/generator client \{[\s\S]*?\}\s*/u, "")
    .replace(/datasource db \{[\s\S]*?\}\s*/u, "")
    .trim();
}

describe("Prisma provider schema parity", () => {
  it("keeps the complete logical model byte-identical across providers", () => {
    expect(modelSection(readSchema("sqlite"))).toBe(modelSection(readSchema("postgresql")));
  });

  it("contains Runtime capability, tenant business, identity, and RBAC models", () => {
    const schema = modelSection(readSchema("sqlite"));
    const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gmu)].map((match) => match[1]);

    expect(models).toEqual([
      "IntegrationConnection",
      "Project",
      "ProjectIssueSource",
      "Task",
      "TaskExecutionAttempt",
      "TaskStatusTransition",
      "TaskWorkspace",
      "WorkspacePreparationAttempt",
      "Agent",
      "Runtime",
      "RuntimeProvider",
      "SecretEnvelope",
      "User",
      "AuthAccount",
      "AuthSession",
      "Team",
      "Session",
      "SessionEvent",
      "SessionEventHead",
      "SessionEventStream",
      "SessionDispatchLease",
      "TeamMembership",
    ]);
    expect(schema.match(/@@map\("[^"]+"\)/gu)).toEqual([
      '@@map("integration_connections")',
      '@@map("projects")',
      '@@map("project_issue_sources")',
      '@@map("tasks")',
      '@@map("task_execution_attempts")',
      '@@map("task_status_transitions")',
      '@@map("task_workspaces")',
      '@@map("workspace_preparation_attempts")',
      '@@map("agents")',
      '@@map("runtimes")',
      '@@map("runtime_providers")',
      '@@map("secret_envelopes")',
      '@@map("users")',
      '@@map("auth_accounts")',
      '@@map("auth_sessions")',
      '@@map("teams")',
      '@@map("sessions")',
      '@@map("session_events")',
      '@@map("session_event_heads")',
      '@@map("session_event_streams")',
      '@@map("session_dispatch_leases")',
      '@@map("team_memberships")',
    ]);
    expect(schema).not.toMatch(/Runner|ContextBundle|Artifact|Snapshot|objective|turnId|maxConcurrency/u);
  });

  it("models one durable Session event ledger without Turn or capacity tables", () => {
    const schema = modelSection(readSchema("sqlite"));
    const session = schema.match(/model Session \{[\s\S]*?\n\}/u)?.[0] ?? "";
    const event = schema.match(/model SessionEvent \{[\s\S]*?\n\}/u)?.[0] ?? "";

    expect(session).toMatch(/taskId\s+String/u);
    expect(session).toMatch(/runtimeId\s+String/u);
    expect(session).toMatch(/agentId\s+String\?/u);
    expect(session).toMatch(/agentRevision\s+Int\?/u);
    expect(session).toMatch(/agent\s+Agent\?/u);
    expect(session).not.toMatch(/launchPayload/u);
    expect(schema.match(/model SessionEventHead \{[\s\S]*?\n\}/u)?.[0]).toMatch(/launchPayload\s+String/u);
    expect(event).toMatch(/@@unique\(\[sessionId, sourceId, sourceSequence\]\)/u);
    expect(event).toMatch(/@@unique\(\[sessionId, globalSequence\]\)/u);
    expect(schema).not.toMatch(/model\s+Turn|capacity|slot/u);
  });

  it("models optional Agent snapshots without a default or sentinel relation", () => {
    const schema = modelSection(readSchema("sqlite"));
    const attempt = schema.match(/model TaskExecutionAttempt \{[\s\S]*?\n\}/u)?.[0] ?? "";

    expect(attempt).toMatch(/agentId\s+String\?/u);
    expect(attempt).toMatch(/agentName\s+String\?/u);
    expect(attempt).toMatch(/agentRevision\s+Int\?/u);
    expect(attempt).toMatch(/agentSystemPrompt\s+String\?/u);
    expect(attempt).toMatch(/agent\s+Agent\?/u);
    expect(schema).not.toMatch(/defaultAgent|sentinelAgent/u);
  });

  it("models Task as Team-owned text with optional immutable context references", () => {
    const schema = modelSection(readSchema("sqlite"));
    const task = schema.match(/model Task \{[\s\S]*?\n\}/u)?.[0] ?? "";

    expect(task).toMatch(/teamId\s+String\s+@map\("team_id"\)/u);
    expect(task).toMatch(/title\s+String/u);
    expect(task).toMatch(/description\s+String\?/u);
    expect(task).toMatch(/projectId\s+String\?/u);
    expect(task).toMatch(/idempotencyKey\s+String\?/u);
    expect(task).toMatch(/issueProvider\s+String\?/u);
    expect(task).toMatch(/issueConnectionId\s+String\?/u);
    expect(task).toMatch(/issueScopeExternalId\s+String\?/u);
    expect(task).toMatch(/issueExternalId\s+String\?/u);
    expect(task).toMatch(/issueIdentifier\s+String\?/u);
    expect(task).toMatch(/status\s+String/u);
    expect(task).toMatch(/metadata\s+String/u);
    expect(task).toMatch(/project\s+Project\?/u);
    expect(task).toMatch(/@@unique\(\[teamId, idempotencyKey\]\)/u);
    expect(task).toMatch(/@@unique\(\[issueProvider, issueConnectionId, issueScopeExternalId, issueExternalId\]\)/u);
    expect(task).not.toMatch(/issueDispatchKey|productionStatus|production_status/u);
    expect(schema).not.toMatch(/TaskLabel|normalizedKey|normalizedValue|ordinal/u);
  });

  it("models one Task Workspace per Runtime and monotonically sequenced preparation attempts", () => {
    const schema = modelSection(readSchema("sqlite"));
    const workspace = schema.match(/model TaskWorkspace \{[\s\S]*?\n\}/u)?.[0] ?? "";
    const attempt = schema.match(/model WorkspacePreparationAttempt \{[\s\S]*?\n\}/u)?.[0] ?? "";

    expect(workspace).toMatch(/taskId\s+String/u);
    expect(workspace).toMatch(/runtimeId\s+String/u);
    expect(workspace).toMatch(/@@unique\(\[taskId, runtimeId\]\)/u);
    expect(workspace).toMatch(/workspaceRef\s+String\?/u);
    expect(workspace).toMatch(/activeAttemptSequence\s+Int/u);
    expect(workspace).toMatch(/@@index\(\[runtimeId, state, createdAt\]\)/u);
    expect(workspace).not.toMatch(/workspacePath|cloneUrl|credential/u);

    expect(attempt).toMatch(/workspaceId\s+String/u);
    expect(attempt).toMatch(/sequence\s+Int/u);
    expect(attempt).toMatch(/@@unique\(\[workspaceId, sequence\]\)/u);
    expect(attempt).toMatch(/@@index\(\[state, createdAt\]\)/u);
  });
});
