import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const COMPONENT_FILES = [
  "./_components/app-shell.tsx",
  "./_components/new-task-composer.tsx",
  "./_components/shell-search-dialog.tsx",
  "./_components/inbox-master-detail.tsx",
  "./_components/task-table.tsx",
  "./_components/shell-settings.tsx",
  "./_components/shell-settings-panels.tsx",
] as const;

function readAppFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Castrel v2 component migration contract", () => {
  it("routes every current 025 surface through Mystra-owned UI primitives", () => {
    for (const path of COMPONENT_FILES) {
      const source = readAppFile(path);

      expect(source, `${path} must consume a shared ui primitive`).toMatch(/from "\.\/ui-(?:actions|fields|surfaces)"/);
      expect(source, `${path} must not reintroduce a page-local button`).not.toMatch(/<button\b/);
      expect(source, `${path} must not reintroduce a page-local anchor`).not.toMatch(/<a\b/);
      expect(source, `${path} must not reintroduce a page-local select`).not.toMatch(/<select\b/);
      expect(source, `${path} must not reintroduce a page-local textarea`).not.toMatch(/<textarea\b/);
    }
  });

  it("keeps visible spacing, radii, and colors outside the fallback token map token-driven", () => {
    const css = readAppFile("./globals.css");
    const runtimeRules = css.slice(css.indexOf("}\n") + 2);

    expect(runtimeRules).not.toMatch(/(?:padding|gap|border-radius)\s*:[^;]*\d+(?:\.\d+)?px/);
    expect(runtimeRules).not.toMatch(/(?:background|color|border-color)\s*:\s*(?:#[\da-f]{3,8}|rgba?\()/i);
  });

  it("does not add a border, outline, or focus halo to input controls", () => {
    const css = readAppFile("./globals.css");

    expect(css).toMatch(/\.uiFieldControl:focus,[\s\S]*?\.uiTextarea:focus\s*\{[\s\S]*?box-shadow:\s*none;[\s\S]*?outline:\s*none;[\s\S]*?\}/);
    expect(css).toMatch(/input:focus-visible,[\s\S]*?select:focus-visible,[\s\S]*?textarea:focus-visible\s*\{[\s\S]*?outline:\s*none;[\s\S]*?\}/);
    expect(css).not.toMatch(/\.(?:settingsSearch|newTaskComposer|inboxSearch):focus-within\s*\{[^}]*border-color:\s*var\(--accent\)/);
  });

  it("keeps Settings organized around the approved four-tab information architecture", () => {
    const settings = readAppFile("./_components/shell-settings.tsx");
    const panels = readAppFile("./_components/shell-settings-panels.tsx");

    expect(settings).toMatch(/type SettingsSection = "account" \| "appearance" \| "team" \| "integrations"/);
    expect(settings).not.toMatch(/type SettingsSection = "theme"/);
    expect(panels).toMatch(/<SettingRow[\s\S]*?control=/);
  });
});
