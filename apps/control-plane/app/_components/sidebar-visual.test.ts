import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readAppFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("sidebar visual primitives", () => {
  it("routes icons, counts, marks, status, and icon buttons through one base component", () => {
    const source = readAppFile("./sidebar-visual.tsx");

    expect(source).toMatch(/export function SidebarVisual/);
    for (const component of [
      "SidebarIcon",
      "SidebarCountBadge",
      "SidebarIconButton",
      "SidebarMark",
      "SidebarStatusIcon",
    ]) {
      expect(source, `${component} must reuse SidebarVisual`).toMatch(
        new RegExp(`export function ${component}[\\s\\S]*?<SidebarVisual`),
      );
    }
  });

  it("uses the shared sidebar primitives at every current shell icon site", () => {
    const shell = readAppFile("./app-shell.tsx");

    expect(shell).toContain("<SidebarCountBadge count={inboxCount} />");
    expect(shell).toContain("<SidebarIconButton");
    expect(shell).toContain("<SidebarStatusIcon");
    expect(shell).not.toMatch(/className="(?:navIcon|projectMark|taskStatusIcon|sidebarSectionAction|sidebarToggle)"/);
  });

  it("gives every trailing visual one slot and every shell icon one style template", () => {
    const css = readAppFile("../globals.css");

    expect(css).toMatch(/\.sidebarVisual\[data-position="trailing"\]\s*\{[\s\S]*?width:\s*var\(--control-height-compact\);[\s\S]*?height:\s*var\(--control-height-compact\);/);
    expect(css).toMatch(/\.sidebarVisual svg\s*\{[\s\S]*?width:\s*var\(--space-4\);[\s\S]*?height:\s*var\(--space-4\);[\s\S]*?stroke-width:\s*var\(--shell-icon-stroke\);/);
    expect(css).toMatch(/\.sidebarVisual,[\s\S]*?\.sidebarVisualButton,[\s\S]*?\.sidebarVisual svg,[\s\S]*?transition:\s*background-color 120ms ease, color 120ms ease, opacity 120ms ease, transform 120ms ease;/);
  });
});
