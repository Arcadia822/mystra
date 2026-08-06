export type ThemeVariant = "light" | "dark";
export type ThemeMode = "system" | ThemeVariant;
export type ThemeBorderMode = "default" | "high-contrast" | "color-high-contrast";

export interface AppearancePreferences {
  version: 1;
  mode: ThemeMode;
  lightThemeId: string;
  darkThemeId: string;
  borderMode: ThemeBorderMode;
  codeSurfaceVariant: ThemeVariant;
  contrast: number;
  uiFont: string | null;
  chatFont: string | null;
  codeFont: string | null;
  uiFontSize: number;
  chatFontSize: number;
}

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
export const APPEARANCE_STORAGE_KEY = "mystra-control-plane-appearance-v1";

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

export function getThemesByVariant(variant: ThemeVariant): ControlPlaneThemeDefinition[] {
  return CONTROL_PLANE_THEMES.filter((theme) => theme.variant === variant);
}

export function getDefaultAppearancePreferences(): AppearancePreferences {
  return {
    version: 1,
    mode: "system",
    lightThemeId: getThemesByVariant("light")[0]?.id ?? getDefaultTheme().id,
    darkThemeId: getThemesByVariant("dark")[0]?.id ?? getDefaultTheme().id,
    borderMode: "default",
    codeSurfaceVariant: "dark",
    contrast: getDefaultTheme().theme.contrast,
    uiFont: getDefaultTheme().theme.fonts.ui,
    chatFont: getDefaultTheme().theme.fonts.ui,
    codeFont: getDefaultTheme().theme.fonts.code,
    uiFontSize: 12,
    chatFontSize: 12,
  };
}

