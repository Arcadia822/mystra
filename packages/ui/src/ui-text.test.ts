import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiText } from "./ui-text.js";

describe("UiText", () => {
  it("renders the requested semantic element with a bounded public text role", () => {
    expect(renderToStaticMarkup(createElement(UiText, { as: "h2", variant: "heading" }, "Create Project")))
      .toBe('<h2 class="uiText" data-variant="heading">Create Project</h2>');
    expect(renderToStaticMarkup(createElement(UiText, { as: "p", variant: "annotation" }, "Description")))
      .toBe('<p class="uiText" data-variant="annotation">Description</p>');
  });
});
