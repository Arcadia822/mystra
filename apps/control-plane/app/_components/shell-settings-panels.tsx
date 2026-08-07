import type { CSSProperties } from "react";
import type { IntegrationConnectionListResponse } from "@mystra/shared";

import type { AppearancePreferences, ControlPlaneThemeDefinition, ThemeVariant } from "../theme-system";
import { getThemesByVariant } from "../theme-system";
import { SettingGroup, SettingRow } from "./setting-row";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { UiButton } from "./ui-actions";
import { UiDropdown } from "./ui-dropdown";
import { UiInput } from "./ui-fields";
import { UiRange, UiSegmented } from "./ui-preference-controls";

export function AccountSettingsPanel({ locale }: { locale: ShellLocale }) {
  const copy = SHELL_COPY[locale];

  return (
    <SettingGroup aria-label={copy.account}>
      <SettingRow
        control={<span className="settingRowStatus">{copy.accountProfileValue}</span>}
        description={copy.accountProfileDescription}
        title={copy.accountProfile}
      />
      <SettingRow
        control={<span className="settingRowStatus">{copy.settingsUnavailable}</span>}
        description={copy.accountAuthenticationDescription}
        title={copy.accountAuthentication}
      />
    </SettingGroup>
  );
}

export function AppearanceSettingsPanel({
  locale,
  onAppearanceChange,
  onLocaleChange,
  onResetDetails,
  preferences,
  systemVariant,
  theme,
}: {
  locale: ShellLocale;
  onAppearanceChange: (change: Partial<AppearancePreferences>) => void;
  onLocaleChange: (locale: ShellLocale) => void;
  onResetDetails: () => void;
  preferences: AppearancePreferences;
  systemVariant: ThemeVariant;
  theme: ControlPlaneThemeDefinition;
}) {
  const copy = SHELL_COPY[locale];
  const themeOptions = (variant: ThemeVariant) => getThemesByVariant(variant).map((option) => ({
    description: option.description,
    label: option.label,
    value: option.codeThemeId,
  }));
  const lightTheme = getThemesByVariant("light").find((option) => option.codeThemeId === preferences.lightThemeId);
  const darkTheme = getThemesByVariant("dark").find((option) => option.codeThemeId === preferences.darkThemeId);

  return (
    <SettingGroup aria-label={copy.appearance} className="appearanceSettings">
      <SettingRow
        control={(
          <UiDropdown
            align="end"
            aria-label={copy.language}
            className="appearanceDropdown"
            onValueChange={(value) => onLocaleChange(value as ShellLocale)}
            options={[
              { label: copy.languageEnglish, value: "en" },
              { label: copy.languageChinese, value: "zh-CN" },
            ]}
            placeholder={copy.language}
            value={locale}
          />
        )}
        description={copy.languageDescription}
        title={copy.language}
      />
      <SettingRow
        control={<UiSegmented aria-label={copy.themeMode} onValueChange={(mode) => onAppearanceChange({ mode })} options={[
          { label: copy.system, value: "system" },
          { label: copy.light, value: "light" },
          { label: copy.dark, value: "dark" },
        ]} value={preferences.mode} />}
        description={copy.themeModeDescription}
        title={copy.themeMode}
      />
      <SettingRow
        control={<UiDropdown align="end" aria-label={copy.lightTheme} className="appearanceDropdown" icon={<span aria-hidden="true" className="themeInlineSwatch" style={{ "--swatch-ink": lightTheme?.theme.ink, "--swatch-surface": lightTheme?.theme.surface } as CSSProperties}>Aa</span>} onValueChange={(lightThemeId) => onAppearanceChange({ lightThemeId })} options={themeOptions("light")} placeholder={copy.lightTheme} value={preferences.lightThemeId} />}
        description={copy.lightThemeDescription}
        title={copy.lightTheme}
      />
      <SettingRow
        control={<UiDropdown align="end" aria-label={copy.darkTheme} className="appearanceDropdown" icon={<span aria-hidden="true" className="themeInlineSwatch" style={{ "--swatch-ink": darkTheme?.theme.ink, "--swatch-surface": darkTheme?.theme.surface } as CSSProperties}>Aa</span>} onValueChange={(darkThemeId) => onAppearanceChange({ darkThemeId })} options={themeOptions("dark")} placeholder={copy.darkTheme} value={preferences.darkThemeId} />}
        description={copy.darkThemeDescription}
        title={copy.darkTheme}
      />
      <SettingRow
        control={<UiSegmented aria-label={copy.borderMode} onValueChange={(borderMode) => onAppearanceChange({ borderMode })} options={[
          { label: copy.borderDefault, value: "default" },
          { label: copy.borderHighContrast, value: "high-contrast" },
          { label: copy.borderColorHighContrast, value: "color-high-contrast" },
        ]} value={preferences.borderMode} />}
        description={copy.borderModeDescription}
        title={copy.borderMode}
      />
      <SettingRow
        control={<UiSegmented aria-label={copy.codeSurface} onValueChange={(codeSurfaceVariant) => onAppearanceChange({ codeSurfaceVariant })} options={[
          { label: copy.light, value: "light" },
          { label: copy.dark, value: "dark" },
        ]} value={preferences.codeSurfaceVariant} />}
        description={copy.codeSurfaceDescription}
        title={copy.codeSurface}
      />
      <div className="appearanceDetails">
        <div className="appearanceDetailsHeader">
          <div><h4>{copy.themeDetails}</h4><p>{copy.themeDetailsDescription}</p></div>
          <UiButton onClick={onResetDetails} size="compact" tone="soft">{copy.resetThemeDetails}</UiButton>
        </div>
        <div aria-label={`${theme.label} ${copy.themeDetails}`} className="appearanceThemePreview">
          <span>{theme.label} · {preferences.mode === "system" ? systemVariant : preferences.mode}</span>
          <strong>Aa</strong>
          <code>const task = "Mystra";</code>
        </div>
        <SettingRow control={<UiRange label={copy.contrast} max={100} min={0} onValueChange={(contrast) => onAppearanceChange({ contrast })} value={preferences.contrast} valueDisplay={`${preferences.contrast}%`} />} title={copy.contrast} />
        <SettingRow control={<UiInput aria-label={copy.uiFont} fieldSize="default" onChange={(event) => onAppearanceChange({ uiFont: event.currentTarget.value })} value={preferences.uiFont ?? ""} />} title={copy.uiFont} />
        <SettingRow control={<UiInput aria-label={copy.contentFont} fieldSize="default" onChange={(event) => onAppearanceChange({ contentFont: event.currentTarget.value })} value={preferences.contentFont ?? ""} />} title={copy.contentFont} />
        <SettingRow control={<UiInput aria-label={copy.codeFont} fieldSize="default" onChange={(event) => onAppearanceChange({ codeFont: event.currentTarget.value })} value={preferences.codeFont ?? ""} />} title={copy.codeFont} />
        <SettingRow control={<UiRange label={copy.uiFontSize} max={14} min={12} onValueChange={(uiFontSize) => onAppearanceChange({ uiFontSize })} value={preferences.uiFontSize} valueDisplay={`${preferences.uiFontSize}px`} />} title={copy.uiFontSize} />
        <SettingRow control={<UiRange label={copy.contentFontSize} max={16} min={12} onValueChange={(contentFontSize) => onAppearanceChange({ contentFontSize })} value={preferences.contentFontSize} valueDisplay={`${preferences.contentFontSize}px`} />} title={copy.contentFontSize} />
      </div>
    </SettingGroup>
  );
}

