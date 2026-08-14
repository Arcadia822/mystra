import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { StackedListHelperRow } from "./task-list.js";

describe("StackedListHelperRow", () => {
  it("provides the shared live helper row used above stacked records", () => {
    const html = renderToStaticMarkup(createElement(StackedListHelperRow, null, "2 sessions"));

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('class="uiStackedListHelperRow"');
    expect(html).toContain("2 sessions");
  });
});
