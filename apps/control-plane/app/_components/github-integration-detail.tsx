"use client";

import type {
  IntegrationConnection,
  IntegrationConnectionListResponse,
} from "@mystra/shared";
import { type FormEvent, useMemo, useRef, useState } from "react";

import { SettingGroup, SettingRow } from "./setting-row";
import {
  githubConnectionAccountLogin,
  githubConnectionRepositorySelection,
} from "./github-connection-model";
import { UiActionAnchor, UiButton } from "./ui-actions";
import { UiInput } from "./ui-fields";

const COPY = {
  en: {
    add: "Add connection",
    app: "GitHub App",
    appDescription: "Recommended for installation-scoped, short-lived credentials.",
    connected: "connections",
    cancel: "Cancel",
    confirmDelete: "Delete this GitHub connection? Projects that still use it will block deletion.",
    connectionMethods: "Connection methods",
    continue: "Continue",
    delete: "Delete",
    deleting: "Deleting…",
    disabled: "Unavailable",
    empty: "No GitHub connections yet.",
    error: "Connection data could not be loaded.",
    label: "Label",
    loading: "Loading connections…",
    pat: "Personal access token",
    patDescription: "Authorize repository discovery and delivery with a personal access token.",
    replace: "Replace token",
    repositoryAll: "All repositories",
    repositorySelected: "Selected repositories",
    repositoryToken: "Token-visible repositories",
    retry: "Retry",
    save: "Validate and save",
    saving: "Validating…",
    token: "Personal access token",
  },
  "zh-CN": {
    add: "添加连接",
    app: "GitHub App",
    appDescription: "推荐使用 installation 范围的短期凭据。",
    connected: "条连接",
    cancel: "取消",
    confirmDelete: "删除这条 GitHub 连接？仍在使用它的 Project 会阻止删除。",
    connectionMethods: "连接方式",
    continue: "继续",
    delete: "删除",
    deleting: "删除中…",
    disabled: "不可用",
    empty: "尚未添加 GitHub 连接。",
    error: "无法加载连接数据。",
    label: "标签",
    loading: "正在加载连接…",
    pat: "Personal access token",
    patDescription: "使用 PAT 授权仓库发现与交付。",
    replace: "替换 token",
    repositoryAll: "全部仓库",
    repositorySelected: "选定仓库",
    repositoryToken: "Token 可见仓库",
    retry: "重试",
    save: "验证并保存",
    saving: "验证中…",
    token: "Personal access token",
  },
} as const;

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: unknown };
    if (typeof error.message === "string") return error.message;
  }
  return `Request failed with status ${status}`;
}

function repositorySummary(
  connection: IntegrationConnection,
  copy: typeof COPY.en | typeof COPY["zh-CN"],
): string {
  const selection = githubConnectionRepositorySelection(connection);
  if (selection === "all") return copy.repositoryAll;
  if (selection === "token") return copy.repositoryToken;
  return copy.repositorySelected;
}

