import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiSegmented } from "./ui-preference-controls.js";

describe("shared UiSegmented", () => {
  it("renders the standard preference switch as a pressed button group", () => {
    const html = renderToStaticMarkup(createElement(UiSegmented, {
      "aria-label": "Theme mode",
      onValueChange: () => undefined,
      options: [
        { label: "System", value: "system" },
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ],
      value: "system",
    }));

    expect(html).toContain('class="uiSegmented"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("reuses the same component and visual anatomy for semantic tabs", () => {
    const html = renderToStaticMarkup(createElement(UiSegmented, {
      "aria-label": "Project sections",
      onValueChange: () => undefined,
      options: [
        { label: "Overview", value: "overview" },
        { label: "Issues", value: "issues" },
        { label: "Settings", value: "settings" },
      ],
      role: "tablist",
      value: "issues",
    }));

    expect(html).toContain('class="uiSegmented"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('tabindex="-1"');
    expect(html).not.toContain('aria-pressed');
  });
});
