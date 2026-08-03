"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { isTerminalState, relativeTime } from "../../_lib/format";
import type { Session, Task } from "../../_lib/types";
import { useResource } from "../../_lib/use-resource";

export default function SessionDetailPage() {
  const id = useParams<{ id: string }>().id;
  const resource = useResource<{ session: Session; task: Task }>(`/api/sessions/${encodeURIComponent(id)}`, 3_000);
  const [notice, setNotice] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  async function cancelSession() {
    setIsCanceling(true);
    setNotice("");
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Canceled from Session detail" }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      setNotice("Session cancellation accepted.");
      await resource.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCanceling(false);
    }
  }

  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading Session detail" /></div>;
  if (resource.error || !resource.data) return <div className="pageContent"><ErrorState message={resource.error ?? "Session response missing"} onRetry={() => void resource.refresh()} /></div>;
  const { session, task } = resource.data;
  const result = session.result;
  const reviewUrl = result?.reviewResult?.review?.url;

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity"><Link className="backLink" href={`/tasks/${task.id}`}>← Task</Link><strong>{session.title}</strong><StatusBadge state={session.state} /></div>
        <div className="toolbarActions"><button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>{!isTerminalState(session.state) ? <button className="dangerButton" disabled={isCanceling} type="button" onClick={() => void cancelSession()}>{isCanceling ? "Canceling…" : "Cancel Session"}</button> : null}</div>
      </div>
      {notice ? <p aria-live="polite" className="formNotice">{notice}</p> : null}
      <div className="detailGrid">
        <section className="panel">
          <div className="panelHeader"><h2>Session</h2><span className="mono">{session.id}</span></div>
          <dl className="definitionList">
            <div><dt>Task</dt><dd><Link href={`/tasks/${task.id}`}>{task.id}</Link></dd></div>
            <div><dt>Objective</dt><dd>{session.objective}</dd></div>
            <div><dt>Agent</dt><dd>{session.agent}</dd></div>
            <div><dt>Branch</dt><dd className="mono">{session.branch}</dd></div>
            <div><dt>Runner</dt><dd>{session.assignedRunnerId ? <Link href={`/runners/${session.assignedRunnerId}`}>{session.assignedRunnerId}</Link> : "not assigned"}</dd></div>
            <div><dt>Image</dt><dd className="mono">{session.resolvedRuntime?.environment?.image ?? "not resolved"}</dd></div>
            <div><dt>Updated</dt><dd>{relativeTime(session.updatedAt)} · {session.updatedAt}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <div className="panelHeader"><h2>Result</h2>{result ? <StatusBadge state={result.status} /> : null}</div>
          {result ? <dl className="definitionList"><div><dt>Summary</dt><dd>{result.summary}</dd></div><div><dt>Test</dt><dd>{result.quality?.test?.status ?? "not reported"}</dd></div><div><dt>Build</dt><dd>{result.quality?.build?.status ?? "not reported"}</dd></div>{result.errorCode ? <div><dt>Error</dt><dd>{result.errorCode}: {result.errorMessage}</dd></div> : null}</dl> : <div className="panelEmpty">Result is not ready. This page refreshes every 3 seconds.</div>}
        </section>
        <section className="panel">
          <div className="panelHeader"><h2>Review handoff</h2><StatusBadge state={session.state === "waiting_for_review" ? "ready" : "pending"} tone={session.state === "waiting_for_review" ? "good" : "muted"} /></div>
          <dl className="definitionList"><div><dt>Preview</dt><dd>{result?.preview?.url ? <a href={result.preview.url} rel="noreferrer" target="_blank">Open preview ↗</a> : "not available"}</dd></div><div><dt>Review</dt><dd>{reviewUrl ? <a href={reviewUrl} rel="noreferrer" target="_blank">Open review ↗</a> : "not available"}</dd></div><div><dt>Sandbox</dt><dd>{result?.sandboxOutcome?.session?.provider ?? "not reported"} · {result?.sandboxOutcome?.session?.sessionId ?? "n/a"}</dd></div></dl>
        </section>
      </div>
    </div>
  );
}
