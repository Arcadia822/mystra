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
      "Runtime",
      "RuntimeProvider",
      "SecretEnvelope",
      "User",
      "AuthAccount",
      "AuthSession",
      "Team",
      "TeamMembership",
    ]);
    expect(schema.match(/@@map\("[^"]+"\)/gu)).toEqual([
      '@@map("integration_connections")',
      '@@map("projects")',
      '@@map("project_issue_sources")',
      '@@map("tasks")',
      '@@map("runtimes")',
      '@@map("runtime_providers")',
      '@@map("secret_envelopes")',
      '@@map("users")',
      '@@map("auth_accounts")',
      '@@map("auth_sessions")',
      '@@map("teams")',
      '@@map("team_memberships")',
    ]);
    expect(schema).not.toMatch(/Runner|ContextBundle|Artifact|Snapshot|objective/u);
  });
});
