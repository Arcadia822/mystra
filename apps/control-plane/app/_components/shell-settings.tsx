"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IntegrationConnectionListResponse } from "@mystra/shared";

import type { ControlPlaneThemeDefinition } from "../theme-system";
import { MystraLogo } from "./mystra-logo";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { ShellIcon } from "./shell-icons";
import { UiButton, UiIconButton } from "./ui-actions";
import { UiInput } from "./ui-fields";
import { UiDialogSurface, UiSurface } from "./ui-surfaces";
import { githubConnectionView } from "./github-connection-model";
import { useResource } from "../_lib/use-resource";
import {
  AccountSettingsPanel,
  AppearanceSettingsPanel,
  IntegrationsSettingsPanel,
  TeamSettingsPanel,
} from "./shell-settings-panels";

interface ShellSettingsProps {
  initialSection?: SettingsSection;
  locale: ShellLocale;
  onClose: () => void;
  onLocaleChange: (locale: ShellLocale) => void;
  onThemeChange: (themeId: string) => void;
  theme: ControlPlaneThemeDefinition;
}

export type SettingsSection = "account" | "appearance" | "team" | "integrations";

function AccountGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c.8-3.5 3-5.3 6.5-5.3s5.7 1.8 6.5 5.3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function AppearanceGlyph() {
  return (
    <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="12" cy="12" fill="none" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" opacity=".45" />
    </svg>
  );
}

function TeamGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 18c.7-3.2 2.5-4.8 5.2-4.8s4.5 1.6 5.2 4.8M14 14c2.9 0 4.8 1.3 5.5 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function IntegrationGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M8.5 8.5 5 12l3.5 3.5M15.5 8.5 19 12l-3.5 3.5M14 5l-4 14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

export function ShellSettings({ initialSection = "account", locale, onClose, onLocaleChange, onThemeChange, theme }: ShellSettingsProps) {
  const copy = SHELL_COPY[locale];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [query, setQuery] = useState("");
  const connections = useResource<IntegrationConnectionListResponse>("/api/integration-connections");
  const githubView = githubConnectionView(connections.data, connections.error, connections.isLoading);
  const searchLabel = `${copy.search}${locale === "zh-CN" ? "" : " "}${copy.settings}`;
  const identityDetail = `${copy.account} · ${copy.team}`;
  const sections = useMemo(() => [
    { id: "account" as const, icon: <AccountGlyph />, label: copy.account },
    { id: "appearance" as const, icon: <AppearanceGlyph />, label: copy.appearance },
    { id: "team" as const, icon: <TeamGlyph />, label: copy.team },
    { id: "integrations" as const, icon: <IntegrationGlyph />, label: copy.integrations },
  ], [copy.account, copy.appearance, copy.integrations, copy.team]);
  const visibleSections = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale === "zh-CN" ? "zh-CN" : "en-US");
    if (!normalizedQuery) return sections;
    return sections.filter((section) => section.label.toLocaleLowerCase(locale === "zh-CN" ? "zh-CN" : "en-US").includes(normalizedQuery));
  }, [locale, query, sections]);
  const activeLabel = sections.find((section) => section.id === activeSection)?.label ?? copy.settings;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const [firstVisible] = visibleSections;
    if (!firstVisible || visibleSections.some((section) => section.id === activeSection)) return;
    setActiveSection(firstVisible.id);
  }, [activeSection, visibleSections]);

  return (
    <dialog
      aria-labelledby="settings-title"
      className="settingsModal"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <UiDialogSurface className="settingsModalLayout">
        <UiSurface as="aside" className="settingsNavigation" variant="ghost">
          <div className="settingsIdentity">
            <MystraLogo className="settingsIdentityMark" />
            <div>
              <strong>Mystra</strong>
              <span>{identityDetail}</span>
            </div>
          </div>

          <label className="settingsSearch">
            <ShellIcon name="search" />
            <span className="srOnly">{searchLabel}</span>
            <UiInput
              autoFocus
              placeholder={searchLabel}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>

          <div aria-label={copy.settings} className="settingsNavList" role="tablist">
            {visibleSections.map((section) => (
              <UiButton
                active={activeSection === section.id}
                aria-selected={activeSection === section.id}
                aria-controls={`settings-panel-${section.id}`}
                block
                className="settingsNavItem"
                id={`settings-tab-${section.id}`}
                key={section.id}
                role="tab"
                onClick={() => setActiveSection(section.id)}
              >
                <span className="settingsNavIcon">{section.icon}</span>
                <span>{section.label}</span>
              </UiButton>
            ))}
            {visibleSections.length === 0 ? <p className="settingsSearchEmpty" role="status">—</p> : null}
          </div>
        </UiSurface>

        <UiSurface as="section" className="settingsContent" variant="ghost">
          <h2 className="srOnly" id="settings-title">{copy.settings}</h2>
          <header className="settingsContentHeader">
            <h3>{activeLabel}</h3>
            <UiIconButton aria-label={copy.closeSettings} className="settingsCloseButton" onClick={onClose}>
              <CloseGlyph />
            </UiIconButton>
          </header>

          <div
            aria-label={activeLabel}
            aria-labelledby={`settings-tab-${activeSection}`}
            className="settingsPane"
            id={`settings-panel-${activeSection}`}
            role="tabpanel"
          >
            {activeSection === "account" ? (
              <AccountSettingsPanel locale={locale} />
            ) : activeSection === "appearance" ? (
              <AppearanceSettingsPanel
                locale={locale}
                onLocaleChange={onLocaleChange}
                onThemeChange={onThemeChange}
                theme={theme}
              />
            ) : activeSection === "team" ? (
              <TeamSettingsPanel locale={locale} />
            ) : (
              <IntegrationsSettingsPanel
                githubView={githubView}
                locale={locale}
                onRetry={() => void connections.refresh()}
              />
            )}
          </div>
        </UiSurface>
      </UiDialogSurface>
    </dialog>
  );
}
