import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiCheckbox } from "./ui-fields.js";

describe("UiCheckbox", () => {
  it("keeps the native checkbox semantic behind a shared visual primitive", () => {
    const markup = renderToStaticMarkup(createElement(UiCheckbox, {
      "aria-label": "Show Project",
      checked: true,
      readOnly: true,
    }));

    expect(markup).toContain('class="uiCheckbox"');
    expect(markup).toContain('class="uiCheckboxInput"');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('class="uiCheckboxVisual"');
    expect(markup).toContain('class="uiCheckboxCheckIcon"');
  });
});
