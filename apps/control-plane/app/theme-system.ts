import { CODEX_APP_THEME_CATALOG, CODEX_APP_THEME_SOURCE_VERSION } from "./codex-theme-catalog";

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
  contentFont: string | null;
  codeFont: string | null;
  uiFontSize: number;
  contentFontSize: number;
}

export interface ExplicitThemeTokens {
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

export const CODEX_THEME_SCHEMA_VERSION = "codex-theme-v1" as const;

export interface CodexThemeV1Payload {
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

export interface ControlPlaneThemeDefinition extends CodexThemeV1Payload {
  label: string;
  description: string;
  fontRoles: ThemeFontRoles;
  tokens?: ExplicitThemeTokens;
}

export interface ThemeFontRoles {
  ui: string | null;
  content: string | null;
  code: string | null;
}

const CODEX_THEME_PAYLOAD_KEYS = ["codeThemeId", "theme", "variant"] as const;
const CODEX_THEME_VALUE_KEYS = ["accent", "contrast", "fonts", "ink", "opaqueWindows", "semanticColors", "surface"] as const;
const CODEX_THEME_FONT_KEYS = ["code", "ui"] as const;
const CODEX_THEME_SEMANTIC_COLOR_KEYS = ["diffAdded", "diffRemoved", "skill"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCodexHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function isOptionalFont(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function parseCodexThemeV1(serializedTheme: string): CodexThemeV1Payload {
  const separatorIndex = serializedTheme.indexOf(":");
  const schemaVersion = separatorIndex >= 0 ? serializedTheme.slice(0, separatorIndex) : serializedTheme;
  if (schemaVersion !== CODEX_THEME_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported Codex theme schema version: ${schemaVersion || "missing"}.`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(serializedTheme.slice(separatorIndex + 1));
  } catch {
    throw new TypeError("Invalid Codex theme v1 JSON payload.");
  }

  if (!isRecord(payload) || !hasExactKeys(payload, CODEX_THEME_PAYLOAD_KEYS)) {
    throw new TypeError("Invalid Codex theme v1 payload.");
  }
  const theme = payload.theme;
  if (!isRecord(theme) || !hasExactKeys(theme, CODEX_THEME_VALUE_KEYS)) {
    throw new TypeError("Invalid Codex theme v1 theme payload.");
  }
  const fonts = theme.fonts;
  const semanticColors = theme.semanticColors;
  if (!isRecord(fonts) || !hasExactKeys(fonts, CODEX_THEME_FONT_KEYS)
    || !isOptionalFont(fonts.code) || !isOptionalFont(fonts.ui)) {
    throw new TypeError("Invalid Codex theme v1 font payload.");
  }
  if (!isRecord(semanticColors) || !hasExactKeys(semanticColors, CODEX_THEME_SEMANTIC_COLOR_KEYS)
    || !isCodexHexColor(semanticColors.diffAdded)
    || !isCodexHexColor(semanticColors.diffRemoved)
    || !isCodexHexColor(semanticColors.skill)) {
    throw new TypeError("Invalid Codex theme v1 semantic color payload.");
  }
  if (!isNonEmptyString(payload.codeThemeId)
    || (payload.variant !== "light" && payload.variant !== "dark")
    || !isCodexHexColor(theme.accent)
    || typeof theme.contrast !== "number"
    || !Number.isFinite(theme.contrast)
    || theme.contrast < 0
    || theme.contrast > 100
    || !isCodexHexColor(theme.ink)
    || typeof theme.opaqueWindows !== "boolean"
    || !isCodexHexColor(theme.surface)) {
    throw new TypeError("Invalid Codex theme v1 payload values.");
  }

  return {
    codeThemeId: payload.codeThemeId,
    theme: {
      accent: theme.accent,
      contrast: theme.contrast,
      fonts: { code: fonts.code, ui: fonts.ui },
      ink: theme.ink,
      opaqueWindows: theme.opaqueWindows,
      semanticColors: {
        diffAdded: semanticColors.diffAdded,
        diffRemoved: semanticColors.diffRemoved,
        skill: semanticColors.skill,
      },
      surface: theme.surface,
    },
    variant: payload.variant,
  };
}

export function serializeCodexThemeV1(theme: CodexThemeV1Payload): string {
  const payload: CodexThemeV1Payload = {
    codeThemeId: theme.codeThemeId,
    theme: {
      accent: theme.theme.accent,
      contrast: theme.theme.contrast,
      fonts: { code: theme.theme.fonts.code, ui: theme.theme.fonts.ui },
      ink: theme.theme.ink,
      opaqueWindows: theme.theme.opaqueWindows,
      semanticColors: {
        diffAdded: theme.theme.semanticColors.diffAdded,
        diffRemoved: theme.theme.semanticColors.diffRemoved,
        skill: theme.theme.semanticColors.skill,
      },
      surface: theme.theme.surface,
    },
    variant: theme.variant,
  };
  const serializedTheme = `${CODEX_THEME_SCHEMA_VERSION}:${JSON.stringify(payload)}`;
  parseCodexThemeV1(serializedTheme);
  return serializedTheme;
}

export function createControlPlaneThemeDefinition(
  serializedTheme: string,
  metadata: Partial<Pick<ControlPlaneThemeDefinition, "label" | "description" | "fontRoles" | "tokens">> = {},
): ControlPlaneThemeDefinition {
  const theme = parseCodexThemeV1(serializedTheme);
  const uiFont = primaryFontFamily(theme.theme.fonts.ui);
  return {
    ...theme,
    label: metadata.label ?? theme.codeThemeId,
    description: metadata.description ?? "",
    fontRoles: metadata.fontRoles ?? {
      ui: uiFont,
      content: MYSTRA_CONTENT_FONT,
      code: primaryFontFamily(theme.theme.fonts.code),
    },
    ...(metadata.tokens ? { tokens: metadata.tokens } : {}),
  };
}

const LEGACY_GRAPHITE_SIGNAL_FONT =
  '"Fira Code", "Maple Mono", ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, monospace';
const MYSTRA_UI_FONT = "Arial";
const MYSTRA_CONTENT_FONT = "Arial";
const MYSTRA_CODE_FONT = "Courier New";
const DEFAULT_FONT_ROLES: ThemeFontRoles = {
  ui: MYSTRA_UI_FONT,
  content: MYSTRA_CONTENT_FONT,
  code: MYSTRA_CODE_FONT,
};

const FONT_ROLE_FALLBACKS = {
  ui: "system-ui, sans-serif",
  content: "system-ui, sans-serif",
  code: "ui-monospace, monospace",
} as const;

function primaryFontFamily(value: string | null): string | null {
  if (!value) return null;
  let quote: '"' | "'" | null = null;
  let end = value.length;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? null : character;
    } else if (character === "," && !quote) {
      end = index;
      break;
    }
  }
  const candidate = value.slice(0, end).trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return candidate && /^[\p{L}\p{N} ._-]+$/u.test(candidate) ? candidate : null;
}

function cssFontFamilyName(value: string): string {
  return /^[\p{L}\p{N}_-]+$/u.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

function buildFontStack(value: string | null, role: keyof ThemeFontRoles): string {
  const primary = primaryFontFamily(value) ?? DEFAULT_FONT_ROLES[role];
  return primary ? `${cssFontFamilyName(primary)}, ${FONT_ROLE_FALLBACKS[role]}` : FONT_ROLE_FALLBACKS[role];
}

function buildFontRoleVariables(fontRoles: ThemeFontRoles): Record<string, string> {
  return {
    "--font-ui": buildFontStack(fontRoles.ui, "ui"),
    "--font-content": buildFontStack(fontRoles.content, "content"),
    "--font-code": buildFontStack(fontRoles.code, "code"),
    "--font-sans": "var(--font-ui)",
    "--font-chat": "var(--font-content)",
    "--font-mono": "var(--font-code)",
  };
}

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
  "--composer-inset-top": "8px",
  "--composer-inset-right": "8px",
  "--composer-inset-bottom": "8px",
  "--composer-inset-left": "8px",
  "--sidebar-width-expanded": "300px",
  "--shell-header-height": "42px",
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

const MYSTRA_THEMES: ControlPlaneThemeDefinition[] = [
  createControlPlaneThemeDefinition(
    'codex-theme-v1:{"codeThemeId":"mystra","theme":{"accent":"#74B98B","contrast":72,"fonts":{"code":"Courier New","ui":"Arial"},"ink":"#E7ECE8","opaqueWindows":true,"semanticColors":{"diffAdded":"#5CAA76","diffRemoved":"#C36F56","skill":"#9478C0"},"surface":"#111513"},"variant":"dark"}',
    {
      label: "Mystra",
      description: "Mystra's dark mineral graphite theme with restrained semantic signals.",
      fontRoles: { ui: MYSTRA_UI_FONT, content: MYSTRA_CONTENT_FONT, code: MYSTRA_CODE_FONT },
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
    },
  ),
  createControlPlaneThemeDefinition(
    'codex-theme-v1:{"codeThemeId":"mystra","theme":{"accent":"#347B50","contrast":52,"fonts":{"code":"Courier New","ui":"Arial"},"ink":"#202722","opaqueWindows":true,"semanticColors":{"diffAdded":"#347B50","diffRemoved":"#A64F3D","skill":"#7255A3"},"surface":"#F5F7F5"},"variant":"light"}',
    {
      label: "Mystra",
      description: "Mystra's light mineral graphite theme with the same semantic signal hierarchy.",
      fontRoles: { ui: MYSTRA_UI_FONT, content: MYSTRA_CONTENT_FONT, code: MYSTRA_CODE_FONT },
      tokens: {
        canvas: "#F5F7F5",
        surface1: "#FFFFFF",
        surface2: "#E9EEEB",
        surface3: "#DDE5E0",
        hairline: "rgba(63, 77, 68, 0.28)",
        hairlineSoft: "rgba(63, 77, 68, 0.16)",
        inkMuted: "#59675E",
        inkSubtle: "#7B887F",
        onPrimary: "#FFFFFF",
        signalKeyword: "#7255A3",
        signalNumber: "#956F26",
        signalType: "#277E76",
        signalFunction: "#3F6F9E",
        signalAttention: "#A64F3D",
      },
    },
  ),
];

export const CONTROL_PLANE_THEMES: ControlPlaneThemeDefinition[] = [
  ...MYSTRA_THEMES,
  ...CODEX_APP_THEME_CATALOG.map(({ label, ...theme }) => createControlPlaneThemeDefinition(
    serializeCodexThemeV1(theme),
    {
      label,
      description: `Built into Codex ${CODEX_APP_THEME_SOURCE_VERSION} (${theme.variant}).`,
    },
  )),
];

const LEGACY_THEME_IDS: Record<ThemeVariant, Record<string, string>> = {
  light: {
    "notion-light": "notion",
    "linen-light": "notion",
  },
  dark: {
    "graphite-signal": "mystra",
    "notion-dark": "notion",
  },
};

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

const DERIVED_HIGH_CONTRAST_BORDER_WEIGHT = 0.72;

export function derivedHighContrastBorder(surface: string, ink: string): string {
  return mix(surface, ink, DERIVED_HIGH_CONTRAST_BORDER_WEIGHT);
}

export function derivedColorBorder(surface: string, color: string): string {
  return mix(surface, color, DERIVED_HIGH_CONTRAST_BORDER_WEIGHT);
}

export function deriveBorderTokens(
  themeDefinition: ControlPlaneThemeDefinition,
  borderMode: ThemeBorderMode,
): Record<string, string> {
  if (borderMode === "default") return {};

  const surface = themeDefinition.tokens?.canvas ?? themeDefinition.theme.surface;
  const { accent, ink, semanticColors } = themeDefinition.theme;
  const warning = themeDefinition.tokens?.signalNumber ?? mix(semanticColors.diffRemoved, accent, 0.55);
  if (borderMode === "high-contrast") {
    const edge = derivedHighContrastBorder(surface, ink);
    return {
      "--border": edge,
      "--border-visible": edge,
      "--code-border": edge,
      "--success-border": edge,
      "--warning-border": edge,
      "--danger-border": edge,
      "--color-focus": edge,
    };
  }

  return {
    "--border": derivedColorBorder(surface, accent),
    "--border-visible": derivedColorBorder(surface, accent),
    "--code-border": derivedColorBorder(surface, semanticColors.skill),
    "--success-border": derivedColorBorder(surface, semanticColors.diffAdded),
    "--warning-border": derivedColorBorder(surface, warning),
    "--danger-border": derivedColorBorder(surface, semanticColors.diffRemoved),
    "--color-focus": derivedColorBorder(surface, accent),
  };
}

export function getThemeById(themeId: string, variant?: ThemeVariant): ControlPlaneThemeDefinition | undefined {
  if (variant) {
    const codeThemeId = LEGACY_THEME_IDS[variant][themeId] ?? themeId;
    return CONTROL_PLANE_THEMES.find((theme) => theme.codeThemeId === codeThemeId && theme.variant === variant);
  }

  const canonicalTheme = CONTROL_PLANE_THEMES.find((theme) => theme.codeThemeId === themeId);
  if (canonicalTheme) return canonicalTheme;

  for (const legacyVariant of ["light", "dark"] as const) {
    const codeThemeId = LEGACY_THEME_IDS[legacyVariant][themeId];
    if (codeThemeId) return getThemeById(codeThemeId, legacyVariant);
  }

  return undefined;
}

export function getThemesByVariant(variant: ThemeVariant): ControlPlaneThemeDefinition[] {
  return CONTROL_PLANE_THEMES
    .filter((theme) => theme.variant === variant)
    .sort((left, right) => {
      if (left.codeThemeId === "mystra") return -1;
      if (right.codeThemeId === "mystra") return 1;
      return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
    });
}

export function getDefaultAppearancePreferences(): AppearancePreferences {
  return {
    version: 1,
    mode: "system",
    lightThemeId: getThemeById("mystra", "light")?.codeThemeId ?? getThemesByVariant("light")[0]?.codeThemeId ?? getDefaultTheme().codeThemeId,
    darkThemeId: getThemeById("mystra", "dark")?.codeThemeId ?? getThemesByVariant("dark")[0]?.codeThemeId ?? getDefaultTheme().codeThemeId,
    borderMode: "default",
    codeSurfaceVariant: "dark",
    contrast: getDefaultTheme().theme.contrast,
    uiFont: getDefaultTheme().fontRoles.ui,
    contentFont: getDefaultTheme().fontRoles.content,
    codeFont: getDefaultTheme().fontRoles.code,
    uiFontSize: 12,
    contentFontSize: 12,
  };
}

function normalizeOptionalFont(value: unknown, fallback: string | null): string | null {
  if (typeof value !== "string") return fallback;
  if (value.trim() === LEGACY_GRAPHITE_SIGNAL_FONT) return fallback;
  return primaryFontFamily(value);
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

export function normalizeAppearancePreferences(value: unknown): AppearancePreferences {
  const defaults = getDefaultAppearancePreferences();
  if (!value || typeof value !== "object") return defaults;
  const input = value as Record<string, unknown>;
  const lightTheme = typeof input.lightThemeId === "string" ? getThemeById(input.lightThemeId, "light") : undefined;
  const darkTheme = typeof input.darkThemeId === "string" ? getThemeById(input.darkThemeId, "dark") : undefined;
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
    lightThemeId: lightTheme?.codeThemeId ?? defaults.lightThemeId,
    darkThemeId: darkTheme?.codeThemeId ?? defaults.darkThemeId,
    borderMode,
    codeSurfaceVariant,
    contrast: normalizeNumber(input.contrast, defaults.contrast, 0, 100),
    uiFont: normalizeOptionalFont(input.uiFont, defaults.uiFont),
    contentFont: normalizeOptionalFont(input.contentFont ?? input.chatFont, defaults.contentFont),
    codeFont: normalizeOptionalFont(input.codeFont, defaults.codeFont),
    uiFontSize: normalizeNumber(input.uiFontSize, defaults.uiFontSize, 12, 14),
    contentFontSize: normalizeNumber(input.contentFontSize ?? input.chatFontSize, defaults.contentFontSize, 12, 16),
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
  const selected = getThemeById(variant === "light" ? preferences.lightThemeId : preferences.darkThemeId, variant);
  return selected ?? getThemesByVariant(variant)[0] ?? getDefaultTheme();
}

export function getAppearanceDetailDefaults(
  preferences: AppearancePreferences,
  systemVariant: ThemeVariant,
): Pick<AppearancePreferences, "contrast" | "uiFont" | "contentFont" | "codeFont" | "uiFontSize" | "contentFontSize"> {
  const theme = resolveAppearanceTheme(preferences, systemVariant);
  return {
    contrast: theme.theme.contrast,
    uiFont: theme.fontRoles.ui,
    contentFont: theme.fontRoles.content,
    codeFont: theme.fontRoles.code,
    uiFontSize: 12,
    contentFontSize: 12,
  };
}

export function buildThemeCssVariables(themeDefinition: ControlPlaneThemeDefinition): Record<string, string> {
  const { accent, contrast, ink, semanticColors, surface } = themeDefinition.theme;
  const { tokens } = themeDefinition;
  const fontVariables = buildFontRoleVariables(themeDefinition.fontRoles);

  if (tokens) {
    return {
      ...CONTROL_PLANE_FOUNDATION_TOKENS,
      ...CONTROL_PLANE_SEMANTIC_ALIASES,
      ...fontVariables,
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
  const surface1 = surface;
  const surface2 = mix(surface, themeDefinition.variant === "light" ? "#ffffff" : "#000000", themeDefinition.variant === "light" ? 0.02 : 0.06);
  const surface3 = mix(surface, ink, themeDefinition.variant === "light" ? 0.06 + depth * 0.08 : 0.12 + depth * 0.12);
  const surfaceInset = mix(surface, ink, themeDefinition.variant === "light" ? 0.05 : 0.1);
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
    ...fontVariables,
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
  root.dataset.themePreset = themeDefinition.codeThemeId;

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
  const surface = theme.tokens?.canvas ?? theme.theme.surface;
  const ink = theme.theme.ink;
  const borderInk = normalized.borderMode === "color-high-contrast" ? theme.theme.accent : ink;
  const baseWeight = theme.variant === "light" ? 0.1 : 0.16;
  const contrastBoost = normalized.borderMode === "default" ? 0 : normalized.borderMode === "high-contrast" ? 0.16 : 0.12;
  variables["--surface3"] = mix(surface, ink, baseWeight * 0.45 + depth * 0.12);
  variables["--border"] = mix(surface, borderInk, baseWeight + depth * 0.12 + contrastBoost * 0.55);
  variables["--border-visible"] = mix(surface, borderInk, baseWeight + 0.08 + depth * 0.2 + contrastBoost);
  variables["--font-ui"] = buildFontStack(normalized.uiFont, "ui");
  variables["--font-content"] = buildFontStack(normalized.contentFont, "content");
  variables["--font-code"] = buildFontStack(normalized.codeFont, "code");
  variables["--font-sans"] = "var(--font-ui)";
  variables["--font-chat"] = "var(--font-content)";
  variables["--font-mono"] = "var(--font-code)";
  variables["--font-size-ui"] = `${normalized.uiFontSize}px`;
  variables["--font-size-content"] = `${normalized.contentFontSize}px`;
  variables["--font-size-chat"] = "var(--font-size-content)";
  if (normalized.codeSurfaceVariant === "light") {
    variables["--code-bg"] = "#f7f8fa";
    variables["--code-border"] = "#c7ccd4";
    variables["--code-text"] = "#20242b";
  } else {
    variables["--code-bg"] = "#15191f";
    variables["--code-border"] = "#3a424d";
    variables["--code-text"] = "#e2e7ee";
  }
  Object.assign(variables, deriveBorderTokens(theme, normalized.borderMode));
  return variables;
}

export function applyAppearanceToDocument(preferences: AppearancePreferences, systemVariant: ThemeVariant): void {
  const normalized = normalizeAppearancePreferences(preferences);
  const theme = resolveAppearanceTheme(normalized, systemVariant);
  const root = document.documentElement;
  root.dataset.themeId = theme.codeThemeId;
  root.dataset.themeVariant = theme.variant;
  root.dataset.themePreset = theme.codeThemeId;
  root.dataset.borderMode = normalized.borderMode;
  root.dataset.codeSurface = normalized.codeSurfaceVariant;
  for (const [name, value] of Object.entries(buildAppearanceCssVariables(normalized, systemVariant))) {
    root.style.setProperty(name, value);
  }
}

export function buildThemeBootstrapScript(): string {
  const presets = Object.fromEntries(CONTROL_PLANE_THEMES.map((theme) => [
    `${theme.variant}:${theme.codeThemeId}`,
    {
      codeThemeId: theme.codeThemeId,
      accent: theme.theme.accent,
      ink: theme.theme.ink,
      semanticColors: theme.theme.semanticColors,
      surface: theme.tokens?.canvas ?? theme.theme.surface,
      variables: buildThemeCssVariables(theme),
      variant: theme.variant,
    },
  ]));
  const serializedPresets = JSON.stringify(presets).replaceAll("<", "\\u003c");
  const serializedLegacyThemeIds = JSON.stringify(LEGACY_THEME_IDS).replaceAll("<", "\\u003c");
  const serializedDefaults = JSON.stringify(getDefaultAppearancePreferences()).replaceAll("<", "\\u003c");
  const serializedAppearanceKey = JSON.stringify(APPEARANCE_STORAGE_KEY);
  const serializedStorageKey = JSON.stringify(THEME_STORAGE_KEY);
  const serializedLegacyFont = JSON.stringify(LEGACY_GRAPHITE_SIGNAL_FONT);

  return `(()=>{try{
    const presets=${serializedPresets};
    const aliases=${serializedLegacyThemeIds};
    const defaults=${serializedDefaults};
    const legacyFont=${serializedLegacyFont};
    const key=(variant,id)=>variant+":"+id;
    const normalizedId=(id,variant)=>typeof id==="string"?(aliases[variant]?.[id]||id):id;
    const valid=(id,variant)=>{const normalized=normalizedId(id,variant);return presets[key(variant,normalized)]?normalized:defaults[variant+"ThemeId"]};
    let input={};
    try{input=JSON.parse(localStorage.getItem(${serializedAppearanceKey})||"{}")}catch{}
    const legacy=localStorage.getItem(${serializedStorageKey});
    if(legacy&&!localStorage.getItem(${serializedAppearanceKey})){
      const legacyTheme=Object.values(presets).find((theme)=>theme.codeThemeId===legacy||aliases[theme.variant]?.[legacy]===theme.codeThemeId);
      if(legacyTheme)input={...defaults,mode:legacyTheme.variant,[legacyTheme.variant+"ThemeId"]:legacyTheme.codeThemeId};
    }
    const mode=["system","light","dark"].includes(input.mode)?input.mode:defaults.mode;
    const borderMode=["default","high-contrast","color-high-contrast"].includes(input.borderMode)?input.borderMode:defaults.borderMode;
    const codeSurfaceVariant=["light","dark"].includes(input.codeSurfaceVariant)?input.codeSurfaceVariant:defaults.codeSurfaceVariant;
    const number=(value,fallback,min,max)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
    const font=(value,fallback)=>{
      if(typeof value!=="string")return fallback;
      const trimmed=value.trim();
      if(trimmed===legacyFont)return fallback;
      if(!trimmed)return null;
      const first=trimmed.split(",")[0].trim().replace(/^["']|["']$/g,"");
      return first&&/^[A-Za-z0-9 ._-]+$/.test(first)?first:null;
    };
    const fontName=(value)=>/^[A-Za-z0-9_-]+$/.test(value)?value:'"'+value.replaceAll('"','\\\\"')+'"';
    const stack=(value,fallback,generic)=>fontName(value||fallback)+", "+generic;
    const preferences={
      ...defaults,
      mode,
      lightThemeId:valid(input.lightThemeId,"light"),
      darkThemeId:valid(input.darkThemeId,"dark"),
      borderMode,
      codeSurfaceVariant,
      contrast:number(input.contrast,defaults.contrast,0,100),
      uiFont:font(input.uiFont,defaults.uiFont),
      contentFont:font(input.contentFont??input.chatFont,defaults.contentFont),
      codeFont:font(input.codeFont,defaults.codeFont),
      uiFontSize:number(input.uiFontSize,defaults.uiFontSize,12,14),
      contentFontSize:number(input.contentFontSize??input.chatFontSize,defaults.contentFontSize,12,16),
    };
    const system=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
    const variant=preferences.mode==="system"?system:preferences.mode;
    const theme=presets[key(variant,preferences[variant+"ThemeId"])]||presets[key(variant,defaults[variant+"ThemeId"])];
    const variables={...theme.variables};
    const depth=preferences.contrast/100;
    const hex=(value)=>{const raw=value.replace("#","");const parsed=parseInt(raw,16);return[(parsed>>16)&255,(parsed>>8)&255,parsed&255]};
    const mix=(a,b,w)=>{const x=hex(a),y=hex(b),c=x.map((v,i)=>Math.round(v+(y[i]-v)*Math.min(1,Math.max(0,w))).toString(16).padStart(2,"0"));return"#"+c.join("")};
    const base=variant==="light"?.1:.16;
    variables["--surface3"]=mix(theme.surface,theme.ink,base*.45+depth*.12);
    variables["--border"]=mix(theme.surface,theme.ink,base+depth*.12);
    variables["--border-visible"]=mix(theme.surface,theme.ink,base+.08+depth*.2);
    variables["--font-ui"]=stack(preferences.uiFont,defaults.uiFont,"system-ui, sans-serif");
    variables["--font-content"]=stack(preferences.contentFont,defaults.contentFont,"system-ui, sans-serif");
    variables["--font-code"]=stack(preferences.codeFont,defaults.codeFont,"ui-monospace, monospace");
    variables["--font-sans"]="var(--font-ui)";
    variables["--font-chat"]="var(--font-content)";
    variables["--font-mono"]="var(--font-code)";
    variables["--font-size-ui"]=preferences.uiFontSize+"px";
    variables["--font-size-content"]=preferences.contentFontSize+"px";
    variables["--font-size-chat"]="var(--font-size-content)";
    if(preferences.codeSurfaceVariant==="light"){
      variables["--code-bg"]="#f7f8fa";variables["--code-border"]="#c7ccd4";variables["--code-text"]="#20242b";
    }else{
      variables["--code-bg"]="#15191f";variables["--code-border"]="#3a424d";variables["--code-text"]="#e2e7ee";
    }
    if(preferences.borderMode!=="default"){
      if(preferences.borderMode==="high-contrast"){
        const edge=mix(theme.surface,theme.ink,.72);
        variables["--border"]=edge;variables["--border-visible"]=edge;variables["--code-border"]=edge;
        variables["--success-border"]=edge;variables["--warning-border"]=edge;variables["--danger-border"]=edge;
        variables["--color-focus"]=edge;
      }else{
        const edge=(color)=>mix(theme.surface,color,.72);
        variables["--border"]=edge(theme.accent);variables["--border-visible"]=edge(theme.accent);
        variables["--code-border"]=edge(variables["--skill-accent"]);
        variables["--success-border"]=edge(theme.semanticColors.diffAdded);
        variables["--warning-border"]=edge(variables["--warning"]);
        variables["--danger-border"]=edge(theme.semanticColors.diffRemoved);
        variables["--color-focus"]=edge(theme.accent);
      }
    }
    const root=document.documentElement;
    root.dataset.themeId=theme.codeThemeId;
    root.dataset.themeVariant=theme.variant;
    root.dataset.themePreset=theme.codeThemeId;
    root.dataset.borderMode=preferences.borderMode;
    root.dataset.codeSurface=preferences.codeSurfaceVariant;
    for(const [name,value] of Object.entries(variables))root.style.setProperty(name,value);
  }catch{}})();`;
}

export function buildThemeSwatch(themeDefinition: ControlPlaneThemeDefinition): string {
  return themeDefinition.theme.surface;
}
