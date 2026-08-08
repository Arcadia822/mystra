"use client";

import type {
  IntegrationConnectionListResponse,
  LinearTeamListResponse,
  ProjectIssueSourcesResponse,
  TeamListItem,
} from "@mystra/shared";
import { useEffect, useMemo, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { SettingGroup, SettingRow } from "./setting-row";
import { UiButton } from "./ui-actions";
import { UiSelect } from "./ui-fields";
import { useShellLocale } from "./shell-locale";

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: unknown };
    if (typeof error.message === "string") return error.message;
  }
  return `Request failed with status ${status}`;
}

export function ProjectIssueSourceSettings({ projectSlug }: { projectSlug: string }) {
  const zh = useShellLocale() === "zh-CN";
  const sources = useResource<ProjectIssueSourcesResponse>(`/api/projects/${encodeURIComponent(projectSlug)}/issue-sources`);
  const connections = useResource<IntegrationConnectionListResponse>("/api/integration-connections");
  const teams = useResource<{ teams: TeamListItem[] }>("/api/teams");
  const activeRole = teams.data?.teams.find((team) => team.isActive)?.currentUserRole;
  const canManage = activeRole === "owner" || activeRole === "admin";
  const linearConnections = useMemo(() => connections.data?.connections.filter((connection) => connection.integration === "linear") ?? [], [connections.data]);
  const [connectionId, setConnectionId] = useState("");
  const [linearTeams, setLinearTeams] = useState<LinearTeamListResponse | null>(null);
  const [linearTeamId, setLinearTeamId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const statusIsSuccess = status?.includes("saved") || status?.includes("removed") || status?.includes("已保存") || status?.includes("已移除");

  useEffect(() => {
    if (!sources.data?.linear) return;
    setConnectionId(sources.data.linear.connectionId);
    setLinearTeamId(sources.data.linear.linearTeamExternalId);
  }, [sources.data]);

  useEffect(() => {
    setLinearTeams(null);
    setLinearTeamId((current) => sources.data?.linear?.connectionId === connectionId ? current : "");
    if (!connectionId || !canManage) return;
    const controller = new AbortController();
    void fetch(`/api/integration-connections/linear/api-key/${encodeURIComponent(connectionId)}/teams?first=100`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as LinearTeamListResponse;
        if (!response.ok) throw new Error(responseError(payload, response.status));
        setLinearTeams(payload);
      })
      .catch((caught) => { if (!controller.signal.aborted) setStatus(caught instanceof Error ? caught.message : String(caught)); });
    return () => controller.abort();
  }, [canManage, connectionId, sources.data?.linear?.connectionId]);

  async function save() {
    if (!connectionId || !linearTeamId) return;
    setBusy(true); setStatus(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/issue-sources/linear`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId, linearTeamExternalId: linearTeamId }), cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(responseError(payload, response.status));
      setStatus(zh ? "Linear Issue 来源已保存。" : "Linear Issue source saved.");
      await sources.refresh();
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setStatus(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/issue-sources/linear`, { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error(responseError(await response.json(), response.status));
      setConnectionId(""); setLinearTeamId(""); setLinearTeams(null);
      setStatus(zh ? "Linear Issue 来源已移除。" : "Linear Issue source removed.");
      await sources.refresh();
    } catch (caught) { setStatus(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  if (sources.isLoading || connections.isLoading || teams.isLoading) return <div className="issueState" role="status">{zh ? "正在加载 Issue 来源设置…" : "Loading Issue source settings…"}</div>;
  if (sources.error || connections.error || teams.error || !sources.data) return <div className="issueState" role="alert">{sources.error ?? connections.error ?? teams.error ?? (zh ? "Issue 来源设置不可用" : "Issue source settings unavailable")}</div>;

  return (
    <div className="projectSourceSettings">
      <SettingGroup aria-label="GitHub Issue source">
        <SettingRow title="GitHub repository" description={zh ? "自动跟随此 Project 的 exact repository binding。" : "Automatically follows the exact repository binding on this Project."} control={<span className="sourceReadOnly"><strong>{sources.data.github.repositoryExternalId}</strong><small>{sources.data.github.connectionId} · {zh ? "此处只读" : "read-only here"}</small></span>} />
      </SettingGroup>
      <SettingGroup aria-label="Linear Issue source">
        {!canManage ? <p className="readOnlyState">{zh ? "只读。修改 Integration 来源需要 Owner 或 Admin 权限。" : "Read-only. Owner or Admin permission is required to change Integration sources."}</p> : null}
        <SettingRow title="Linear connection" description={zh ? "选择当前 Team 所有的 exact API-key connection。" : "Select the exact Team-owned API-key connection."} control={<UiSelect disabled={!canManage || busy} value={connectionId} onChange={(event) => setConnectionId(event.currentTarget.value)}><option value="">{zh ? "不配置 Linear 来源" : "No Linear source"}</option>{linearConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.displayName ?? connection.providerExternalId}</option>)}</UiSelect>} />
        <SettingRow title="Linear Team" description={zh ? "一个 Project 最多绑定一个 provider-stable Linear Team。" : "One Project can bind zero or one provider-stable Linear Team."} control={<UiSelect disabled={!canManage || busy || !connectionId || !linearTeams} value={linearTeamId} onChange={(event) => setLinearTeamId(event.currentTarget.value)}><option value="">{zh ? "选择 Team…" : "Select Team…"}</option>{(linearTeams?.teams ?? []).filter((team) => !team.archivedAt).map((team) => <option key={team.id} value={team.id}>{team.key} · {team.name}</option>)}</UiSelect>} />
      </SettingGroup>
      {canManage ? <div className="projectSourceActions"><UiButton disabled={busy || !sources.data.linear} tone="danger" onClick={() => void remove()}>{zh ? "移除 Linear 来源" : "Remove Linear source"}</UiButton><UiButton disabled={busy || !connectionId || !linearTeamId} tone="solid" onClick={() => void save()}>{busy ? (zh ? "保存中…" : "Saving…") : (zh ? "保存来源" : "Save source")}</UiButton></div> : null}
      {status ? <p aria-live="polite" className={statusIsSuccess ? "formNotice" : "formNotice formError"}>{status}</p> : null}
    </div>
  );
}
