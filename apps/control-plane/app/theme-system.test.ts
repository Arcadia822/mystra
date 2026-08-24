import { describe, expect, it } from "vitest";

import {
  APPEARANCE_STORAGE_KEY,
  buildAppearanceCssVariables,
  buildThemeBootstrapScript,
  CONTROL_PLANE_FOUNDATION_TOKENS,
  CONTROL_PLANE_THEMES,
  getDefaultAppearancePreferences,
} from "./theme-system";

describe("foundation density tokens", () => {
  it("keeps popup content on the compact 8px inset", () => {
    expect(CONTROL_PLANE_FOUNDATION_TOKENS["--popup-inset"]).toBe("8px");
  });
});

describe("theme surface hierarchy", () => {
  it("derives sidebar, main, and table roles from each selected theme", () => {
    for (const theme of CONTROL_PLANE_THEMES) {
      const values = buildAppearanceCssVariables(appearance("default", 52, theme), theme.variant);

      expect(values["--color-surface-sidebar"]).toBe("var(--surface2)");
      expect(values["--color-surface-main"]).toBe("var(--background)");
      expect(values["--color-surface-table"]).toBe("var(--surface1)");
    }
  });
});

const EDGE_TOKENS = [
  "--border",
  "--border-visible",
  "--code-border",
  "--success-border",
  "--warning-border",
  "--danger-border",
  "--color-focus",
] as const;

function appearance(
  borderMode: "default" | "high-contrast" | "color-high-contrast",
  contrast: number,
  theme = CONTROL_PLANE_THEMES[0],
) {
  if (!theme) throw new Error("Expected the bundled theme catalog to be non-empty.");

  return {
    ...getDefaultAppearancePreferences(),
    borderMode,
    contrast,
    mode: theme.variant,
    [`${theme.variant}ThemeId`]: theme.codeThemeId,
  };
}

describe("appearance border tokens", () => {
  it("keeps every high-contrast edge token independent of the contrast slider for every bundled theme", () => {
    for (const theme of CONTROL_PLANE_THEMES) {
      const minimum = buildAppearanceCssVariables(appearance("high-contrast", 0, theme), theme.variant);
      const maximum = buildAppearanceCssVariables(appearance("high-contrast", 100, theme), theme.variant);

      for (const token of EDGE_TOKENS) {
        expect(maximum[token]).toBe(minimum[token]);
      }
      expect(new Set(EDGE_TOKENS.map((token) => minimum[token])).size).toBe(1);
    }
  });

  it("derives every color-high-contrast edge token independently of the contrast slider for every bundled theme", () => {
    for (const theme of CONTROL_PLANE_THEMES) {
      const minimum = buildAppearanceCssVariables(appearance("color-high-contrast", 0, theme), theme.variant);
      const maximum = buildAppearanceCssVariables(appearance("color-high-contrast", 100, theme), theme.variant);

      for (const token of EDGE_TOKENS) {
        expect(maximum[token]).toBe(minimum[token]);
      }
      expect(minimum["--border"]).toBe(minimum["--border-visible"]);
      expect(minimum["--color-focus"]).toBe(minimum["--border"]);
      expect(minimum["--success-border"]).not.toBe(minimum["--danger-border"]);
    }
  });

  it("keeps the default border mode responsive to the contrast slider", () => {
    const minimum = buildAppearanceCssVariables(appearance("default", 0), "dark");
    const maximum = buildAppearanceCssVariables(appearance("default", 100), "dark");

    expect(maximum["--border"]).not.toBe(minimum["--border"]);
    expect(maximum["--border-visible"]).not.toBe(minimum["--border-visible"]);
  });

  it("uses the same edge-token matrix during bootstrap for every bundled theme", () => {
    const values = new Map<string, string>();
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalMatchMedia = globalThis.matchMedia;
    let storedAppearance = "";

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        documentElement: {
          dataset: {},
          style: { setProperty: (name: string, value: string) => values.set(name, value) },
        },
      },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: (key: string) => key === APPEARANCE_STORAGE_KEY ? storedAppearance : null },
    });
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false }),
    });

    try {
      const bootstrap = new Function(buildThemeBootstrapScript());
      for (const theme of CONTROL_PLANE_THEMES) {
        const preferences = appearance("color-high-contrast", 100, theme);
        const expected = buildAppearanceCssVariables(preferences, theme.variant);
        storedAppearance = JSON.stringify(preferences);
        values.clear();
        bootstrap();

        for (const token of EDGE_TOKENS) {
          expect(values.get(token)).toBe(expected[token]);
        }
      }
    } finally {
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalLocalStorage });
      Object.defineProperty(globalThis, "matchMedia", { configurable: true, value: originalMatchMedia });
    }
  });
});
