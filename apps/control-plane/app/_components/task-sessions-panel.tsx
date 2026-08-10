"use client";

import type { AgentPage, RuntimeView, Session, Task, TaskSessionPage, TaskWorkspaceView } from "@mystra/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { relativeTime } from "../_lib/format";
import { useResource } from "../_lib/use-resource";
import { sessionStateLabel } from "./session-presentation";
import { TASK_SESSIONS_COPY } from "./shell-copy";
import { useShellLocale } from "./shell-locale";
import { UiButton } from "./ui-actions";
import { UiSelect, UiTextarea } from "./ui-fields";

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { code?: unknown; message?: unknown } | undefined;
    if (typeof error?.message === "string") return typeof error.code === "string" ? `${error.code}: ${error.message}` : error.message;
  }
  return `Request failed (${status})`;
}

export function TaskSessionsPanel({ task, workspace }: { task: Task; workspace: TaskWorkspaceView | null }) {
  const locale = useShellLocale();
  const copy = TASK_SESSIONS_COPY[locale];
  const router = useRouter();
  const page = useResource<TaskSessionPage>(`/api/tasks/${encodeURIComponent(task.id)}/sessions?limit=50`, 0);
  const runtimes = useResource<{ runtimes: RuntimeView[] }>("/api/runtimes", 5_000);
  const agents = useResource<AgentPage>("/api/agents?limit=100", 5_000);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [expanded, setExpanded] = useState(false);
  const [providerKey, setProviderKey] = useState("");
  const [agentId, setAgentId] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtime = useMemo(() => runtimes.data?.runtimes.find((item) => item.id === workspace?.runtimeId), [runtimes.data?.runtimes, workspace?.runtimeId]);
  const providers = useMemo(() => runtime?.providers.filter((provider) => provider.available) ?? [], [runtime]);
  const activeAgents = useMemo(() => agents.data?.agents.filter((agent) => agent.status === "active") ?? [], [agents.data?.agents]);
  const formError = error ?? runtimes.error ?? agents.error;
  const canLaunch = workspace?.state === "ready" && providerKey.length > 0 && agentId.length > 0 && !busy;

  useEffect(() => {
    if (!page.data) return;
    setSessions(page.data.sessions);
    setNextCursor(page.data.nextCursor);
  }, [page.data]);
  useEffect(() => {
    if (!providerKey && providers[0]) setProviderKey(providers[0].provider);
  }, [providerKey, providers]);
  useEffect(() => {
    if (!agentId && activeAgents[0]) setAgentId(activeAgents[0].id);
  }, [activeAgents, agentId]);

  async function loadMore() {
    if (!nextCursor || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/sessions?limit=50&cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store" });
      const payload = await response.json() as TaskSessionPage & { error?: unknown };
      if (!response.ok) throw new Error(responseError(payload, response.status));
      setSessions((current) => [...current, ...payload.sessions.filter((candidate) => !current.some((item) => item.id === candidate.id))]);
      setNextCursor(payload.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    if (!canLaunch) return;
    setBusy(true);
    setError(null);
    const sessionId = crypto.randomUUID();
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          providerKey,
          agentId,
          ...(manual.trim() ? { manualContext: { text: manual.trim() } } : {}),
        }),
      });
      const payload = await response.json() as { session?: Session; error?: unknown };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, response.status));
      router.push(`/sessions/${encodeURIComponent(payload.session.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  }

  return (
    <section className="panel taskSessionsPanel" aria-labelledby="task-sessions-heading">
      <div className="panelHeader">
        <div><h2 id="task-sessions-heading">{copy.heading}</h2><span>{copy.description}</span></div>
        <UiButton disabled={workspace?.state !== "ready"} onClick={() => setExpanded((value) => !value)} tone="solid">
          {expanded ? copy.hideForm : copy.newSession}
        </UiButton>
      </div>
      {expanded ? (
        <div className="sessionLaunchForm">
          <p className="formNotice">{copy.shared}</p>
          <label>{copy.runtime}<span className="mono lockedValue">{workspace?.runtimeId ?? "—"}</span></label>
          <label>{copy.provider}
            <UiSelect disabled={busy || providers.length === 0} value={providerKey} onChange={(event) => setProviderKey(event.currentTarget.value)}>
              {providers.length === 0 ? <option value="">{copy.noProvider}</option> : null}
              {providers.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.provider}</option>)}
            </UiSelect>
          </label>
          <label>{copy.agent}
            <UiSelect disabled={busy || activeAgents.length === 0} value={agentId} onChange={(event) => setAgentId(event.currentTarget.value)}>
              {activeAgents.length === 0 ? <option value="">{copy.noAgent}</option> : null}
              {activeAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </UiSelect>
          </label>
          <label>{copy.manual}
            <UiTextarea maxLength={64 * 1024} placeholder={copy.manualPlaceholder} value={manual} onChange={(event) => setManual(event.currentTarget.value)} />
          </label>
          <div className="sessionLaunchActions">
            <span aria-live="polite" className={formError ? "formError" : "pageDescription"}>{formError ?? ""}</span>
            <UiButton disabled={!canLaunch} onClick={() => void launch()} tone="solid">{busy ? copy.launching : copy.launch}</UiButton>
          </div>
        </div>
      ) : null}
      {error && !expanded ? <p className="sessionPanelNotice formError">{error}</p> : null}
      {workspace?.state !== "ready" ? <p className="sessionPanelNotice">{copy.workspaceRequired}</p> : null}
      {page.isLoading ? <p className="sessionPanelNotice">{copy.loading}</p> : null}
      {page.error ? <div className="sessionPanelNotice formError">{page.error} <UiButton onClick={() => void page.refresh()}>Retry</UiButton></div> : null}
      {!page.isLoading && !page.error && sessions.length === 0 ? (
        <div className="panelEmpty"><strong>{copy.empty}</strong><span>{copy.emptyDescription}</span></div>
      ) : null}
      {sessions.length > 0 ? (
        <div className="dataList sessionList">
          {sessions.map((session) => (
            <Link className="dataRow sessionRow" href={`/sessions/${encodeURIComponent(session.id)}`} key={session.id}>
              <span className="primaryCell"><strong>{sessionStateLabel(session.state, locale)}</strong><small className="mono">{session.id}</small></span>
              <span><small>{session.providerKey}</small><br /><span className="mono">{session.agentId}</span></span>
              <span><small>{copy.updated}</small><br />{relativeTime(session.updatedAt)}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {nextCursor ? <div className="sessionPager"><UiButton disabled={busy} onClick={() => void loadMore()}>{copy.loadMore}</UiButton></div> : null}
    </section>
  );
}
