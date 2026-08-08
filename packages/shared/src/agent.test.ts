import { describe, expect, it } from "vitest";

import {
  AGENT_SYSTEM_PROMPT_MAX_LENGTH,
  agentArchiveRequestSchema,
  agentCreateRequestSchema,
  agentListQuerySchema,
  agentSchema,
  agentUpdateRequestSchema,
  resolvedAgentSnapshotSchema,
  sessionExecutionSelectionSchema,
  sessionOptionalBusinessReferencesSchema,
} from "./agent.js";

const teamId = "00000000-0000-4000-8000-000000000001";
const agentId = "00000000-0000-4000-8000-000000000002";

describe("Agent contracts", () => {
  it("accepts only a name and system prompt for public creation", () => {
    expect(agentCreateRequestSchema.parse({
      name: "Reviewer",
      systemPrompt: " Review the evidence exactly. ",
    })).toEqual({
      name: "Reviewer",
      systemPrompt: " Review the evidence exactly. ",
    });

    for (const extra of [
      { projectId: teamId },
      { provider: "codex" },
      { runtimeId: teamId },
      { contextId: teamId },
      { skills: ["review"] },
      { tools: ["shell"] },
      { model: "gpt" },
      { teamId },
    ]) {
      expect(() => agentCreateRequestSchema.parse({
        name: "Reviewer",
        systemPrompt: "Review evidence.",
        ...extra,
      })).toThrow();
    }
  });

  it("rejects blank and oversized prompts while preserving valid prompt text", () => {
    expect(() => agentCreateRequestSchema.parse({ name: "Reviewer", systemPrompt: " \n\t " })).toThrow();
    expect(() => agentCreateRequestSchema.parse({
      name: "Reviewer",
      systemPrompt: "x".repeat(AGENT_SYSTEM_PROMPT_MAX_LENGTH + 1),
    })).toThrow();
    expect(agentCreateRequestSchema.parse({
      name: " Reviewer ",
      systemPrompt: "\nSystem text\n",
    })).toEqual({ name: "Reviewer", systemPrompt: "\nSystem text\n" });
  });

  it("requires optimistic revision input for update and archive", () => {
    expect(agentUpdateRequestSchema.parse({ expectedRevision: 2, name: "Renamed" })).toEqual({
      expectedRevision: 2,
      name: "Renamed",
    });
    expect(agentUpdateRequestSchema.parse({ expectedRevision: 2, systemPrompt: "New prompt" })).toEqual({
      expectedRevision: 2,
      systemPrompt: "New prompt",
    });
    expect(() => agentUpdateRequestSchema.parse({ expectedRevision: 2 })).toThrow();
    expect(() => agentUpdateRequestSchema.parse({ name: "Renamed" })).toThrow();
    expect(() => agentUpdateRequestSchema.parse({ expectedRevision: "2", name: "Renamed" })).toThrow();
    expect(agentArchiveRequestSchema.parse({ expectedRevision: 3 })).toEqual({ expectedRevision: 3 });
    expect(() => agentArchiveRequestSchema.parse({ expectedRevision: "3" })).toThrow();
  });

  it("parses full records and bounded list queries", () => {
    expect(agentSchema.parse({
      id: agentId,
      teamId,
      name: "Reviewer",
      systemPrompt: "Review evidence.",
      revision: 1,
      status: "active",
      archivedAt: null,
      createdAt: "2026-08-08T00:00:00.000Z",
      updatedAt: "2026-08-08T00:00:00.000Z",
    }).revision).toBe(1);
    expect(agentListQuerySchema.parse({})).toEqual({ limit: 50, includeArchived: false });
    expect(agentListQuerySchema.parse({ limit: "100", includeArchived: "true" })).toEqual({
      limit: 100,
      includeArchived: true,
    });
    expect(() => agentListQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it("keeps Runtime, Provider, Agent and Context independent", () => {
    expect(sessionExecutionSelectionSchema.parse({
      runtimeId: "00000000-0000-4000-8000-000000000003",
      provider: "codex",
      agentId,
      contextId: "00000000-0000-4000-8000-000000000004",
    })).toEqual({
      runtimeId: "00000000-0000-4000-8000-000000000003",
      provider: "codex",
      agentId,
      contextId: "00000000-0000-4000-8000-000000000004",
    });
    expect(sessionOptionalBusinessReferencesSchema.parse({})).toEqual({});
    expect(sessionOptionalBusinessReferencesSchema.parse({ projectId: teamId })).toEqual({ projectId: teamId });
    expect(sessionOptionalBusinessReferencesSchema.parse({ taskId: agentId })).toEqual({ taskId: agentId });
    expect(sessionOptionalBusinessReferencesSchema.parse({ projectId: teamId, taskId: agentId })).toEqual({
      projectId: teamId,
      taskId: agentId,
    });
  });

  it("defines an exact detached resolved snapshot", () => {
    expect(resolvedAgentSnapshotSchema.parse({
      agentId,
      revision: 4,
      systemPrompt: "Review evidence.",
    })).toEqual({ agentId, revision: 4, systemPrompt: "Review evidence." });
    expect(() => resolvedAgentSnapshotSchema.parse({
      agentId,
      revision: 4,
      systemPrompt: "Review evidence.",
      projectId: teamId,
    })).toThrow();
  });
});
