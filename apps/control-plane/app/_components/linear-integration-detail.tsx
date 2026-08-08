"use client";

import type { IntegrationConnection, IntegrationConnectionListResponse } from "@mystra/shared";
import { type FormEvent, useRef, useState } from "react";

import { linearConnections, linearConnectionSummary } from "./linear-integration-model";
import { SettingGroup, SettingRow } from "./setting-row";
import { UiButton } from "./ui-actions";
import { UiInput } from "./ui-fields";

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: unknown };
    if (typeof error.message === "string") return error.message;
  }
  return `Request failed with status ${status}`;
}

export function LinearIntegrationDetail({ data, error, isLoading, locale = "en", onChanged, onRetry }: {
  data: IntegrationConnectionListResponse | null;
  error: string | null;
  isLoading: boolean;
  onChanged: () => Promise<void>;
  onRetry: () => void;
  locale?: "en" | "zh-CN";
}) {
  const zh = locale === "zh-CN";
  const connections = linearConnections(data);
  const keyRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<{ mode: "create" } | { mode: "replace"; id: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function open(connection?: IntegrationConnection) {
    setForm(connection ? { mode: "replace", id: connection.id } : { mode: "create" });
    setDisplayName(connection?.displayName ?? "");
    setActionError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const apiKey = keyRef.current?.value.trim() ?? "";
    if (!form || !apiKey) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(form.mode === "create"
        ? "/api/integration-connections/linear/api-key"
        : `/api/integration-connections/linear/api-key/${encodeURIComponent(form.id)}`, {
        method: form.mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, ...(displayName.trim() ? { displayName: displayName.trim() } : {}) }),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, response.status));
      if (keyRef.current) keyRef.current.value = "";
      setForm(null);
      await onChanged();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(connection: IntegrationConnection) {
    if (!window.confirm(zh ? "删除这条 Linear connection？仍被 Project 引用时会阻止删除。" : "Delete this Linear connection? Project references will block deletion.")) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/integration-connections/linear/api-key/${encodeURIComponent(connection.id)}`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(responseError(await response.json(), response.status));
      await onChanged();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="settingsDetailState" role="status">{zh ? "正在加载 Linear connection…" : "Loading Linear connections…"}</p>;
  if (error || !data) return <div className="settingsDetailState" role="alert"><span>{zh ? "无法加载 Linear connection 数据。" : "Linear connection data could not be loaded."}</span><UiButton tone="soft" onClick={onRetry}>{zh ? "重试" : "Retry"}</UiButton></div>;

  return (
    <div className="githubIntegrationDetail">
      <div className="githubConnectionSummary"><strong>{connections.length} {zh ? "条连接" : "connections"}</strong><UiButton size="compact" tone="soft" onClick={() => form ? setForm(null) : open()}>{form ? (zh ? "取消" : "Cancel") : (zh ? "添加连接" : "Add connection")}</UiButton></div>
      {form ? (
        <form className="githubPatForm" onSubmit={(event) => void submit(event)}>
          <UiInput aria-label={zh ? "连接标签" : "Connection label"} placeholder={zh ? "标签" : "Label"} value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} />
          <UiInput aria-label="Linear API key" autoComplete="off" placeholder="Linear API key" ref={keyRef} required type="password" />
          <div className="githubPatFormActions"><UiButton disabled={busy} onClick={() => setForm(null)}>{zh ? "取消" : "Cancel"}</UiButton><UiButton disabled={busy} tone="solid" type="submit">{busy ? (zh ? "验证中…" : "Validating…") : (zh ? "验证并保存" : "Validate and save")}</UiButton></div>
        </form>
      ) : null}
      {actionError ? <p className="formNotice formError" role="alert">{actionError}</p> : null}
      {connections.length === 0 ? <p className="settingsDetailState">{zh ? "尚未添加 Linear connection。" : "No Linear connections yet."}</p> : (
        <SettingGroup aria-label="Linear connections" className="settingsBusinessGroup githubConnectionList">
          {connections.map((connection) => <SettingRow key={connection.id} title={connection.displayName ?? connection.providerExternalId} description={linearConnectionSummary(connection)} control={<div className="githubConnectionActions"><UiButton disabled={busy} size="compact" tone="soft" onClick={() => open(connection)}>{zh ? "替换 key" : "Replace key"}</UiButton><UiButton disabled={busy} size="compact" tone="danger" onClick={() => void remove(connection)}>{zh ? "删除" : "Delete"}</UiButton></div>} />)}
        </SettingGroup>
      )}
    </div>
  );
}
