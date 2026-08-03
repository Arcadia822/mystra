"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { relativeTime, taskLabel } from "../../_lib/format";
import type { Session, Task } from "../../_lib/types";
import { useResource } from "../../_lib/use-resource";

interface TaskDetailPayload {
  task: Task;
  sessionSummary: { sessionCount: number; activeSessionCount: number };
}

export default function TaskDetailPage() {
  const id = useParams<{ id: string }>().id;
  const detail = useResource<TaskDetailPayload>(`/api/tasks/${encodeURIComponent(id)}`, 5_000);
  const children = useResource<{ taskId: string; sessions: Session[] }>(`/api/tasks/${encodeURIComponent(id)}/sessions`, 3_000);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [branch, setBranch] = useState("");
  const [agent, setAgent] = useState("codex");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(id)}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, objective, agent, ...(branch ? { branch } : {}) }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      setTitle("");
      setObjective("");
      setBranch("");
      setNotice("Session created.");
      await Promise.all([detail.refresh(), children.refresh()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (detail.isLoading) return <div className="pageContent"><LoadingState label="Loading task detail" /></div>;
  if (detail.error || !detail.data) return <div className="pageContent"><ErrorState message={detail.error ?? "Task response missing"} onRetry={() => void detail.refresh()} /></div>;
  const { task, sessionSummary } = detail.data;

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity"><Link className="backLink" href="/tasks">← Tasks</Link><strong>{taskLabel(task.id, task.issue?.reference.identifier)}</strong></div>
        <button className="secondaryButton" type="button" onClick={() => void Promise.all([detail.refresh(), children.refresh()])}>Refresh</button>
      </div>
      <div className="detailGrid">
        <div className="detailStack">
          <section className="panel">
            <div className="panelHeader"><h2>Task</h2><span className="mono">{task.id}</span></div>
            <dl className="definitionList">
              <div><dt>Objective</dt><dd>{task.objective}</dd></div>
              <div><dt>Project</dt><dd className="mono">{task.projectId}</dd></div>
              <div><dt>Repository</dt><dd>{task.repository.fullName}</dd></div>
              <div><dt>Sessions</dt><dd>{sessionSummary.sessionCount} total · {sessionSummary.activeSessionCount} active</dd></div>
              <div><dt>Updated</dt><dd>{relativeTime(task.updatedAt)} · {task.updatedAt}</dd></div>
            </dl>
          </section>
          {task.issue ? (
            <section className="panel">
              <div className="panelHeader"><h2>Issue snapshot</h2><a href={task.issue.reference.url} rel="noreferrer" target="_blank">Open source ↗</a></div>
              <dl className="definitionList"><div><dt>Identifier</dt><dd>{task.issue.reference.identifier}</dd></div><div><dt>Title</dt><dd>{task.issue.title}</dd></div><div><dt>Description</dt><dd className="proseValue">{task.issue.description ?? "No description"}</dd></div></dl>
            </section>
          ) : null}
        </div>
        <section className="panel">
          <div className="panelHeader"><h2>Create Session</h2><span>Independent child work</span></div>
          <form className="formStack" onSubmit={(event) => void createSession(event)}>
            <label>Title<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Objective<textarea required value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
            <label>Agent<select value={agent} onChange={(event) => setAgent(event.target.value)}><option value="codex">codex</option><option value="copilot">copilot</option></select></label>
            <label>Branch <small>(optional)</small><input value={branch} onChange={(event) => setBranch(event.target.value)} /></label>
            <button className="primaryButton" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating…" : "Create Session"}</button>
            {notice ? <p aria-live="polite" className="formNotice">{notice}</p> : null}
          </form>
        </section>
      </div>
      <section className="panel">
        <div className="panelHeader"><h2>Sessions</h2><span>{children.data?.sessions.length ?? 0}</span></div>
        {children.isLoading ? <LoadingState label="Loading sessions" /> : null}
        {children.error ? <ErrorState message={children.error} onRetry={() => void children.refresh()} /> : null}
        {!children.isLoading && !children.error && children.data?.sessions.length === 0 ? <EmptyState title="No Sessions" description="This Task can exist without execution. Create a Session when work is needed." /> : null}
        {children.data?.sessions.length ? <div className="dataList">{children.data.sessions.map((session) => <Link className="dataRow taskRow" href={`/sessions/${session.id}`} key={session.id}><span className="primaryCell"><strong>{session.title}</strong><small>{session.branch}</small></span><StatusBadge state={session.state} /><span>{session.agent}</span><time>{relativeTime(session.updatedAt)}</time></Link>)}</div> : null}
      </section>
    </div>
  );
}
