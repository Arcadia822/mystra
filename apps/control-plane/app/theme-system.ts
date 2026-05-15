export type ThemeVariant = "light" | "dark";

export interface ControlPlaneThemeDefinition {
  id: string;
  label: string;
  description: string;
  codeThemeId: string;
  variant: ThemeVariant;
  theme: {
    accent: string;
    contrast: number;
    fonts: {
      code: string | null;
      ui: string | null;
    };
    ink: string;
    opaqueWindows: boolean;
    semanticColors: {
      diffAdded: string;
      diffRemoved: string;
      skill: string;
    };
    surface: string;
  };
}

const DEFAULT_UI_FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const DEFAULT_CODE_FONT =
  '"SFMono-Regular", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const CONTROL_PLANE_THEMES: ControlPlaneThemeDefinition[] = [
  {
    id: "notion-light",
    label: "Notion / Light",
    description: "Quiet white workspace with restrained borders and blue emphasis.",
    codeThemeId: "notion",
    variant: "light",
    theme: {
      accent: "#3183d8",
      contrast: 29,
      fonts: {
        code: null,
        ui: null,
      },
      ink: "#37352f",
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#008000",
        diffRemoved: "#a31515",
        skill: "#0000ff",
      },
      surface: "#ffffff",
    },
  },
  {
    id: "linen-light",
    label: "Linen / Light",
    description: "Warm review mode with softer neutrals and amber emphasis.",
    codeThemeId: "linen",
    variant: "light",
    theme: {
      accent: "#9d5a18",
      contrast: 24,
      fonts: {
        code: null,
        ui: null,
      },
      ink: "#30261f",
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#2f7d53",
        diffRemoved: "#b14f3c",
        skill: "#7950f2",
      },
      surface: "#fffaf3",
    },
  },
  {
    id: "notion-dark",
    label: "Notion / Dark",
    description: "Dark operators' mode with the same spacing and surface rules.",
    codeThemeId: "notion",
    variant: "dark",
    theme: {
      accent: "#5ba8ff",
      contrast: 76,
      fonts: {
        code: null,
        ui: null,
      },
      ink: "#f1f1ef",
      opaqueWindows: true,
      semanticColors: {
        diffAdded: "#4ade80",
        diffRemoved: "#f87171",
        skill: "#8ea7ff",
      },
      surface: "#191919",
    },
  },
];

export function getDefaultTheme(): ControlPlaneThemeDefinition {
  const theme = CONTROL_PLANE_THEMES[0];
  if (!theme) {
    throw new Error("At least one control-plane theme must be defined.");
  }

  return theme;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) {
    return trimmed;
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return trimmed;
}

