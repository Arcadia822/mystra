"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SettingGroup, SettingRow, SettingsModalFrame, type SettingsModalSection } from "@mystra/ui";

type SettingsSection = "account" | "appearance" | "team" | "team-members" | "integrations";

const SECTIONS: SettingsModalSection[] = [
  { glyph: "account", id: "account", label: "账户" },
  { glyph: "appearance", id: "appearance", label: "外观" },
  { glyph: "team", id: "team", label: "团队" },
  { glyph: "team-members", id: "team-members", label: "团队成员" },
  { glyph: "integrations", id: "integrations", label: "集成" },
];

const PLACEHOLDER_COPY: Record<Exclude<SettingsSection, "integrations">, string> = {
  account: "账户设置(原型未覆盖)",
  appearance: "外观设置(原型未覆盖)",
  team: "团队设置(原型未覆盖)",
  "team-members": "团队成员(原型未覆盖)",
};

export function SettingsModal({
  linearDetail,
  onCloseAction,
}: {
  linearDetail: ReactNode;
  onCloseAction: () => void;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("integrations");
  const [detail, setDetail] = useState<"github" | "linear" | null>(null);
  const [query, setQuery] = useState("");

  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return SECTIONS;
    return SECTIONS.filter((section) => section.label.toLocaleLowerCase("zh-CN").includes(normalized));
  }, [query]);

  const activeLabel = detail === "github"
    ? "GitHub"
    : detail === "linear"
      ? "Linear"
      : SECTIONS.find((section) => section.id === activeSection)?.label ?? "设置";

  return (
    <SettingsModalFrame
      activeSectionId={activeSection}
      backLabel="返回集成列表"
      closeLabel="关闭设置"
      identityDetail="账户 · 团队"
      navLabel="设置"
      onClose={onCloseAction}
      onQueryChange={setQuery}
      onSelectSection={(sectionId) => {
        setActiveSection(sectionId as SettingsSection);
        setDetail(null);
      }}
      {...(detail ? { onBack: () => setDetail(null) } : {})}
      open
      query={query}
      searchLabel="搜索设置"
      sections={visibleSections}
      title={activeLabel}
    >
      {detail === "github" ? (
        <p className="settingsDetailState">GitHub 集成(原型未覆盖)</p>
      ) : detail === "linear" ? (
        linearDetail
      ) : activeSection === "integrations" ? (
        <SettingGroup aria-label="集成">
          <SettingRow description="原型未覆盖" title="GitHub" />
          <SettingRow
            control={<button className="uiButton" data-size="compact" data-tone="soft" type="button" onClick={() => setDetail("linear")}>打开</button>}
            description="1 条连接 · API key"
            title="Linear"
          />
        </SettingGroup>
      ) : (
        <p className="settingsDetailState">{PLACEHOLDER_COPY[activeSection]}</p>
      )}
    </SettingsModalFrame>
  );
}
