"use client";

import type { AgentPage, RuntimeView, Task, TaskStatus } from "@mystra/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { StatusBadge } from "./status-badge";
import { useShellLocale } from "./shell-locale";
import { UiButton } from "./ui-actions";
import { UiSelect, UiTextarea } from "./ui-fields";

type ProductionView = {
  task: Task;
  executionContext: { id: string; agentId: string | null; agentName: string | null; agentRevision: number | null; workspaceId: string | null; sessionId: string | null; setupFailureCode: string | null; setupFailureMessage: string | null } | null;
  transitions: Array<{
    id: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    revision: number;
    actor: { kind: string; actorId: string | null; agentId: string | null; executionContextId: string | null; sessionId: string | null };
    note: string | null;
    occurredAt: string;
  }>;
  latestSession: { id: string; state: string } | null;
  promptEvidence: { standardPrompt: { version: string }; agentContext: { agentId: string; name: string; revision: number } | null } | null;
  agentReport: { text: string; verified: false; label: string } | null;
};

export function TaskProductionPanel({ task }: { task: Task }) {
  const locale = useShellLocale();
  const zh = locale === "zh-CN";
  const production = useResource<ProductionView>(`/api/tasks/${encodeURIComponent(task.id)}/production`, 3_000);
  const agents = useResource<AgentPage>("/api/agents?limit=100", 5_000);
  const runtimes = useResource<{ runtimes: RuntimeView[] }>("/api/runtimes", 5_000);
  const [agentId, setAgentId] = useState("");
  const [runtimeId, setRuntimeId] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startIdempotencyKey = useRef(crypto.randomUUID());
  const transitionIdempotencyKeys = useRef(new Map<string, string>());
  const current = production.data?.task ?? task;
  const activeAgents = agents.data?.agents.filter((agent) => agent.status === "active") ?? [];
  const onlineRuntimes = runtimes.data?.runtimes.filter((runtime) => runtime.status === "online") ?? [];
  const runtime = onlineRuntimes.find((candidate) => candidate.id === runtimeId);
  const providers = useMemo(() => runtime?.providers.filter((provider) => provider.available) ?? [], [runtime]);

  useEffect(() => { if (!runtimeId && onlineRuntimes[0]) setRuntimeId(onlineRuntimes[0].id); }, [onlineRuntimes, runtimeId]);
  useEffect(() => {
    if (!providers.some((provider) => provider.provider === providerKey)) setProviderKey(providers[0]?.provider ?? "");
  }, [providerKey, providers]);

  function transitionIdempotencyKey(status: TaskStatus) {
    const signature = `${current.statusRevision}:${status}`;
    const existing = transitionIdempotencyKeys.current.get(signature);
    if (existing) return existing;
    const created = crypto.randomUUID();
    transitionIdempotencyKeys.current.set(signature, created);
    return created;
  }

  async function send(path: string, body: unknown, onSuccess?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
      setNote("");
      await production.refresh();
      onSuccess?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  const humanActions: TaskStatus[] = current.status === "blocked"
      ? ["in_progress", "done", "canceled"]
      : current.status === "pending" || current.status === "in_progress"
        ? ["canceled"]
        : [];

  return (
    <section className="panel taskProductionPanel" aria-labelledby="task-production-heading">
      <div className="panelHeader">
        <div>
          <h2 id="task-production-heading">{zh ? "生产状态" : "Production"}</h2>
          <span>{zh ? "Task 业务状态与 Session 执行状态相互独立" : "Task business state is independent from Session execution state"}</span>
        </div>
        <StatusBadge state={current.status} />
      </div>
      <dl className="definitionList">
        <div><dt>{zh ? "状态 revision" : "Status revision"}</dt><dd className="mono">{current.statusRevision}</dd></div>
        <div><dt>{zh ? "当前 actor" : "Current actor"}</dt><dd>{current.statusActor.kind} · {current.statusActor.actorId ?? current.statusActor.agentId ?? "system"}</dd></div>
        <div><dt>{zh ? "最新 Session" : "Latest Session"}</dt><dd>{production.data?.latestSession ? `${production.data.latestSession.state} · ${production.data.latestSession.id}` : "—"}</dd></div>
        <div><dt>{zh ? "标准提示词版本" : "Standard Prompt version"}</dt><dd className="mono">{production.data?.promptEvidence?.standardPrompt.version ?? "—"}</dd></div>
        <div><dt>{zh ? "可选 Agent 上下文" : "Optional Agent Context"}</dt><dd>{production.data?.promptEvidence?.agentContext ? `${production.data.promptEvidence.agentContext.name} · r${production.data.promptEvidence.agentContext.revision}` : (zh ? "无附加上下文" : "None")}</dd></div>
      </dl>
      {production.data?.agentReport ? (
        <div className="formNotice">
          <strong>{production.data.agentReport.label}</strong>
          <p>{production.data.agentReport.text}</p>
        </div>
      ) : current.statusNote ? <p className="formNotice">{current.statusNote}</p> : null}
      {production.data?.executionContext?.setupFailureMessage ? (
        <p className="formError">{production.data.executionContext.setupFailureCode}: {production.data.executionContext.setupFailureMessage}</p>
      ) : null}
      {production.data?.transitions.length ? (
        <div>
          <h3>{zh ? "状态历史" : "Status history"}</h3>
          <ol className="sessionEventList">
            {production.data.transitions.slice(0, 8).map((transition) => (
              <li className="sessionEventItem" key={transition.id}>
                <span className="mono">r{transition.revision}</span>
                <div>
                  <strong>{transition.fromStatus.replaceAll("_", " ")} → {transition.toStatus.replaceAll("_", " ")}</strong>
                  <p>{transition.actor.kind} · {transition.actor.actorId ?? transition.actor.agentId ?? "system"}</p>
                  {transition.note ? <p>{transition.note}</p> : null}
                </div>
                <time dateTime={transition.occurredAt}>{transition.occurredAt}</time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {current.status === "pending" ? (
        <div className="sessionLaunchForm">
          <p className="formNotice">{zh ? "标准执行提示词始终生效；可选 Agent 上下文只补充行为偏好。" : "The Standard Execution Prompt always applies. Optional Agent Context only adds behavior preferences."}</p>
          {activeAgents.length > 0 ? <label>{zh ? "可选 Agent 上下文" : "Optional Agent Context"}
            <UiSelect disabled={busy} value={agentId} onChange={(event) => setAgentId(event.currentTarget.value)}>
              <option value="">{zh ? "无附加上下文" : "None"}</option>
              {activeAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </UiSelect>
          </label> : null}
          <label>{zh ? "Runtime" : "Runtime"}
            <UiSelect disabled={busy} value={runtimeId} onChange={(event) => setRuntimeId(event.currentTarget.value)}>
              {onlineRuntimes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </UiSelect>
          </label>
          <label>{zh ? "Provider" : "Provider"}
            <UiSelect disabled={busy} value={providerKey} onChange={(event) => setProviderKey(event.currentTarget.value)}>
              {providers.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.provider}</option>)}
            </UiSelect>
          </label>
          <UiButton disabled={busy || !runtimeId || !providerKey || !task.projectId} onClick={() => void send(
            `/api/tasks/${encodeURIComponent(task.id)}/production/start`,
            { runtimeId, providerKey, expectedRevision: current.statusRevision, idempotencyKey: startIdempotencyKey.current, ...(agentId ? { agentId } : {}) },
            () => { startIdempotencyKey.current = crypto.randomUUID(); },
          )} tone="solid">{busy ? "…" : zh ? "开始生产" : "Start production"}</UiButton>
          {!task.projectId ? <p className="formError">{zh ? "生产 Task 必须关联 Project" : "Production requires Project context"}</p> : null}
        </div>
      ) : null}
      {humanActions.length > 0 ? (
        <div className="sessionLaunchForm">
          <label>{zh ? "人工说明（可选）" : "Human note (optional)"}
            <UiTextarea maxLength={20_000} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
          </label>
          <div className="sessionLaunchActions">
            {humanActions.map((status) => (
              <UiButton disabled={busy} key={status} onClick={() => void send(
                `/api/tasks/${encodeURIComponent(task.id)}/production/status`,
                { status, expectedRevision: current.statusRevision, idempotencyKey: transitionIdempotencyKey(status), ...(note.trim() ? { note: note.trim() } : {}) },
                () => { transitionIdempotencyKeys.current.delete(`${current.statusRevision}:${status}`); },
              )} tone={status === "done" ? "solid" : "soft"}>{status.replaceAll("_", " ")}</UiButton>
            ))}
          </div>
        </div>
      ) : null}
      {error || production.error ? <p className="formError" role="alert">{error ?? production.error}</p> : null}
    </section>
  );
}
