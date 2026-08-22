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
  it("keeps inline controls at 28px with 8px horizontal padding", () => {
    expect(styles).toContain("--control-height-inline: 28px;");
    expect(styles).toContain("--control-padding-inline: 8px;");
    expect(rule('.uiAction[data-size="inline"]')).toContain("height: var(--control-height-inline);");
    expect(rule('.uiAction[data-size="inline"]')).toContain("padding-inline: var(--control-padding-inline);");
    expect(rule(".uiFieldControl")).toContain("box-sizing: border-box;");
    expect(rule(".uiFieldControl")).toContain("height: var(--control-height-header);");
    expect(rule(".uiFieldControl")).toContain("padding-block: 0;");
    expect(rule(".uiFieldControl")).toContain("padding-inline: var(--control-padding-inline);");
    expect(styles).toContain("input:not(.uiFieldControl),\nselect:not(.uiFieldControl)");
  });
});

describe("shared section geometry", () => {
  it("keeps header and footer at 44px and gives every section an 8px horizontal inset", () => {
    const header = rule(".uiSurfaceHeader");
    const body = rule(".uiSurfaceBody");
    const footer = rule(".uiSurfaceFooter");
    const title = rule(".uiSurfaceTitle");

    expect(styles).toContain("--section-chrome-height: 44px;");
    expect(header).toContain("height: var(--section-chrome-height);");
    expect(header).toContain("padding: 0 var(--space-2);");
    expect(header).toContain("font-size: var(--font-size-ui);");
    expect(title).toContain("padding: 0 var(--space-2);");
    expect(title).not.toMatch(/font-(?:family|size|weight)\s*:/);
    expect(rule('.uiText[data-variant="heading"]')).toContain("font-weight: var(--font-weight-medium);");
    expect(rule(".uiText")).toContain("font-size: var(--font-size-ui);");
    expect(body).toContain("padding: 0 var(--space-2);");
    expect(footer).toContain("height: var(--section-chrome-height);");
    expect(footer).toContain("padding: 0 var(--space-2);");
    expect(footer).toContain("font-size: var(--font-size-ui);");
    expect(rule('.uiDialogSurface[data-layout="rows"] > .uiSurfaceHeader,\n.uiDialogSurface[data-layout="rows"] > .uiSurfaceFooter')).toContain(
      "height: var(--section-chrome-height);",
    );
  });
});

describe("shared setting row geometry", () => {
  it("fills its container and adds the second 8px text inset", () => {
    expect(rule(".settingGroup")).toContain("width: 100%;");
    expect(rule(".settingRow")).toContain("width: 100%;");
    expect(rule(".settingRow")).toContain("padding: 0 var(--space-2);");
    expect(rule(".settingRowCopy h4")).toContain("font-size: var(--font-size-ui);");
    expect(rule(".settingRowCopy h4")).toContain("font-weight: var(--font-weight-medium);");
    expect(rule(".settingsBusinessGroup > .settingRow")).toContain("padding: var(--space-3) var(--space-2);");
  });
});

describe("shared compact heading typography", () => {
  it("uses 12px and a restrained 500 weight for structural labels", () => {
    expect(styles).toContain("--font-weight-body: 400;");
    expect(styles).toContain("--font-weight-strong: 500;");
    expect(rule(".shellHeaderTitle > .uiText,\n.shellHeaderTitle > strong")).toContain(
      "font-weight: var(--font-weight-strong);",
    );
    expect(rule(".shellHeader")).toContain("min-width: 0;");
    expect(rule(".shellHeader > .uiBreadcrumb")).toContain("flex: 1 1 auto;");
    expect(rule(".shellHeader > .shellHeaderControls")).toContain("flex: none;");
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

describe("shared surface hierarchy", () => {
  it("maps sidebar, main canvas, and table frames to distinct theme surface roles", () => {
    expect(styles).toContain("--color-surface-sidebar: var(--surface2);");
    expect(styles).toContain("--color-surface-main: var(--background);");
    expect(styles).toContain("--color-surface-table: var(--surface1);");
    expect(rule(".sidebar")).toContain("background: var(--color-surface-sidebar);");
    expect(rule(".shellMain")).toContain("background: var(--color-surface-main);");
    expect(rule(".castrelTable")).toContain("background: var(--color-surface-table);");
  });
});
