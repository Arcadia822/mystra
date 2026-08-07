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

  it("contains three owner-approved business models plus the internal encrypted envelope", () => {
    const schema = modelSection(readSchema("sqlite"));
    const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gmu)].map((match) => match[1]);

    expect(models).toEqual(["IntegrationConnection", "Project", "Task", "SecretEnvelope"]);
    expect(schema.match(/@@map\("[^"]+"\)/gu)).toEqual([
      '@@map("integration_connections")',
      '@@map("projects")',
      '@@map("tasks")',
      '@@map("secret_envelopes")',
    ]);
    expect(schema).not.toMatch(/Session|Runner|ContextBundle|Artifact|Snapshot|source|objective/u);
  });
});
