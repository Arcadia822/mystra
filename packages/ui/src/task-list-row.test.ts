import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StackedListRow } from "./task-list.js";

describe("StackedListRow", () => {
  it("preserves native disabled semantics for unavailable records", () => {
    const html = renderToStaticMarkup(createElement(StackedListRow, {
      disabled: true,
      left: "",
      name: "Archived repository",
      right: "archived",
    }));

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain('role="listitem"');
    expect(html).toContain("Archived repository");
  });
});
