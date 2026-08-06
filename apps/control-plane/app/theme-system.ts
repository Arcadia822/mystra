export type ThemeVariant = "light" | "dark";

interface ExplicitThemeTokens {
  canvas: string;
  hairline: string;
  hairlineSoft: string;
  inkMuted: string;
  inkSubtle: string;
  onPrimary: string;
  signalAttention: string;
  signalFunction: string;
  signalKeyword: string;
  signalNumber: string;
  signalType: string;
  surface1: string;
  surface2: string;
  surface3: string;
}

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
    tokens?: ExplicitThemeTokens;
    semanticColors: {
      diffAdded: string;
      diffRemoved: string;
      skill: string;
    };
    surface: string;
  };
}

const GRAPHITE_SIGNAL_FONT =
  '"Fira Code", "Maple Mono", ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, monospace';
const DEFAULT_UI_FONT = GRAPHITE_SIGNAL_FONT;
const DEFAULT_CODE_FONT = GRAPHITE_SIGNAL_FONT;

export const THEME_STORAGE_KEY = "mystra-control-plane-theme-v2";

export const CONTROL_PLANE_FOUNDATION_TOKENS = {
  "--space-0": "0px",
  "--space-half": "2px",
  "--space-1": "4px",
  "--space-row-gap": "4px",
  "--space-control-gap": "6px",
  "--space-2": "8px",
  "--space-header-inset": "10px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "20px",
  "--space-6": "24px",
  "--space-8": "32px",
  "--space-12": "48px",
  "--space-24": "96px",
  "--control-height-compact": "24px",
  "--control-height-header": "28px",
  "--control-height-default": "32px",
  "--field-height-default": "36px",
  "--control-padding-compact": "8px",
  "--control-padding-header": "10px",
  "--control-padding-default": "12px",
  "--row-height-compact": "28px",
  "--touch-target": "44px",
  "--page-inset-inline": "16px",
  "--page-inset-inline-narrow": "12px",
  "--page-inset-top": "12px",
  "--page-inset-bottom": "32px",
  "--content-inset": "12px",
  "--panel-inset": "16px",
  "--reading-body-inset": "24px",
  "--reading-body-inset-narrow": "16px",
  "--modal-inset": "20px",
  "--popup-inset": "16px",
  "--layout-gap": "12px",
  "--stack-gap": "8px",
  "--tight-gap": "4px",
  "--composer-inset-top": "9px",
  "--composer-inset-right": "7px",
  "--composer-inset-bottom": "7px",
  "--composer-inset-left": "9px",
  "--sidebar-width-expanded": "300px",
  "--shell-header-height": "46px",
  "--radius-compact": "2px",
  "--radius-control": "4px",
  "--radius-panel": "6px",
  "--radius-round": "999px",
} as const;

const CONTROL_PLANE_SEMANTIC_ALIASES = {
  "--color-canvas": "var(--background)",
  "--color-surface-panel": "var(--surface2)",
  "--color-surface-popup": "var(--surface1)",
  "--color-surface-hover": "var(--surface3)",
  "--color-surface-selected": "var(--surface3)",
  "--color-text-primary": "var(--text1)",
  "--color-text-secondary": "var(--text2)",
  "--color-text-muted": "var(--text3)",
  "--color-border-soft": "var(--border)",
  "--color-border-strong": "var(--border-visible)",
  "--color-focus": "var(--accent)",
  "--color-primary": "var(--accent)",
  "--color-primary-foreground": "var(--accent-contrast)",
  "--color-success": "var(--success)",
  "--color-review": "var(--warning)",
  "--color-error": "var(--danger)",
  "--color-info": "var(--signal-function)",
  "--color-backdrop": "rgb(0 0 0 / 56%)",
} as const;

