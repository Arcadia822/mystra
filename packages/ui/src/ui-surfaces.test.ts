import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiSurfaceTitle } from "./ui-surfaces.js";

describe("UiSurfaceTitle", () => {
  it("owns the shared section-title semantic element and class", () => {
    const markup = renderToStaticMarkup(createElement(UiSurfaceTitle, { id: "section-title" }, "Create Project"));

    expect(markup).toBe('<h2 id="section-title" class="uiText uiSurfaceTitle" data-variant="heading">Create Project</h2>');
    expect(renderToStaticMarkup(createElement(UiSurfaceTitle, { as: "h3" }, "Nested section")))
      .toBe('<h3 class="uiText uiSurfaceTitle" data-variant="heading">Nested section</h3>');
  });
});
