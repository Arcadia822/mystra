import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./app-shell.tsx", import.meta.url), "utf8");

describe("AppShell right panel layout", () => {
  it("owns collapse state and moves the reopen control into the main header", () => {
    expect(source).toContain("collapsedRightPanelId");
    expect(source).toContain("rightPanelVisible");
    expect(source).toContain("<UiShellRightPanel");
    expect(source).toContain("<UiRightPanelToggle");
    expect(source).toContain("setCollapsedRightPanelId(rightPanel.id)");
    expect(source).toContain("setCollapsedRightPanelId(null)");
    expect(source).toContain("hidden={!rightPanelVisible}");
    expect(source).not.toContain("<TeamSwitcher");
    expect(source).not.toContain('href="/account" size="compact">Account');
  });
});
