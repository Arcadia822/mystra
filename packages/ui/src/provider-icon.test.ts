import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { ProviderIcon } from "./provider-icon.js";

describe("ProviderIcon", () => {
  it.each([
    ["codex", "Codex provider"],
    ["copilot", "GitHub Copilot provider"],
  ] as const)("renders the shared accessible %s glyph", (provider, label) => {
    const html = renderToStaticMarkup(createElement(ProviderIcon, { provider }));

    expect(html).toContain(`<svg aria-label="${label}"`);
    expect(html).toContain(`data-provider-icon="${provider}"`);
    expect(html).toContain('role="img"');
    expect(html).not.toContain("automation");
  });
});
