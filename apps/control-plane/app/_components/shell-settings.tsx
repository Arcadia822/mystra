"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IntegrationConnectionListResponse } from "@mystra/shared";

import type { AppearancePreferences, ControlPlaneThemeDefinition, ThemeVariant } from "../theme-system";
import { MystraLogo } from "./mystra-logo";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { ShellIcon } from "./shell-icons";
import { UiButton, UiIconButton } from "./ui-actions";
import { UiInput } from "./ui-fields";
import { UiDialogSurface, UiSurface } from "./ui-surfaces";
import { VerticalNavItem } from "./vertical-nav-item";
import { useResource } from "../_lib/use-resource";
import { GitHubIntegrationDetail } from "./github-integration-detail";
import {
  AccountSettingsPanel,
  AppearanceSettingsPanel,
  IntegrationsSettingsPanel,
  TeamSettingsPanel,
} from "./shell-settings-panels";

interface ShellSettingsProps {
  initialSection?: SettingsSection;
  locale: ShellLocale;
  onAppearanceChange: (change: Partial<AppearancePreferences>) => void;
  onClose: () => void;
  onLocaleChange: (locale: ShellLocale) => void;
  onResetAppearanceDetails: () => void;
  preferences: AppearancePreferences;
  systemVariant: ThemeVariant;
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

interface SettingsNavItemProps {
  active: boolean;
  ariaControls: string;
  icon: React.ReactNode;
  id: string;
  label: string;
  onClick: () => void;
}

function SettingsNavItem({ active, ariaControls, icon, id, label, onClick }: SettingsNavItemProps) {
  return (
    <VerticalNavItem
      active={active}
      ariaLabel={label}
      aria-selected={active}
      aria-controls={ariaControls}
      className="settingsNavItem"
      id={id}
      role="tab"
      onClick={onClick}
    >
      <span className="settingsNavIcon">{icon}</span>
      <span>{label}</span>
    </VerticalNavItem>
  );
}

export function ShellSettings({ initialSection = "account", locale, onAppearanceChange, onClose, onLocaleChange, onResetAppearanceDetails, preferences, systemVariant, theme }: ShellSettingsProps) {
  const copy = SHELL_COPY[locale];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [integrationDetail, setIntegrationDetail] = useState<"github" | null>(null);
  const [query, setQuery] = useState("");
  const connections = useResource<IntegrationConnectionListResponse>("/api/integration-connections");
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
  const activeLabel = integrationDetail === "github"
    ? "GitHub"
    : sections.find((section) => section.id === activeSection)?.label ?? copy.settings;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "github") {
      setActiveSection("integrations");
      setIntegrationDetail("github");
    }
  }, []);

  useEffect(() => {
    const [firstVisible] = visibleSections;
    if (!firstVisible || visibleSections.some((section) => section.id === activeSection)) return;
    setActiveSection(firstVisible.id);
  }, [activeSection, visibleSections]);

  function showIntegrationDetail(detail: "github" | null) {
    setIntegrationDetail(detail);
    const url = new URL(window.location.href);
    url.searchParams.set("settings", "integrations");
    if (detail) url.searchParams.set("integration", detail);
    else url.searchParams.delete("integration");
    window.history.replaceState(null, "", url);
  }

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
              fieldSize="header"
              placeholder={searchLabel}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>

          <div aria-label={copy.settings} className="settingsNavList" role="tablist">
            {visibleSections.map((section) => (
              <SettingsNavItem
                active={activeSection === section.id}
                ariaControls={`settings-panel-${section.id}`}
                icon={section.icon}
                id={`settings-tab-${section.id}`}
                key={section.id}
                label={section.label}
                onClick={() => {
                  setActiveSection(section.id);
                  if (section.id !== "integrations") setIntegrationDetail(null);
                }}
              />
            ))}
            {visibleSections.length === 0 ? <p className="settingsSearchEmpty" role="status">—</p> : null}
          </div>
        </UiSurface>

        <UiSurface as="section" className="settingsContent" variant="ghost">
          <h2 className="srOnly" id="settings-title">{copy.settings}</h2>
          <header className="settingsContentHeader">
            <div className="settingsContentTitle">
              {integrationDetail ? (
                <UiButton size="compact" onClick={() => showIntegrationDetail(null)} aria-label={locale === "zh-CN" ? "返回集成列表" : "Back to integrations"}>‹</UiButton>
              ) : null}
              <h3>{activeLabel}</h3>
            </div>
            <UiIconButton aria-label={copy.closeSettings} className="settingsCloseButton" onClick={onClose}>
              <ShellIcon name="close" />
            </UiIconButton>
          </header>

          <div
            aria-label={activeLabel}
            aria-labelledby={`settings-tab-${activeSection}`}
            className="settingsPane"
            id={`settings-panel-${activeSection}`}
            role="tabpanel"
          >
            {integrationDetail === "github" ? (
              <GitHubIntegrationDetail
                data={connections.data}
                error={connections.error}
                isLoading={connections.isLoading}
                locale={locale}
                onChanged={connections.refresh}
                onRetry={() => void connections.refresh()}
              />
            ) : activeSection === "account" ? (
              <AccountSettingsPanel locale={locale} />
            ) : activeSection === "appearance" ? (
              <AppearanceSettingsPanel
                locale={locale}
                onAppearanceChange={onAppearanceChange}
                onLocaleChange={onLocaleChange}
                onResetDetails={onResetAppearanceDetails}
                preferences={preferences}
                systemVariant={systemVariant}
                theme={theme}
              />
            ) : activeSection === "team" ? (
              <TeamSettingsPanel locale={locale} />
            ) : (
              <IntegrationsSettingsPanel
                data={connections.data}
                error={connections.error}
                isLoading={connections.isLoading}
                locale={locale}
                onOpenGitHub={() => showIntegrationDetail("github")}
              />
            )}
          </div>
        </UiSurface>
      </UiDialogSurface>
    </dialog>
  );
}
