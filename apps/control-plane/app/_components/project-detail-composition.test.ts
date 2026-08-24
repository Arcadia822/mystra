import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Project detail shared header controls", () => {
  it("uses the standard surface title inset and Appearance segmented control", () => {
    const project = source("./project-detail.tsx");
    const issues = source("./project-issues-browser.tsx");
    const shell = source("./app-shell.tsx");

    expect(shell).toContain('<UiSurfaceTitle as="span">{shellTitle}</UiSurfaceTitle>');
    expect(project).toContain('<UiSurfaceTitle as="span">{project.name}</UiSurfaceTitle>');
    expect(project).toContain('<UiSegmented aria-label="Project sections"');
    expect(project).toContain('role="tablist"');
    expect(issues).toContain('<UiSegmented aria-label="Issue provider"');
    expect(issues).toContain('role="tablist"');
    expect(project).not.toContain("UiNavTabs");
    expect(issues).not.toContain("issueProviderTabs");
  });
});
