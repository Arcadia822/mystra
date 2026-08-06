import type { CSSProperties } from "react";

import type { ControlPlaneThemeDefinition } from "../theme-system";
import { CONTROL_PLANE_THEMES } from "../theme-system";
import type { GitHubConnectionView } from "./github-connection-model";
import { SettingGroup, SettingRow } from "./setting-row";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { UiActionAnchor, UiButton } from "./ui-actions";
import { UiSelect } from "./ui-fields";

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
  onLocaleChange,
  onThemeChange,
  theme,
}: {
  locale: ShellLocale;
  onLocaleChange: (locale: ShellLocale) => void;
  onThemeChange: (themeId: string) => void;
  theme: ControlPlaneThemeDefinition;
}) {
  const copy = SHELL_COPY[locale];

  return (
    <SettingGroup aria-label={copy.appearance}>
      <SettingRow
        control={(
          <UiSelect
            aria-label={copy.language}
            fieldSize="header"
            value={locale}
            onChange={(event) => onLocaleChange(event.currentTarget.value as ShellLocale)}
          >
            <option value="en">{copy.languageEnglish}</option>
            <option value="zh-CN">{copy.languageChinese}</option>
          </UiSelect>
        )}
        description={copy.languageDescription}
        title={copy.language}
      />
      <SettingRow
        control={(
          <div className="appearanceThemeControl">
            <span
              aria-hidden="true"
              className="themeInlineSwatch"
              style={{
                "--swatch-ink": theme.theme.ink,
                "--swatch-surface": theme.theme.surface,
              } as CSSProperties}
            >
              Aa
            </span>
            <UiSelect
              aria-label={copy.theme}
              fieldSize="header"
              value={theme.id}
              onChange={(event) => onThemeChange(event.currentTarget.value)}
            >
              {CONTROL_PLANE_THEMES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </UiSelect>
          </div>
        )}
        description={copy.themeDescription}
        title={copy.theme}
      />
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
  githubView,
  locale,
  onRetry,
}: {
  githubView: GitHubConnectionView;
  locale: ShellLocale;
  onRetry: () => void;
}) {
  const copy = SHELL_COPY[locale];

  const control = githubView.action === "connect" || githubView.action === "reconnect" ? (
    <UiActionAnchor
      href={`${githubView.connectUrl}?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
      size="compact"
      tone="soft"
    >
      {githubView.action === "connect" ? copy.githubConnect : copy.githubReconnect}
    </UiActionAnchor>
  ) : githubView.action === "retry" ? (
    <UiButton size="compact" tone="soft" onClick={onRetry}>{copy.search}</UiButton>
  ) : (
    <span className="settingRowStatus">{githubView.state === "loading" ? "…" : "—"}</span>
  );

  const description = githubView.state === "connected"
    ? `${copy.githubConnectedAs} ${githubView.accountLogin}`
    : githubView.state === "not-configured"
      ? copy.githubNotConfigured
      : githubView.state === "error"
        ? copy.githubConnectionError
        : copy.githubDisconnected;

  return (
    <SettingGroup aria-label={copy.integrations}>
      <SettingRow control={control} description={description} title={copy.githubApp} />
    </SettingGroup>
  );
}
