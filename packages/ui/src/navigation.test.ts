import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiBreadcrumb } from "./navigation.js";

describe("UiBreadcrumb", () => {
  it("renders linked ancestors, arrow separators, and the current item", () => {
    const html = renderToStaticMarkup(createElement(UiBreadcrumb, {
      items: [
        { href: "/tasks", label: "Tasks" },
        { label: "MYS-101" },
      ],
    }));

    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('href="/tasks"');
    expect(html).toContain('data-icon="chevron-right"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("MYS-101");
  });
});
