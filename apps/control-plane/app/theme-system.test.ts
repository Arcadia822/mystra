import vm from "node:vm";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  APPEARANCE_STORAGE_KEY,
  CONTROL_PLANE_FOUNDATION_TOKENS,
  CONTROL_PLANE_THEMES,
  THEME_STORAGE_KEY,
  buildAppearanceCssVariables,
  buildThemeBootstrapScript,
  buildThemeCssVariables,
  buildThemeSwatch,
  getDefaultAppearancePreferences,
  getDefaultTheme,
  normalizeAppearancePreferences,
  resolveAppearanceTheme,
  resolveAppearanceVariant,
} from "./theme-system";

describe("control-plane theme system", () => {
  it("uses Graphite Signal as the default design-system preset", () => {
    const theme = getDefaultTheme();

    expect(theme.id).toBe("graphite-signal");
    expect(theme.variant).toBe("dark");
    expect(theme.theme.fonts.ui).toContain("Fira Code");
  });

  it("maps Graphite Signal source tokens without deriving new palette values", () => {
    const variables = buildThemeCssVariables(getDefaultTheme());

    expect(variables).toMatchObject({
      "--background": "#111513",
      "--surface1": "#181C1A",
      "--surface2": "#202522",
      "--surface3": "#2B312D",
      "--border": "rgba(118, 129, 122, 0.17)",
      "--border-visible": "rgba(118, 129, 122, 0.30)",
      "--text1": "#E7ECE8",
      "--text2": "#AAB4AD",
      "--text3": "#76817A",
      "--accent": "#74B98B",
      "--success": "#5CAA76",
      "--warning": "#C7A45C",
      "--danger": "#C36F56",
      "--signal-keyword": "#9478C0",
      "--signal-number": "#C7A45C",
      "--signal-type": "#499E95",
      "--signal-function": "#5E86B7",
      "--signal-string": "#5CAA76",
      "--signal-attention": "#BB6677",
      "--radius": "4px",
      "--shadow-1": "none",
      "--shadow-2": "none",
    });
  });

  it("renders a flat theme swatch because Graphite Signal prohibits gradients", () => {
    expect(buildThemeSwatch(getDefaultTheme())).toBe("#111513");
  });

  it("keeps every selectable preset on the shared flat geometry contract", () => {
    for (const theme of CONTROL_PLANE_THEMES) {
      const variables = buildThemeCssVariables(theme);

      expect(variables["--radius"]).toBe("4px");
      expect(variables["--radius-xs"]).toBe("2px");
      expect(variables["--radius-sm"]).toBe("2px");
      expect(variables["--radius-md"]).toBe("4px");
      expect(variables["--radius-elevated"]).toBe("6px");
      expect(variables["--shadow-1"]).toBe("none");
      expect(variables["--shadow-2"]).toBe("none");
      expect(variables["--font-sans"]).toContain("Fira Code");
      expect(variables["--font-mono"]).toContain("Fira Code");
      expect(buildThemeSwatch(theme)).not.toContain("gradient");
    }
  });

  it("applies the saved preset before hydration through the theme bootstrap", () => {
    const dataset: Record<string, string> = {};
    const properties = new Map<string, string>();

    vm.runInNewContext(buildThemeBootstrapScript(), {
      document: {
        documentElement: {
          dataset,
          style: { setProperty: (name: string, value: string) => properties.set(name, value) },
        },
      },
      localStorage: {
        getItem: (key: string) => key === THEME_STORAGE_KEY ? "notion-light" : null,
      },
      matchMedia: () => ({ matches: false }),
    });

    expect(dataset).toMatchObject({
      themeId: "notion",
      themePreset: "notion-light",
      themeVariant: "light",
    });
    expect(properties.get("--font-sans")).toContain("Fira Code");
    expect(properties.get("--background")).toBeTruthy();
  });

  it("normalizes damaged browser preferences without accepting mismatched theme variants", () => {
    expect(normalizeAppearancePreferences({
      version: 1,
      mode: "neon",
      lightThemeId: "notion-dark",
      darkThemeId: "linen-light",
      borderMode: "loud",
      codeSurfaceVariant: "sepia",
      contrast: 800,
      uiFont: 42,
      chatFont: "  Inter  ",
      codeFont: "",
      uiFontSize: 100,
      chatFontSize: 2,
    })).toEqual({
      ...getDefaultAppearancePreferences(),
      chatFont: "Inter",
      codeFont: null,
      contrast: 100,
      uiFontSize: 14,
      chatFontSize: 12,
    });
  });

  it("resolves System, Light, and Dark modes against separate theme selections", () => {
    const preferences = {
      ...getDefaultAppearancePreferences(),
      lightThemeId: "linen-light",
      darkThemeId: "notion-dark",
    };

    expect(resolveAppearanceVariant(preferences, "light")).toBe("light");
    expect(resolveAppearanceTheme(preferences, "light").id).toBe("linen-light");
    expect(resolveAppearanceTheme(preferences, "dark").id).toBe("notion-dark");
    expect(resolveAppearanceTheme({ ...preferences, mode: "dark" }, "light").id).toBe("notion-dark");
  });

  it("publishes detail, border, code-surface, and font preferences as runtime tokens", () => {
    const base = getDefaultAppearancePreferences();
    const quiet = buildAppearanceCssVariables({ ...base, contrast: 0 }, "dark");
    const vivid = buildAppearanceCssVariables({
      ...base,
      borderMode: "color-high-contrast",
      chatFont: "Literata",
      codeFont: "JetBrains Mono",
      codeSurfaceVariant: "light",
      contrast: 100,
      uiFont: "Inter",
      uiFontSize: 14,
      chatFontSize: 16,
    }, "dark");

    expect(vivid["--border-visible"]).not.toBe(quiet["--border-visible"]);
    expect(vivid["--code-bg"]).not.toBe(quiet["--code-bg"]);
    expect(vivid).toMatchObject({
      "--font-sans": "Inter",
      "--font-chat": "Literata",
      "--font-mono": "JetBrains Mono",
      "--font-size-ui": "14px",
      "--font-size-chat": "16px",
    });
  });

  it("hydrates the full appearance model before React and keeps legacy theme fallback", () => {
    const runBootstrap = (storage: Record<string, string>) => {
      const dataset: Record<string, string> = {};
      const properties = new Map<string, string>();
      vm.runInNewContext(buildThemeBootstrapScript(), {
        document: { documentElement: { dataset, style: { setProperty: (name: string, value: string) => properties.set(name, value) } } },
        localStorage: { getItem: (key: string) => storage[key] ?? null },
        matchMedia: () => ({ matches: true }),
      });
      return { dataset, properties };
    };

    const saved = runBootstrap({
      [APPEARANCE_STORAGE_KEY]: JSON.stringify({
        ...getDefaultAppearancePreferences(),
        mode: "light",
        lightThemeId: "linen-light",
        uiFontSize: 14,
      }),
    });
    expect(saved.dataset).toMatchObject({ themePreset: "linen-light", themeVariant: "light" });
    expect(saved.properties.get("--font-size-ui")).toBe("14px");

    const legacy = runBootstrap({ [THEME_STORAGE_KEY]: "notion-light" });
    expect(legacy.dataset).toMatchObject({ themePreset: "notion-light", themeVariant: "light" });
  });

  it("publishes Castrel-derived density and padding through named theme tokens", () => {
    const variables = buildThemeCssVariables(getDefaultTheme());

    expect(variables).toMatchObject({
      ...CONTROL_PLANE_FOUNDATION_TOKENS,
      "--control-height-compact": "24px",
      "--control-height-header": "28px",
      "--control-height-default": "32px",
      "--field-height-default": "36px",
      "--page-inset-inline": "16px",
      "--page-inset-inline-narrow": "12px",
      "--page-inset-top": "12px",
      "--page-inset-bottom": "32px",
      "--panel-inset": "16px",
      "--modal-inset": "20px",
      "--popup-inset": "16px",
      "--reading-body-inset": "24px",
      "--reading-body-inset-narrow": "16px",
      "--color-surface-hover": "var(--surface3)",
      "--color-text-primary": "var(--text1)",
      "--color-border-soft": "var(--border)",
      "--color-focus": "var(--accent)",
    });
    expect(variables["--composer-inset-top"]).toBe("9px");
    expect(variables["--composer-inset-right"]).toBe("7px");
    expect(variables["--composer-inset-bottom"]).toBe("7px");
    expect(variables["--composer-inset-left"]).toBe("9px");
    expect(variables["--space-5"]).toBe("20px");
  });

  it("keeps the pre-hydration CSS fallback aligned with runtime foundation tokens", () => {
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

    for (const [name, value] of Object.entries(CONTROL_PLANE_FOUNDATION_TOKENS)) {
      expect(css, `${name} must match the runtime theme token`).toContain(`${name}: ${value};`);
    }
  });
});