function normalizeOptionalFont(value: unknown, fallback: string | null): string | null {
  if (typeof value !== "string") return fallback;
  return value.trim() || null;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

export function normalizeAppearancePreferences(value: unknown): AppearancePreferences {
  const defaults = getDefaultAppearancePreferences();
  if (!value || typeof value !== "object") return defaults;
  const input = value as Record<string, unknown>;
  const lightTheme = typeof input.lightThemeId === "string" ? getThemeById(input.lightThemeId) : undefined;
  const darkTheme = typeof input.darkThemeId === "string" ? getThemeById(input.darkThemeId) : undefined;
  const mode = input.mode === "system" || input.mode === "light" || input.mode === "dark" ? input.mode : defaults.mode;
  const borderMode = input.borderMode === "default" || input.borderMode === "high-contrast" || input.borderMode === "color-high-contrast"
    ? input.borderMode
    : defaults.borderMode;
  const codeSurfaceVariant = input.codeSurfaceVariant === "light" || input.codeSurfaceVariant === "dark"
    ? input.codeSurfaceVariant
    : defaults.codeSurfaceVariant;

  return {
    version: 1,
    mode,
    lightThemeId: lightTheme?.variant === "light" ? lightTheme.id : defaults.lightThemeId,
    darkThemeId: darkTheme?.variant === "dark" ? darkTheme.id : defaults.darkThemeId,
    borderMode,
    codeSurfaceVariant,
    contrast: normalizeNumber(input.contrast, defaults.contrast, 0, 100),
    uiFont: normalizeOptionalFont(input.uiFont, defaults.uiFont),
    chatFont: normalizeOptionalFont(input.chatFont, defaults.chatFont),
    codeFont: normalizeOptionalFont(input.codeFont, defaults.codeFont),
    uiFontSize: normalizeNumber(input.uiFontSize, defaults.uiFontSize, 12, 14),
    chatFontSize: normalizeNumber(input.chatFontSize, defaults.chatFontSize, 12, 16),
  };
}

export function parseAppearancePreferences(value: string | null): AppearancePreferences {
  if (!value) return getDefaultAppearancePreferences();
  try {
    return normalizeAppearancePreferences(JSON.parse(value));
  } catch {
    return getDefaultAppearancePreferences();
  }
}

export function resolveAppearanceVariant(preferences: AppearancePreferences, systemVariant: ThemeVariant): ThemeVariant {
  return preferences.mode === "system" ? systemVariant : preferences.mode;
}

export function resolveAppearanceTheme(
  preferences: AppearancePreferences,
  systemVariant: ThemeVariant,
): ControlPlaneThemeDefinition {
  const variant = resolveAppearanceVariant(preferences, systemVariant);
  const selected = getThemeById(variant === "light" ? preferences.lightThemeId : preferences.darkThemeId);
  return selected?.variant === variant ? selected : getThemesByVariant(variant)[0] ?? getDefaultTheme();
}

export function getAppearanceDetailDefaults(
  preferences: AppearancePreferences,
  systemVariant: ThemeVariant,
): Pick<AppearancePreferences, "contrast" | "uiFont" | "chatFont" | "codeFont" | "uiFontSize" | "chatFontSize"> {
  const theme = resolveAppearanceTheme(preferences, systemVariant);
  return {
    contrast: theme.theme.contrast,
    uiFont: theme.theme.fonts.ui,
    chatFont: theme.theme.fonts.ui,
    codeFont: theme.theme.fonts.code,
    uiFontSize: 12,
    chatFontSize: 12,
  };
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

export function buildAppearanceCssVariables(
  preferences: AppearancePreferences,
  systemVariant: ThemeVariant,
): Record<string, string> {
  const normalized = normalizeAppearancePreferences(preferences);
  const theme = resolveAppearanceTheme(normalized, systemVariant);
  const variables = buildThemeCssVariables(theme);
  const depth = normalized.contrast / 100;
  const surface = theme.theme.tokens?.canvas ?? theme.theme.surface;
  const ink = theme.theme.ink;
  const borderInk = normalized.borderMode === "color-high-contrast" ? theme.theme.accent : ink;
  const baseWeight = theme.variant === "light" ? 0.1 : 0.16;
  const contrastBoost = normalized.borderMode === "default" ? 0 : normalized.borderMode === "high-contrast" ? 0.16 : 0.12;
  variables["--surface3"] = mix(surface, ink, baseWeight * 0.45 + depth * 0.12);
  variables["--border"] = mix(surface, borderInk, baseWeight + depth * 0.12 + contrastBoost * 0.55);
  variables["--border-visible"] = mix(surface, borderInk, baseWeight + 0.08 + depth * 0.2 + contrastBoost);
  variables["--font-sans"] = normalized.uiFont ?? DEFAULT_UI_FONT;
  variables["--font-chat"] = normalized.chatFont ?? normalized.uiFont ?? DEFAULT_UI_FONT;
  variables["--font-mono"] = normalized.codeFont ?? DEFAULT_CODE_FONT;
  variables["--font-size-ui"] = `${normalized.uiFontSize}px`;
  variables["--font-size-chat"] = `${normalized.chatFontSize}px`;
  if (normalized.codeSurfaceVariant === "light") {
    variables["--code-bg"] = "#f7f8fa";
    variables["--code-border"] = "#c7ccd4";
    variables["--code-text"] = "#20242b";
  } else {
    variables["--code-bg"] = "#15191f";
    variables["--code-border"] = "#3a424d";
    variables["--code-text"] = "#e2e7ee";
  }
  return variables;
}

export function applyAppearanceToDocument(preferences: AppearancePreferences, systemVariant: ThemeVariant): void {
  const normalized = normalizeAppearancePreferences(preferences);
  const theme = resolveAppearanceTheme(normalized, systemVariant);
  const root = document.documentElement;
  root.dataset.themeId = theme.codeThemeId;
  root.dataset.themeVariant = theme.variant;
  root.dataset.themePreset = theme.id;
  root.dataset.borderMode = normalized.borderMode;
  root.dataset.codeSurface = normalized.codeSurfaceVariant;
  for (const [name, value] of Object.entries(buildAppearanceCssVariables(normalized, systemVariant))) {
    root.style.setProperty(name, value);
  }
}

export function buildThemeBootstrapScript(): string {
  const presets = Object.fromEntries(CONTROL_PLANE_THEMES.map((theme) => [
    theme.id,
    {
      codeThemeId: theme.codeThemeId,
      id: theme.id,
      accent: theme.theme.accent,
      ink: theme.theme.ink,
      surface: theme.theme.tokens?.canvas ?? theme.theme.surface,
      variables: buildThemeCssVariables(theme),
      variant: theme.variant,
    },
  ]));
  const serializedPresets = JSON.stringify(presets).replaceAll("<", "\\u003c");
  const serializedDefaults = JSON.stringify(getDefaultAppearancePreferences()).replaceAll("<", "\\u003c");
  const serializedAppearanceKey = JSON.stringify(APPEARANCE_STORAGE_KEY);
  const serializedStorageKey = JSON.stringify(THEME_STORAGE_KEY);

  return `(()=>{try{const presets=${serializedPresets};const defaults=${serializedDefaults};let input={};try{input=JSON.parse(localStorage.getItem(${serializedAppearanceKey})||"{}")}catch{}const legacy=localStorage.getItem(${serializedStorageKey});if(legacy&&presets[legacy]&&!localStorage.getItem(${serializedAppearanceKey})){input={...defaults,mode:presets[legacy].variant,[presets[legacy].variant+"ThemeId"]:legacy}}const valid=(id,variant)=>presets[id]?.variant===variant?id:defaults[variant+"ThemeId"];const mode=["system","light","dark"].includes(input.mode)?input.mode:defaults.mode;const borderMode=["default","high-contrast","color-high-contrast"].includes(input.borderMode)?input.borderMode:defaults.borderMode;const codeSurfaceVariant=["light","dark"].includes(input.codeSurfaceVariant)?input.codeSurfaceVariant:defaults.codeSurfaceVariant;const number=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;const font=(value,fallback)=>typeof value==="string"?(value.trim()||null):fallback;const preferences={...defaults,mode,lightThemeId:valid(input.lightThemeId,"light"),darkThemeId:valid(input.darkThemeId,"dark"),borderMode,codeSurfaceVariant,contrast:number(input.contrast,defaults.contrast,0,100),uiFont:font(input.uiFont,defaults.uiFont),chatFont:font(input.chatFont,defaults.chatFont),codeFont:font(input.codeFont,defaults.codeFont),uiFontSize:number(input.uiFontSize,defaults.uiFontSize,12,14),chatFontSize:number(input.chatFontSize,defaults.chatFontSize,12,16)};const system=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";const variant=preferences.mode==="system"?system:preferences.mode;const theme=presets[preferences[variant+"ThemeId"]]||presets[defaults[variant+"ThemeId"]];const variables={...theme.variables};const depth=preferences.contrast/100;const hex=(value)=>{const raw=value.replace("#","");const parsed=parseInt(raw,16);return[(parsed>>16)&255,(parsed>>8)&255,parsed&255]};const mix=(a,b,w)=>{const x=hex(a),y=hex(b),c=x.map((v,i)=>Math.round(v+(y[i]-v)*Math.min(1,Math.max(0,w))).toString(16).padStart(2,"0"));return"#"+c.join("")};const borderInk=preferences.borderMode==="color-high-contrast"?theme.accent:theme.ink;const base=variant==="light"?.1:.16;const boost=preferences.borderMode==="default"?0:preferences.borderMode==="high-contrast"?.16:.12;variables["--surface3"]=mix(theme.surface,theme.ink,base*.45+depth*.12);variables["--border"]=mix(theme.surface,borderInk,base+depth*.12+boost*.55);variables["--border-visible"]=mix(theme.surface,borderInk,base+.08+depth*.2+boost);variables["--font-sans"]=preferences.uiFont||variables["--font-sans"];variables["--font-chat"]=preferences.chatFont||preferences.uiFont||variables["--font-sans"];variables["--font-mono"]=preferences.codeFont||variables["--font-mono"];variables["--font-size-ui"]=preferences.uiFontSize+"px";variables["--font-size-chat"]=preferences.chatFontSize+"px";if(preferences.codeSurfaceVariant==="light"){variables["--code-bg"]="#f7f8fa";variables["--code-border"]="#c7ccd4";variables["--code-text"]="#20242b"}else{variables["--code-bg"]="#15191f";variables["--code-border"]="#3a424d";variables["--code-text"]="#e2e7ee"}const root=document.documentElement;root.dataset.themeId=theme.codeThemeId;root.dataset.themeVariant=theme.variant;root.dataset.themePreset=theme.id;root.dataset.borderMode=preferences.borderMode;root.dataset.codeSurface=preferences.codeSurfaceVariant;for(const [name,value] of Object.entries(variables)){root.style.setProperty(name,value)}}catch{}})();`;
}

export function buildThemeSwatch(themeDefinition: ControlPlaneThemeDefinition): string {
  return themeDefinition.theme.surface;
}
