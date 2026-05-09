import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("runner image skills", () => {
  it("defines agent-skills as a whole-lifecycle development skill", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const skill = readFileSync(
      resolve(currentDir, "../skills/agent-skills/SKILL.md"),
      "utf8",
    );

    expect(skill).toContain("name: agent-skills");
    expect(skill).toContain("entire software development lifecycle");
    expect(skill).toContain("entire research and development workflow");
    expect(skill).toContain("/mystra/skills");
  });

  it("bundles the whole lifecycle skill group, including auxiliary files", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const root = resolve(currentDir, "../skills");

    for (const skill of [
      "using-agent-skills",
      "spec-driven-development",
      "planning-and-task-breakdown",
      "incremental-implementation",
      "test-driven-development",
      "code-review-and-quality",
      "shipping-and-launch",
    ]) {
      expect(existsSync(resolve(root, skill, "SKILL.md"))).toBe(true);
    }

    expect(existsSync(resolve(root, "idea-refine", "examples.md"))).toBe(true);
    expect(existsSync(resolve(root, "idea-refine", "frameworks.md"))).toBe(true);
    expect(existsSync(resolve(root, "agent-skills", "skills"))).toBe(false);
  });
});
