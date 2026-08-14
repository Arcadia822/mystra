import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./task-detail-prototype.tsx", import.meta.url), "utf8");
const dialogSource = readFileSync(new URL("./create-session-dialog.tsx", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("./prototype-shell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../prototype.css", import.meta.url), "utf8");
const uiStyles = readFileSync(new URL("../../../../packages/ui/src/styles.css", import.meta.url), "utf8");

describe("054 Task detail prototype", () => {
  it("starts Main directly with the Sessions stacked view", () => {
    expect(source).toContain('<main className="taskDetailMain">');
    expect(source).toContain('<section aria-label="Sessions" className="taskSessionsSection">');
    expect(source).toContain("<StackedListHelperRow>");
    expect(source).toContain('fields={sessionFields}>');
    expect(source).not.toContain('className="taskDetailIdentity"');
    expect(source).not.toContain('className="taskExecutionOverview"');
    expect(source).not.toContain('className="taskProductionCards"');
    expect(source).not.toContain("<UiSurface");
  });

  it("uses the requested stacked field order and default visibility", () => {
    expect(source).toContain('{ key: "state", align: "left", equalWidth: true, renderType: "labels" }');
    expect(source).toContain('{ key: "provider", align: "left", renderType: "icon" }');
    expect(source).toContain('{ key: "name", align: "left", renderType: "text" }');
    expect(source).toContain('{ key: "runtime", align: "right", renderType: "labels" }');
    expect(source).toContain('{ key: "updated", align: "right", equalWidth: true, renderType: "datetime" }');
    expect(source).toContain("runtime: false");
    expect(source).toContain("<UiLabel>{runtimeNames[session.runtimeId]");
    expect(source).toContain("<SessionDate value={session.updatedAt} />");
  });

  it("keeps the title role honest when Session has no title field", () => {
    expect(source).toContain("<span title={session.id}>{session.id}</span>");
    expect(source).not.toContain("Session {shortIdentifier(session.id)}");
    expect(source).not.toContain("session.title");
    expect(source).toContain("key={session.id}");
    expect(source).toContain("router.push(`/sessions/${session.id}`)");
  });

  it("reuses shared list, helper, label, icon, and shell primitives", () => {
    expect(source).toContain("PrototypeShell");
    expect(source).toContain("StackedList");
    expect(source).toContain("StackedListHelperRow");
    expect(source).toContain("StackedListRow");
    expect(source).toContain("StackedListField");
    expect(source).toContain("UiLabel");
    expect(source).toContain("ProviderIcon");
    expect(source).not.toContain("UiTable");
    expect(source).not.toContain("<table");
    expect(source).not.toContain("<thead");
    expect(source).not.toContain("<tbody");
    expect(source).not.toContain("<svg");
  });

  it("leaves breadcrumb and the global Right Panel with their existing owners", () => {
    expect(source).toContain("breadcrumbItems={[");
    expect(source).not.toContain("{ label: taskId }");
    expect(source).not.toContain('<nav aria-label="Breadcrumb"');
    expect(shellSource).toContain("breadcrumbItems?: readonly UiBreadcrumbItem[]");
    expect(shellSource).toContain("<UiBreadcrumb items={breadcrumbItems}");
    expect(source).toContain("rightPanel={{");
    expect(source).toContain('header: "Properties"');
    expect(source).not.toContain('className="taskDetailAside"');
  });

  it("lets the shell own the page inset and the shared list own row density", () => {
    expect(styles).toMatch(/\.taskDetailPrototype\s*\{[^}]*padding: 0;/s);
    expect(styles).toMatch(/\.taskDetailMain\s*\{[^}]*gap: var\(--space-2\);/s);
    expect(uiStyles).toMatch(/\.uiStackedListHelperRow\s*\{[^}]*min-height: var\(--row-height-compact\);/s);
    expect(uiStyles).toMatch(/\.uiStackedListRow\s*\{[^}]*min-height: 42px;/s);
  });

  it("restores the Task-owned New Session action in the main header", () => {
    expect(source).toContain("headerActions={");
    expect(source).toContain("New Session");
    expect(source).toContain("setCreateSessionOpen(true)");
    expect(source).toContain("<CreateSessionDialog");
  });

  it("models the canonical manual Session launch fields in a shared dialog", () => {
    expect(dialogSource).toContain("<PrototypeDialog");
    expect(dialogSource).toContain("<UiDialogSurface");
    expect(dialogSource).toContain("Runtime · locked");
    expect(dialogSource).toContain('aria-label="Provider"');
    expect(dialogSource).toContain('aria-label="Optional Agent Context"');
    expect(dialogSource).toContain('aria-label="Manual Context"');
    expect(dialogSource).toContain("Launch Session");
    expect(dialogSource).toContain("onLaunch");
    expect(dialogSource).toContain("dispatchBoundaryReached");
    expect(dialogSource).toContain('aria-live="polite"');
  });
});
