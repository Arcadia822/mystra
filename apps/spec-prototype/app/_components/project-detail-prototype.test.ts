import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./project-detail-prototype.tsx", import.meta.url), "utf8");

describe("Project detail header prototype", () => {
  it("uses shared title inset and Appearance segmented anatomy without a page-local Project header", () => {
    expect(source).toContain('<UiSurfaceTitle as="span">Mystra</UiSurfaceTitle>');
    expect(source).toContain('<UiSegmented aria-label="Project sections"');
    expect(source).toContain('role="tablist"');
    expect(source).toContain("<PrototypeShell");
    expect(source).not.toContain("UiNavTabs");
    expect(source).not.toContain("projectContext");
    expect(source).not.toContain("projectObjectTabs");
  });
});
