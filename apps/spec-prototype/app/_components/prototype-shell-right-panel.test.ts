import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./prototype-shell.tsx", import.meta.url), "utf8");

describe("PrototypeShell right panel layout", () => {
  it("uses the shared layout interaction instead of page-owned panel markup", () => {
    expect(source).toContain("rightPanelCollapsed");
    expect(source).toContain("rightPanelVisible");
    expect(source).toContain("<UiShellRightPanel");
    expect(source).toContain("<UiRightPanelToggle");
    expect(source).toContain("hidden={!rightPanelVisible}");
    expect(source).not.toContain("Arcadia");
    expect(source).not.toContain("prototypeAvatar");
    expect(source).not.toContain('<aside aria-label={rightPanel.ariaLabel} className="rightPanel">');
  });

  it("keeps page-owned header actions before the shell-owned panel recovery control", () => {
    expect(source).toContain("headerActions?: ReactNode");
    expect(source).toContain("{headerActions}");
    expect(source.indexOf("{headerActions}")).toBeLessThan(source.indexOf("<UiRightPanelToggle"));
  });

  it("keeps keyboard focus inside prototype dialogs and supports Escape", () => {
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain('querySelectorAll<HTMLElement>');
    expect(source).toContain("onKeyDown={handleDialogKeyDown}");
  });
});