export const CONTROL_PLANE_THEMES: ControlPlaneThemeDefinition[] = [
  {
    id: "graphite-signal",
    label: "Graphite Signal",
    description: "Mineral graphite surfaces with monospaced type and semantic system signals.",
    codeThemeId: "graphite-signal",
    variant: "dark",
    theme: {
      accent: "#74B98B",
      contrast: 72,
      fonts: {
        code: GRAPHITE_SIGNAL_FONT,
        ui: GRAPHITE_SIGNAL_FONT,
      },
      ink: "#E7ECE8",
      opaqueWindows: true,
      tokens: {
        canvas: "#111513",
        surface1: "#181C1A",
        surface2: "#202522",
        surface3: "#2B312D",
        hairline: "rgba(118, 129, 122, 0.30)",
        hairlineSoft: "rgba(118, 129, 122, 0.17)",
        inkMuted: "#AAB4AD",
        inkSubtle: "#76817A",
        onPrimary: "#111513",
        signalKeyword: "#9478C0",
        signalNumber: "#C7A45C",
        signalType: "#499E95",
        signalFunction: "#5E86B7",
        signalAttention: "#BB6677",
      },
      semanticColors: {
        diffAdded: "#5CAA76",
        diffRemoved: "#C36F56",
        skill: "#9478C0",
      },
      surface: "#111513",
    },
  },
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
  const { accent, contrast, fonts, ink, opaqueWindows, semanticColors, surface, tokens } = themeDefinition.theme;

  if (tokens) {
    return {
      ...CONTROL_PLANE_FOUNDATION_TOKENS,
      ...CONTROL_PLANE_SEMANTIC_ALIASES,
      "--font-sans": fonts.ui ?? DEFAULT_UI_FONT,
      "--font-mono": fonts.code ?? DEFAULT_CODE_FONT,
      "--background": tokens.canvas,
      "--surface1": tokens.surface1,
      "--surface2": tokens.surface2,
      "--surface3": tokens.surface3,
      "--surface-inset": tokens.surface1,
      "--border": tokens.hairlineSoft,
      "--border-visible": tokens.hairline,
      "--text1": ink,
      "--text2": tokens.inkMuted,
      "--text3": tokens.inkSubtle,
      "--accent": accent,
      "--accent-soft": alpha(accent, 0.18),
      "--accent-contrast": tokens.onPrimary,
      "--success": semanticColors.diffAdded,
      "--success-bg": alpha(semanticColors.diffAdded, 0.16),
      "--success-border": alpha(semanticColors.diffAdded, 0.28),
      "--warning": tokens.signalNumber,
      "--warning-bg": alpha(tokens.signalNumber, 0.18),
      "--warning-border": alpha(tokens.signalNumber, 0.28),
      "--danger": semanticColors.diffRemoved,
      "--danger-bg": alpha(semanticColors.diffRemoved, 0.16),
      "--danger-border": alpha(semanticColors.diffRemoved, 0.28),
      "--skill-accent": tokens.signalKeyword,
      "--signal-keyword": tokens.signalKeyword,
      "--signal-number": tokens.signalNumber,
      "--signal-type": tokens.signalType,
      "--signal-function": tokens.signalFunction,
      "--signal-string": semanticColors.diffAdded,
      "--signal-attention": tokens.signalAttention,
      "--radius-xs": "2px",
      "--radius-sm": "2px",
      "--radius-md": "4px",
      "--radius-elevated": "6px",
      "--radius": "4px",
      "--shadow-1": "none",
      "--shadow-2": "none",
      "--code-bg": tokens.surface1,
      "--code-border": tokens.hairline,
      "--code-text": ink,
    };
  }

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
    ...CONTROL_PLANE_FOUNDATION_TOKENS,
    ...CONTROL_PLANE_SEMANTIC_ALIASES,
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
    "--signal-keyword": semanticColors.skill,
    "--signal-number": warning,
    "--signal-type": accent,
    "--signal-function": accent,
    "--signal-string": semanticColors.diffAdded,
    "--signal-attention": warning,
    "--radius-xs": "2px",
    "--radius-sm": "2px",
    "--radius-md": "4px",
    "--radius-elevated": "6px",
    "--radius": "4px",
    "--shadow-1": "none",
    "--shadow-2": "none",
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

export function buildThemeBootstrapScript(): string {
  const presets = Object.fromEntries(CONTROL_PLANE_THEMES.map((theme) => [
    theme.id,
    {
      codeThemeId: theme.codeThemeId,
      id: theme.id,
      variables: buildThemeCssVariables(theme),
      variant: theme.variant,
    },
  ]));
  const serializedPresets = JSON.stringify(presets).replaceAll("<", "\\u003c");
  const serializedStorageKey = JSON.stringify(THEME_STORAGE_KEY);

  return `(()=>{try{const presets=${serializedPresets};const saved=localStorage.getItem(${serializedStorageKey});const theme=saved?presets[saved]:null;if(!theme)return;const root=document.documentElement;root.dataset.themeId=theme.codeThemeId;root.dataset.themeVariant=theme.variant;root.dataset.themePreset=theme.id;for(const [name,value] of Object.entries(theme.variables)){root.style.setProperty(name,value)}}catch{}})();`;
}

export function buildThemeSwatch(themeDefinition: ControlPlaneThemeDefinition): string {
  return themeDefinition.theme.surface;
}