function hexToRgb(value: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(value).replace("#", "");
  const int = Number.parseInt(normalized, 16);

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const channel = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function mix(first: string, second: string, weight: number): string {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const w = clamp(weight, 0, 1);
  return rgbToHex({
    r: a.r + (b.r - a.r) * w,
    g: a.g + (b.g - a.g) * w,
    b: a.b + (b.b - a.b) * w,
  });
}

function alpha(value: string, opacity: number): string {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1)})`;
}

function luminance(value: string): number {
  const { r, g, b } = hexToRgb(value);
  const channel = (sample: number) => {
    const s = sample / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function readableForeground(background: string): string {
  return luminance(background) > 0.45 ? "#11151b" : "#ffffff";
}

export function getThemeById(themeId: string): ControlPlaneThemeDefinition | undefined {
  return CONTROL_PLANE_THEMES.find((theme) => theme.id === themeId);
}

export function buildThemeCssVariables(themeDefinition: ControlPlaneThemeDefinition): Record<string, string> {
  const { accent, contrast, fonts, ink, opaqueWindows, semanticColors, surface } = themeDefinition.theme;
  const depth = clamp(contrast / 100, 0, 1);
  const background = themeDefinition.variant === "light"
    ? mix(surface, ink, 0.025 + depth * 0.05)
    : mix(surface, "#000000", 0.16 + depth * 0.12);
  const surface1 = opaqueWindows
    ? alpha(surface, themeDefinition.variant === "light" ? 0.82 : 0.88)
    : alpha(surface, themeDefinition.variant === "light" ? 0.72 : 0.76);
  const surface2 = mix(surface, themeDefinition.variant === "light" ? "#ffffff" : "#000000", themeDefinition.variant === "light" ? 0.02 : 0.06);
  const surface3 = mix(surface, ink, themeDefinition.variant === "light" ? 0.06 + depth * 0.08 : 0.12 + depth * 0.12);
  const surfaceInset = alpha(mix(surface, ink, themeDefinition.variant === "light" ? 0.05 : 0.1), themeDefinition.variant === "light" ? 0.92 : 0.9);
  const border = mix(surface, ink, themeDefinition.variant === "light" ? 0.12 + depth * 0.08 : 0.2 + depth * 0.12);
  const borderVisible = mix(surface, ink, themeDefinition.variant === "light" ? 0.18 + depth * 0.1 : 0.28 + depth * 0.14);
  const text1 = ink;
  const text2 = mix(ink, surface, themeDefinition.variant === "light" ? 0.3 : 0.26);
  const text3 = mix(ink, surface, themeDefinition.variant === "light" ? 0.52 : 0.44);
  const accentSoft = alpha(accent, themeDefinition.variant === "light" ? 0.12 + depth * 0.05 : 0.18 + depth * 0.05);
  const warning = mix(semanticColors.diffRemoved, accent, 0.55);

  return {
    "--font-sans": fonts.ui ?? DEFAULT_UI_FONT,
    "--font-mono": fonts.code ?? DEFAULT_CODE_FONT,
    "--background": background,
    "--surface1": surface1,
    "--surface2": surface2,
    "--surface3": surface3,
    "--surface-inset": surfaceInset,
    "--border": border,
    "--border-visible": borderVisible,
    "--text1": text1,
    "--text2": text2,
    "--text3": text3,
    "--accent": accent,
    "--accent-soft": accentSoft,
    "--accent-contrast": readableForeground(accent),
    "--success": semanticColors.diffAdded,
    "--success-bg": alpha(semanticColors.diffAdded, themeDefinition.variant === "light" ? 0.12 : 0.16),
    "--success-border": alpha(semanticColors.diffAdded, themeDefinition.variant === "light" ? 0.24 : 0.28),
    "--warning": warning,
    "--warning-bg": alpha(warning, themeDefinition.variant === "light" ? 0.14 : 0.18),
    "--warning-border": alpha(warning, themeDefinition.variant === "light" ? 0.24 : 0.28),
    "--danger": semanticColors.diffRemoved,
    "--danger-bg": alpha(semanticColors.diffRemoved, themeDefinition.variant === "light" ? 0.12 : 0.16),
    "--danger-border": alpha(semanticColors.diffRemoved, themeDefinition.variant === "light" ? 0.24 : 0.28),
    "--skill-accent": semanticColors.skill,
    "--page-glow": alpha(
      themeDefinition.variant === "light" ? mix(surface, "#ffffff", 0.8) : accent,
      themeDefinition.variant === "light" ? 0.42 : 0.12,
    ),
    "--page-wash": alpha(
      themeDefinition.variant === "light" ? mix(surface, "#ffffff", 0.55) : surface,
      themeDefinition.variant === "light" ? 0.14 : 0.04,
    ),
    "--theme-swatch-border": alpha(
      themeDefinition.variant === "light" ? mix(surface, ink, 0.12) : accent,
      themeDefinition.variant === "light" ? 0.22 : 0.28,
    ),
    "--shadow-1": themeDefinition.variant === "light"
      ? `0 1px 2px ${alpha(ink, 0.04)}, 0 16px 40px ${alpha(ink, 0.05)}`
      : `0 1px 2px ${alpha("#000000", 0.25)}, 0 16px 44px ${alpha("#000000", 0.24)}`,
    "--shadow-2": themeDefinition.variant === "light"
      ? `0 22px 64px ${alpha(ink, 0.1)}`
      : `0 22px 70px ${alpha("#000000", 0.34)}`,
    "--code-bg": mix(surface, "#000000", themeDefinition.variant === "light" ? 0.88 : 0.34),
    "--code-border": border,
    "--code-text": themeDefinition.variant === "light" ? "#e8edf4" : "#d7deea",
  };
}

export function applyThemeToDocument(themeDefinition: ControlPlaneThemeDefinition): void {
  const root = document.documentElement;
  root.dataset.themeId = themeDefinition.codeThemeId;
  root.dataset.themeVariant = themeDefinition.variant;
  root.dataset.themePreset = themeDefinition.id;

  const variables = buildThemeCssVariables(themeDefinition);
  for (const [name, value] of Object.entries(variables)) {
    root.style.setProperty(name, value);
  }
}

export function buildThemeSwatch(themeDefinition: ControlPlaneThemeDefinition): string {
  const accentGlow = alpha(themeDefinition.theme.accent, themeDefinition.variant === "light" ? 0.22 : 0.28);
  const base = themeDefinition.theme.surface;
  const secondary = mix(base, themeDefinition.theme.ink, themeDefinition.variant === "light" ? 0.08 : 0.18);

  return `linear-gradient(135deg, ${alpha(themeDefinition.theme.surface, themeDefinition.variant === "light" ? 0.96 : 0.9)}, transparent), linear-gradient(160deg, ${secondary}, ${accentGlow})`;
}
