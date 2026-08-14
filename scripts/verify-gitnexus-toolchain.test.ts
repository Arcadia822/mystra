import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function markdownFilesUnder(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("GitNexus toolchain contract", () => {
  it("pins one repository-local GitNexus version and permits its native builds", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
      pnpm?: { onlyBuiltDependencies?: string[] };
      scripts?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.gitnexus).toBe("1.6.9");
    expect(packageJson.pnpm?.onlyBuiltDependencies).toEqual(
      expect.arrayContaining(["@ladybugdb/core", "gitnexus", "tree-sitter"]),
    );
    expect(packageJson.scripts?.["gitnexus:status"]).toBe("gitnexus status");
    expect(packageJson.scripts?.["gitnexus:doctor"]).toBe("gitnexus doctor");
    expect(packageJson.scripts?.["gitnexus:analyze"]).toBe(
      "gitnexus analyze --index-only --name mystra",
    );
    expect(packageJson.scripts?.["gitnexus:rebuild"]).toBe(
      "gitnexus analyze --force --index-only --name mystra",
    );
  });

  it("routes maintained guidance through the pinned repository scripts", () => {
    const guidanceFiles = [
      join(repoRoot, "AGENTS.md"),
      join(repoRoot, "PLATFORM.md"),
      join(repoRoot, "PROCESS.md"),
      ...markdownFilesUnder(join(repoRoot, ".agents", "skills")),
      ...markdownFilesUnder(join(repoRoot, "docs")),
      join(repoRoot, "scripts", "README.md"),
    ];
    const bannedInvocation = /(?:npx gitnexus|pnpm dlx gitnexus|node \.gitnexus\/run\.cjs)/;
    const violations = guidanceFiles.flatMap((file) => {
      const lines = readFileSync(file, "utf8").split("\n");
      return lines.flatMap((line, index) =>
        bannedInvocation.test(line)
          ? [`${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`]
          : [],
      );
    });

    expect(violations).toEqual([]);
  });

  it("documents version selection and the known LadybugDB split-brain failure", () => {
    const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");
    const cliSkill = readFileSync(
      join(repoRoot, ".agents", "skills", "gitnexus-cli", "SKILL.md"),
      "utf8",
    );

    for (const guidance of [agents, cliSkill]) {
      expect(guidance).toContain("npm view gitnexus dist-tags --json");
      expect(guidance).toContain("Database file version");
      expect(guidance).toContain("Current build storage version");
      expect(guidance).toContain("release candidate");
      expect(guidance).toContain("restart the MCP client");
    }
  });
});
