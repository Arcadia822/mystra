import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

import { UiRightPanelToggle, UiShellRightPanel } from "./ui-surfaces.js";

describe("shared shell right panel", () => {
  it("owns the panel header and accessible collapse control", () => {
    const markup = renderToStaticMarkup(createElement(UiShellRightPanel, {
      ariaLabel: "Task details",
      children: "Panel content",
      collapseLabel: "Collapse Task details",
      header: "Properties",
      onCollapse: vi.fn(),
    }));

    expect(markup).toContain('id="shell-right-panel"');
    expect(markup).toContain('aria-label="Collapse Task details"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('data-icon="chevron-right"');
  });

  it("renders the matching main-header reopen control", () => {
    const markup = renderToStaticMarkup(createElement(UiRightPanelToggle, {
      expanded: false,
      label: "Expand Task details",
      onToggle: vi.fn(),
    }));

    expect(markup).toContain('aria-controls="shell-right-panel"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('data-icon="chevron-left"');
  });
});
