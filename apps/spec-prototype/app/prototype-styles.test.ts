import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./prototype.css", import.meta.url), "utf8");
const workbenchSource = readFileSync(new URL("./_components/navigation-task-workbench.tsx", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS rule: ${selector}`);
  return match[1];
}

describe("054 Kanban card density", () => {
  it("uses the standard 8px card inset", () => {
    expect(rule(".boardCard")).toContain("padding: var(--space-2);");
  });

  it("hugs rendered content instead of reserving a fixed card height", () => {
    expect(rule(".boardCard")).not.toMatch(/min-height\s*:/);
    expect(rule(".boardCard")).toContain("display: grid;");
    expect(rule(".boardCard")).toContain("gap: var(--space-2);");
  });

  it("does not shrink Label key text below the shared Label size", () => {
    expect(rule(".taskLabelKey")).toContain("font-size: inherit;");
  });
});

describe("054 New Task modal density", () => {
  it("uses shared Section chrome and owns only the business vertical body inset", () => {
    const composerRule = rule(".taskComposer");
    expect(composerRule).not.toMatch(/padding\s*:/);
    expect(rule(".taskComposerBody")).toContain("padding-block: var(--space-2);");
    expect(workbenchSource).toContain("<UiSurfaceTitle>Create Task</UiSurfaceTitle>");
    expect(workbenchSource).not.toContain('layout="rows"');
  });

  it("uses the shared inline size for Project and Create", () => {
    expect(rule(".taskComposerFooter")).toContain("justify-content: space-between;");
    expect(workbenchSource).toMatch(/<UiDropdown[\s\S]*?size="inline"[\s\S]*?variant="ghost"/);
    expect(workbenchSource).toMatch(/<UiButton[^>]*size="inline"[^>]*tone="solid">Create<\/UiButton>/);
  });
});

describe("054 Table field typography", () => {
  it("does not override standard Task ID or datetime field text", () => {
    expect(styles).not.toContain(".rowTaskId");
    expect(styles).not.toContain(".rowDate");
  });
});
