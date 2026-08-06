import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const COMPONENT_FILES = [
  "./_components/app-shell.tsx",
  "./_components/new-task-composer.tsx",
  "./_components/shell-search-dialog.tsx",
  "./_components/inbox-master-detail.tsx",
  "./_components/task-table.tsx",
  "./_components/github-integration-detail.tsx",
  "./_components/project-create-modal.tsx",
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

  it("builds Appearance from shared preference controls and exposes the complete local-only model", () => {
    const panels = readAppFile("./_components/shell-settings-panels.tsx");
    const controls = readAppFile("./_components/ui-preference-controls.tsx");

    expect(controls).toMatch(/export function UiSegmented/);
    expect(controls).toMatch(/aria-pressed=/);
    expect(controls).toMatch(/export function UiRange/);
    expect(controls).toMatch(/type="range"/);
    expect(panels).toMatch(/<UiSegmented[\s\S]*?preferences\.mode/);
    expect(panels).toMatch(/preferences\.lightThemeId/);
    expect(panels).toMatch(/preferences\.darkThemeId/);
    expect(panels).toMatch(/preferences\.borderMode/);
    expect(panels).toMatch(/preferences\.codeSurfaceVariant/);
    expect(panels).toMatch(/<UiRange[\s\S]*?preferences\.contrast/);
    expect(panels).toMatch(/preferences\.uiFont/);
    expect(panels).toMatch(/preferences\.chatFont/);
    expect(panels).toMatch(/preferences\.codeFont/);
    expect(panels).toMatch(/onResetDetails/);
  });

  it("uses shared close glyphs and dropdown controls across modal surfaces", () => {
    const projectModal = readAppFile("./_components/project-create-modal.tsx");
    const searchDialog = readAppFile("./_components/shell-search-dialog.tsx");
    const settings = readAppFile("./_components/shell-settings.tsx");
    const panels = readAppFile("./_components/shell-settings-panels.tsx");
    const dropdown = readAppFile("./_components/ui-dropdown.tsx");
    const css = readAppFile("./globals.css");

    for (const source of [projectModal, searchDialog, settings]) {
      expect(source).toMatch(/<ShellIcon name="close" \/>/);
      expect(source).not.toMatch(/>×<\/UiIconButton>/);
    }
    expect(searchDialog).not.toMatch(/<UiIconButton[^>]*size="compact"/);

    expect(panels).toMatch(/import \{ UiDropdown \} from "\.\/ui-dropdown"/);
    expect(panels).toMatch(/<UiDropdown[\s\S]*?aria-label=\{copy\.language\}/);
    expect(panels).toMatch(/<UiDropdown[\s\S]*?aria-label=\{copy\.lightTheme\}/);
    expect(panels).toMatch(/<UiDropdown[\s\S]*?aria-label=\{copy\.darkTheme\}/);
    expect(panels).not.toMatch(/<UiSelect/);
    expect(panels.match(/align="end"/g)).toHaveLength(3);
    expect(panels.match(/className="appearanceDropdown"/g)).toHaveLength(3);
    expect(dropdown).toMatch(/data-align=\{align\}/);
    expect(css).toMatch(/\.uiDropdown\[data-align="end"\] \.uiDropdownMenu\s*\{[\s\S]*?right:\s*0;/);
  });

  it("keeps Add Project configuration on the shared left-copy/right-control setting anatomy", () => {
    const modal = readAppFile("./_components/project-create-modal.tsx");

    expect(modal).toMatch(/control=\{\(\s*<UiInput[\s\S]*?aria-label=\{zh \? "Project 名称" : "Project name"\}[\s\S]*?fieldSize="default"[\s\S]*?description=\{zh[\s\S]*?title=\{zh \? "名称" : "Name"\}/);
    expect(modal).toMatch(/control=\{\(\s*<UiInput[\s\S]*?aria-label="Project slug"[\s\S]*?fieldSize="default"[\s\S]*?description=\{zh[\s\S]*?title="Slug"/);
    expect(modal).not.toMatch(/<SettingRow[^>]*title=\{zh \? "名称" : "Name"\}[^>]*>\s*<UiInput/);
    expect(modal).not.toMatch(/<SettingRow[^>]*title="Slug"[^>]*>\s*<UiInput/);
  });

  it("renders only connection methods returned by the deployment projection", () => {
    const detail = readAppFile("./_components/github-integration-detail.tsx");

    expect(detail).toMatch(/useState\(false\)/);
    expect(detail).toMatch(/<UiButton[\s\S]*?onClick=\{toggleConnectionMethods\}[\s\S]*?copy\.add/);
    expect(detail).toMatch(/appMethod \? \([\s\S]*?title=\{copy\.app\}[\s\S]*?\) : null/);
    expect(detail).toMatch(/patMethod \? \([\s\S]*?title=\{copy\.pat\}[\s\S]*?\) : null/);
    expect(detail).not.toMatch(/<UiActionAnchor[\s\S]*?>\s*\{copy\.add\}\s*<\/UiActionAnchor>/);
  });
});
