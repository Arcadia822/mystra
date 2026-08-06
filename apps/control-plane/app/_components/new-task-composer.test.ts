import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readAppFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("New Task composer UX contract", () => {
  const composer = readAppFile("./new-task-composer.tsx");
  const css = readAppFile("../globals.css");

  it("renders the enlarged standalone logo without adjacent brand copy", () => {
    expect(composer).toMatch(/<MystraLogo[^>]*title="Mystra"/);
    expect(composer).not.toMatch(/<strong>Mystra<\/strong>/);
    expect(css).toMatch(/\.newTaskLogoMark\s*\{[^}]*width:\s*var\(--space-12\);[^}]*height:\s*var\(--space-12\);/s);
  });

  it("uses the shared dropdown with Project terminology", () => {
    expect(composer).toMatch(/<UiDropdown/);
    expect(composer).toMatch(/aria-label="Project"/);
    expect(composer).toMatch(/placeholder="Project"/);
    expect(composer).not.toMatch(/aria-label="Repository"/);
    expect(composer).not.toMatch(/<UiSelect/);
  });

  it("removes the obsolete configuration helper and Issue select", () => {
    expect(composer).not.toContain("Configure a Project before creating a Task.");
    expect(composer).not.toMatch(/aria-label="Issue"[^>]*<UiSelect/);
  });

  it("loads repository-scoped Issues after Project selection and renders selectable cards", () => {
    expect(composer).toContain("/issues?repository=");
    expect(composer).toMatch(/className="newTaskIssueList"/);
    expect(composer).toMatch(/className="newTaskIssueCard"/);
    expect(composer).toMatch(/aria-pressed=\{selectedIssue/);
  });

  it("balances the composer's effective right and bottom inset around its controls", () => {
    expect(css).toMatch(/\.newTaskComposer textarea\s*\{[^}]*padding-right:\s*var\(--space-half\);/s);
    expect(css).toMatch(/\.newTaskComposerFooter\s*\{[^}]*padding:\s*var\(--space-0\) var\(--space-half\) var\(--space-half\) var\(--space-0\);/s);
  });
});
