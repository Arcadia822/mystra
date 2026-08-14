import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS rule: ${selector}`);
  return match[1];
}

describe("shared popup density", () => {
  it("keeps the standard popup inset at 8px", () => {
    expect(styles).toContain("--popup-inset: 8px;");
    expect(rule('.uiSurface[data-variant="popup"] > .uiSurfaceBody')).toContain("padding: var(--popup-inset);");
  });
});

describe("shared inline action density", () => {
  it("keeps inline controls at 20px", () => {
    expect(styles).toContain("--control-height-inline: 20px;");
    expect(rule('.uiAction[data-size="inline"]')).toContain("height: var(--control-height-inline);");
  });
});

describe("shared compact heading typography", () => {
  it("uses 12px and a restrained 500 weight for structural labels", () => {
    expect(styles).toContain("--font-weight-body: 400;");
    expect(styles).toContain("--font-weight-strong: 500;");
    expect(rule(".shellHeader strong")).toContain("font-weight: var(--font-weight-strong);");
    expect(rule(".rightPanelHeader strong")).toContain("font-weight: var(--font-weight-strong);");
    expect(rule(".uiBreadcrumbLabel")).toContain("font-weight: var(--font-weight-strong);");
  });
});

describe("shared checkbox anatomy", () => {
  it("uses the standard 16px visual slot", () => {
    expect(rule(".uiCheckbox")).toContain("width: 16px;");
    expect(rule(".uiCheckbox")).toContain("height: 16px;");
    expect(rule(".uiCheckboxVisual")).toContain("width: 16px;");
    expect(rule(".uiCheckboxVisual")).toContain("height: 16px;");
    expect(rule(".uiCheckboxCheckIcon")).toContain("width: 12px;");
    expect(rule(".uiCheckboxCheckIcon")).toContain("height: 12px;");
  });

  it("does not stretch checkbox inputs to the coarse-pointer touch target", () => {
    const coarsePointerRules = styles.slice(styles.indexOf("@media (pointer: coarse)"));
    expect(coarsePointerRules).not.toMatch(/^\s*input,\s*$/m);
  });
});

describe("shared label anatomy", () => {
  it("uses standard 12px content text and 16px icons", () => {
    expect(rule(".taskLabel")).toContain("font-size: 12px;");
    expect(rule(".taskLabel > svg")).toContain("width: 16px;");
    expect(rule(".taskLabel > svg")).toContain("height: 16px;");
    expect(rule('.uiAction.uiLabelOverflowTrigger[data-size="compact"]')).toContain("font-size: 12px;");
  });
});

describe("shared stacked field typography", () => {
  it("uses one presentation for name, text, and datetime fields", () => {
    const textRule = rule(".uiStackedListText");
    const childRule = rule(".uiStackedListText > *");
    expect(textRule).toContain("color: var(--text1);");
    expect(textRule).toContain("font-family: inherit;");
    expect(textRule).toContain("font-size: inherit;");
    expect(textRule).toContain("font-weight: 500;");
    expect(childRule).toContain("color: inherit;");
    expect(childRule).toContain("font: inherit;");
    expect(rule(".uiStackedListRight")).not.toMatch(/font-size\s*:/);
  });
});

describe("shared stacked row geometry", () => {
  it("lets the left-side final name field grow instead of the spacer", () => {
    expect(rule(".uiStackedListName")).toContain("flex: 1 1 auto;");
    expect(rule(".uiStackedListSpacer")).toContain("flex: 0 0 var(--space-4);");
    expect(rule(".uiStackedListSpacer")).toContain("min-width: var(--space-4);");
  });
});

describe("shared Task status anatomy", () => {
  it("uses the theme canvas token for marks inside solid status circles", () => {
    expect(rule(".taskStatusMark")).toContain("stroke: var(--color-canvas);");
    expect(rule(".taskStatusMark")).not.toContain("var(--canvas)");
  });
});