export function GitHubIntegrationDetail({
  data,
  error,
  isLoading,
  locale,
  onChanged,
  onRetry,
}: {
  data: IntegrationConnectionListResponse | null;
  error: string | null;
  isLoading: boolean;
  locale: "en" | "zh-CN";
  onChanged: () => Promise<void>;
  onRetry: () => void;
}) {
  const copy = COPY[locale];
  const provider = data?.providers.find((candidate) => candidate.integration === "github");
  const appMethod = provider?.methods.find((method) => method.type === "github-app");
  const patMethod = provider?.methods.find((method) => method.type === "personal-access-token");
  const connections = useMemo(() => (
    data?.connections.filter((connection) => connection.integration === "github") ?? []
  ), [data]);
  const [addConnectionOpen, setAddConnectionOpen] = useState(false);
  const [patForm, setPatForm] = useState<{ mode: "create" } | { mode: "replace"; id: string } | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleConnectionMethods() {
    setPatForm(null);
    setActionError(null);
    setAddConnectionOpen((current) => !current);
  }

  function openPatForm(connection?: IntegrationConnection) {
    setAddConnectionOpen(false);
    setPatForm(connection ? { mode: "replace", id: connection.id } : { mode: "create" });
    setDisplayName(connection?.displayName ?? "");
    setActionError(null);
  }

  async function submitPat(event: FormEvent) {
    event.preventDefault();
    const token = tokenInputRef.current?.value.trim() ?? "";
    if (!patForm || !token) return;
    setBusy(true);
    setActionError(null);
    try {
      const url = patForm.mode === "replace"
        ? `/api/integration-connections/github/pat/${encodeURIComponent(patForm.id)}`
        : "/api/integration-connections/github/pat";
      const response = await fetch(url, {
        method: patForm.mode === "replace" ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, response.status));
      if (tokenInputRef.current) tokenInputRef.current.value = "";
      setAddConnectionOpen(false);
      setPatForm(null);
      await onChanged();
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteConnection(connection: IntegrationConnection) {
    if (!window.confirm(copy.confirmDelete)) return;
    setDeletingId(connection.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/integration-connections/${encodeURIComponent(connection.id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(responseError(payload, response.status));
      }
      await onChanged();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) return <p className="settingsDetailState" role="status">{copy.loading}</p>;
  if (error || !data) {
    return (
      <div className="settingsDetailState" role="alert">
        <span>{copy.error}</span>
        <UiButton size="compact" tone="soft" onClick={onRetry}>{copy.retry}</UiButton>
      </div>
    );
  }

  return (
    <div className="githubIntegrationDetail">
      <div className="githubConnectionSummary">
        <strong>{connections.length} {copy.connected}</strong>
        <UiButton size="compact" tone="soft" onClick={toggleConnectionMethods}>
          {addConnectionOpen ? copy.cancel : copy.add}
        </UiButton>
      </div>

      {addConnectionOpen ? (
        <SettingGroup aria-label={copy.connectionMethods} className="settingsBusinessGroup">
          {appMethod ? (
            <SettingRow
              control={appMethod.configured ? (
                <UiActionAnchor
                  href={`${appMethod.connectUrl}?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
                  size="compact"
                  tone="soft"
                >
                  {copy.continue}
                </UiActionAnchor>
              ) : <span className="settingRowStatus">{copy.disabled}</span>}
              description={appMethod.disabledReason ?? copy.appDescription}
              title={copy.app}
            />
          ) : null}
          {patMethod ? (
            <SettingRow
              control={patMethod.configured ? (
                <UiButton size="compact" tone="soft" onClick={() => openPatForm()}>{copy.continue}</UiButton>
              ) : <span className="settingRowStatus">{copy.disabled}</span>}
              description={patMethod.disabledReason ?? copy.patDescription}
              title={copy.pat}
            />
          ) : null}
        </SettingGroup>
      ) : null}

      {patForm ? (
        <form className="githubPatForm" onSubmit={(event) => void submitPat(event)}>
          <UiInput
            aria-label={copy.label}
            autoFocus
            placeholder={copy.label}
            value={displayName}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
          />
          <UiInput
            aria-label={copy.token}
            autoComplete="off"
            placeholder={copy.token}
            ref={tokenInputRef}
            required
            type="password"
          />
          <div className="githubPatFormActions">
            <UiButton
              disabled={busy}
              onClick={() => {
                const returnToMethods = patForm.mode === "create";
                setPatForm(null);
                setAddConnectionOpen(returnToMethods);
              }}
            >
              {copy.cancel}
            </UiButton>
            <UiButton disabled={busy} tone="solid" type="submit">
              {busy ? copy.saving : copy.save}
            </UiButton>
          </div>
        </form>
      ) : null}

      {actionError ? <p className="formNotice formError" role="alert">{actionError}</p> : null}

      {connections.length === 0 ? <p className="settingsDetailState">{copy.empty}</p> : (
        <SettingGroup aria-label={`${connections.length} ${copy.connected}`} className="settingsBusinessGroup githubConnectionList">
          {connections.map((connection) => (
            <SettingRow
              key={connection.id}
              control={(
                <div className="githubConnectionActions">
                  {connection.authMethod === "personal-access-token" ? (
                    <UiButton size="compact" tone="soft" onClick={() => openPatForm(connection)}>{copy.replace}</UiButton>
                  ) : null}
                  <UiButton
                    disabled={deletingId === connection.id}
                    size="compact"
                    tone="danger"
                    onClick={() => void deleteConnection(connection)}
                  >
                    {deletingId === connection.id ? copy.deleting : copy.delete}
                  </UiButton>
                </div>
              )}
              description={`${connection.authMethod === "github-app" ? copy.app : "PAT"} · ${repositorySummary(connection, copy)} · ${connection.status}/${connection.credentialState}`}
              title={connection.displayName ?? githubConnectionAccountLogin(connection)}
            />
          ))}
        </SettingGroup>
      )}
    </div>
  );
}
