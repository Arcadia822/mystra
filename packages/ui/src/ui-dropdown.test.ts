import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiDropdown } from "./ui-dropdown.js";

describe("UiDropdown", () => {
  it("forwards the requested inline size to its trigger", () => {
    const markup = renderToStaticMarkup(createElement(UiDropdown, {
      "aria-label": "Project",
      onValueChange: () => undefined,
      options: [{ label: "No project", value: "" }],
      placeholder: "No project",
      size: "inline",
      value: "",
      variant: "ghost",
    }));

    expect(markup).toContain('class="uiAction uiDropdownTrigger"');
    expect(markup).toContain('data-size="inline"');
  });
});
