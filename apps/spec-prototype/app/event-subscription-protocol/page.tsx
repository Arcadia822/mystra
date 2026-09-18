"use client";

import { useState } from "react";
import { PrototypeShell } from "../_components/prototype-shell";
import { SettingGroup, SettingRow } from "@mystra/ui";
import { SettingsModal } from "./settings-modal";

const DEMO_URL = "https://events.example-mystra.test/api/webhooks?token=0b1e6f2c-9d3a-47f5-8e21-c7a90d4b83e6";

export default function EventSubscriptionProtocolPage() {
  const [open, setOpen] = useState(true);

  return (
    <PrototypeShell onNewTask={() => setOpen(true)} onSearch={() => setOpen(true)} title="058 Event subscription protocol">
      <main className="prototypeStarter">
        <button className="uiButton" data-size="default" data-tone="solid" type="button" onClick={() => setOpen(true)}>打开设置</button>
        {open ? (
          <SettingsModal
            linearDetail={<LinearIntegrationDetail />}
            onCloseAction={() => setOpen(false)}
          />
        ) : null}
      </main>
    </PrototypeShell>
  );
}

function LinearIntegrationDetail() {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(DEMO_URL).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="githubIntegrationDetail">
      <div className="githubConnectionSummary"><strong>1 条连接</strong></div>
      <SettingGroup aria-label="Linear connections" className="settingsBusinessGroup githubConnectionList">
        <SettingRow description="Linear API key · 已验证" title="Castrel Linear" />
      </SettingGroup>
      <SettingGroup aria-label="Webhook 端点" className="settingsBusinessGroup">
        <SettingRow
          title="Webhook 端点"
          description="示例 URL(演示用、不可访问)。把固定 URL 粘贴到 Linear 的 Webhook 设置;再次打开或刷新仍显示同一个 URL。"
        >
          <div className="webhookUrlRow">
            <code className="webhookUrlText">{DEMO_URL}</code>
            <button className="uiButton" data-size="compact" data-tone="soft" type="button" onClick={copy}>{copied ? "已复制" : "复制"}</button>
          </div>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}
