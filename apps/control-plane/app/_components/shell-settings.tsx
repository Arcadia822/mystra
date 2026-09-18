"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IntegrationConnectionListResponse } from "@mystra/shared";
import { SettingsModalFrame, type SettingsModalSection } from "@mystra/ui";

import type { AppearancePreferences, ControlPlaneThemeDefinition, ThemeVariant } from "../theme-system";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { useResource } from "../_lib/use-resource";
import { GitHubIntegrationDetail } from "./github-integration-detail";
import { LinearIntegrationDetail } from "./linear-integration-detail";
import {
  AppearanceSettingsPanel,
  IntegrationsSettingsPanel,
} from "./shell-settings-panels";
import { AccountSettings } from "./auth/account-settings";
import { TeamMembers } from "./team-members";
import { TeamSettings } from "./team-settings";

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

export type SettingsSection = "account" | "appearance" | "team" | "team-members" | "integrations";

export function ShellSettings({ initialSection = "account", locale, onAppearanceChange, onClose, onLocaleChange, onResetAppearanceDetails, preferences, systemVariant, theme }: ShellSettingsProps) {
  const copy = SHELL_COPY[locale];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [integrationDetail, setIntegrationDetail] = useState<"github" | "linear" | null>(null);
  const [query, setQuery] = useState("");
  const connections = useResource<IntegrationConnectionListResponse>("/api/integration-connections");
  const searchLabel = `${copy.search}${locale === "zh-CN" ? "" : " "}${copy.settings}`;
  const identityDetail = `${copy.account} · ${copy.team}`;
  const sections = useMemo<SettingsModalSection[]>(() => [
    { id: "account", glyph: "account", label: copy.account },
    { id: "appearance", glyph: "appearance", label: copy.appearance },
    { id: "team", glyph: "team", label: copy.team },
    { id: "team-members", glyph: "team-members", label: locale === "zh-CN" ? "团队成员" : "Team members" },
    { id: "integrations", glyph: "integrations", label: copy.integrations },
  ], [copy.account, copy.appearance, copy.integrations, copy.team, locale]);
  const visibleSections = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale === "zh-CN" ? "zh-CN" : "en-US");
    if (!normalizedQuery) return sections;
    return sections.filter((section) => section.label.toLocaleLowerCase(locale === "zh-CN" ? "zh-CN" : "en-US").includes(normalizedQuery));
  }, [locale, query, sections]);
  const activeLabel = integrationDetail === "github"
    ? "GitHub"
    : integrationDetail === "linear"
      ? "Linear"
    : sections.find((section) => section.id === activeSection)?.label ?? copy.settings;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") === "github" || params.get("integration") === "linear") {
      setActiveSection("integrations");
      setIntegrationDetail(params.get("integration") as "github" | "linear");
    }
  }, []);

  useEffect(() => {
    const [firstVisible] = visibleSections;
    if (!firstVisible || visibleSections.some((section) => section.id === activeSection)) return;
    setActiveSection(firstVisible.id as SettingsSection);
  }, [activeSection, visibleSections]);

  function showIntegrationDetail(detail: "github" | "linear" | null) {
    setIntegrationDetail(detail);
    const url = new URL(window.location.href);
    url.searchParams.set("settings", "integrations");
    if (detail) url.searchParams.set("integration", detail);
    else url.searchParams.delete("integration");
    window.history.replaceState(null, "", url);
  }

  return (
    <SettingsModalFrame
      activeSectionId={activeSection}
      backLabel={locale === "zh-CN" ? "返回集成列表" : "Back to integrations"}
      closeLabel={copy.closeSettings}
      dialogRef={dialogRef}
      identityDetail={identityDetail}
      navLabel={copy.settings}
      onClose={onClose}
      onQueryChange={setQuery}
      onSelectSection={(sectionId) => {
        setActiveSection(sectionId as SettingsSection);
        if (sectionId !== "integrations") setIntegrationDetail(null);
      }}
      {...(integrationDetail ? { onBack: () => showIntegrationDetail(null) } : {})}
      query={query}
      searchLabel={searchLabel}
      sections={visibleSections}
      title={activeLabel}
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
        ) : integrationDetail === "linear" ? (
          <LinearIntegrationDetail data={connections.data} error={connections.error} isLoading={connections.isLoading} locale={locale} onChanged={connections.refresh} onRetry={() => void connections.refresh()} />
        ) : activeSection === "account" ? (
          <AccountSettings embedded />
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
          <TeamSettings embedded onOpenMembers={() => setActiveSection("team-members")} />
        ) : activeSection === "team-members" ? (
          <TeamMembers embedded />
        ) : (
          <IntegrationsSettingsPanel
            data={connections.data}
            error={connections.error}
            isLoading={connections.isLoading}
            locale={locale}
            onOpenGitHub={() => showIntegrationDetail("github")}
            onOpenLinear={() => showIntegrationDetail("linear")}
          />
        )}
      </SettingsModalFrame>
  );
}