export function TeamSettingsPanel({ locale }: { locale: ShellLocale }) {
  const copy = SHELL_COPY[locale];

  return (
    <SettingGroup aria-label={copy.team}>
      <SettingRow
        control={<span className="settingRowStatus">{copy.teamScopeValue}</span>}
        description={copy.teamScopeDescription}
        title={copy.teamScope}
      />
      <SettingRow
        control={<span className="settingRowStatus">{copy.settingsUnavailable}</span>}
        description={copy.teamAdministrationDescription}
        title={copy.teamAdministration}
      />
    </SettingGroup>
  );
}

export function IntegrationsSettingsPanel({
  data,
  error,
  isLoading,
  locale,
  onOpenGitHub,
}: {
  data: IntegrationConnectionListResponse | null;
  error: string | null;
  isLoading: boolean;
  locale: ShellLocale;
  onOpenGitHub: () => void;
}) {
  const copy = SHELL_COPY[locale];
  const connectionCount = data?.connections.filter((connection) => connection.integration === "github").length ?? 0;
  const methodSummary = data?.providers
    .find((provider) => provider.integration === "github")
    ?.methods.map((method) => method.type === "github-app" ? "GitHub App" : "PAT")
    .join(" / ") ?? "PAT";
  const description = isLoading
    ? "…"
    : error
      ? copy.githubConnectionError
      : locale === "zh-CN"
        ? `${connectionCount} 条连接 · ${methodSummary}`
        : `${connectionCount} connections · ${methodSummary}`;

  return (
    <SettingGroup aria-label={copy.integrations}>
      <SettingRow
        control={<UiButton size="compact" tone="soft" onClick={onOpenGitHub}>{locale === "zh-CN" ? "打开" : "Open"}</UiButton>}
        description={description}
        title="GitHub"
      />
    </SettingGroup>
  );
}
