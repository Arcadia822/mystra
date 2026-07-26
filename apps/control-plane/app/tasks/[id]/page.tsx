"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { isTerminalState, relativeTime, taskLabel } from "../../_lib/format";
import type { JobSnapshot } from "../../_lib/types";
import { useResource } from "../../_lib/use-resource";

function resultUrl(snapshot: JobSnapshot): string | undefined {
  return snapshot.run.result?.reviewResult?.review?.url ?? snapshot.run.result?.mrUrl;
}

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const resource = useResource<JobSnapshot>(`/api/jobs/${encodeURIComponent(id)}`, 3_000);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  async function cancelTask() {
    setIsCanceling(true);
    setNotice("");
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      const payload = await response.json() as { error?: string | { message?: string } };
      if (!response.ok) {
        const message = typeof payload.error === "string"
          ? payload.error
          : payload.error?.message;
        throw new Error(message ?? `HTTP ${response.status}`);
      }
      setNotice("Cancel request accepted.");
      setConfirmCancel(false);
      await resource.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCanceling(false);
    }
  }

  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading task detail" /></div>;
  if (resource.error || !resource.data) {
    return <div className="pageContent"><ErrorState message={resource.error ?? "Task response missing"} onRetry={() => void resource.refresh()} /></div>;
  }

  const snapshot = resource.data;
  const issue = snapshot.job.spec.issue;
  const result = snapshot.run.result;
  const reviewUrl = resultUrl(snapshot);
  const previewUrl = result?.preview?.url;
  const canCancel = !isTerminalState(snapshot.run.state);
  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity">
          <Link className="backLink" href="/tasks">← Tasks</Link>
          <strong>{taskLabel(snapshot.job.spec.taskId, issue?.reference.identifier)}</strong>
          <StatusBadge state={snapshot.run.state} />
        </div>
        <div className="toolbarActions">
          <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
          {canCancel ? (
            confirmCancel ? (
              <span className="confirmActions">
                <span>Cancel this task?</span>
                <button className="dangerButton" disabled={isCanceling} type="button" onClick={() => void cancelTask()}>{isCanceling ? "Canceling…" : "Confirm"}</button>
                <button className="secondaryButton" type="button" onClick={() => setConfirmCancel(false)}>Keep running</button>
              </span>
            ) : (
              <button className="dangerButton" type="button" onClick={() => setConfirmCancel(true)}>Cancel task</button>
            )
          ) : null}
        </div>
      </div>
      {notice ? <p aria-live="polite" className="formNotice">{notice}</p> : null}

      <div className="detailGrid">
        <div className="detailStack">
          <section className="panel">
            <div className="panelHeader"><h2>Task</h2><span className="mono">{snapshot.job.id}</span></div>
            <dl className="definitionList">
              <div><dt>Run ID</dt><dd className="mono">{snapshot.run.id}</dd></div>
              <div><dt>Project</dt><dd>{snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? "unassigned"}</dd></div>
              <div><dt>Branch</dt><dd className="mono">{result?.branch ?? snapshot.job.spec.branchName}</dd></div>
              <div><dt>Attempt</dt><dd>{snapshot.run.attempt}</dd></div>
              <div><dt>Updated</dt><dd>{relativeTime(snapshot.run.updatedAt)} · {snapshot.run.updatedAt}</dd></div>
              <div><dt>Runner</dt><dd>{snapshot.run.assignedRunnerSessionId ? <Link href={`/runners/${snapshot.run.assignedRunnerSessionId}`}>{snapshot.run.assignedRunnerSessionId}</Link> : "not assigned"}</dd></div>
              <div><dt>Image</dt><dd className="mono">{snapshot.runtime?.environment?.image ?? snapshot.project?.runtime.image ?? "not resolved"}</dd></div>
            </dl>
          </section>

          {issue ? (
            <section className="panel">
              <div className="panelHeader"><h2>Issue snapshot</h2><a href={issue.reference.url} rel="noreferrer" target="_blank">Open source ↗</a></div>
              <dl className="definitionList">
                <div><dt>Identifier</dt><dd>{issue.reference.identifier}</dd></div>
                <div><dt>Title</dt><dd>{issue.title}</dd></div>
                <div><dt>State</dt><dd>{issue.state.name}</dd></div>
                <div><dt>Description</dt><dd className="proseValue">{issue.description ?? "No description"}</dd></div>
              </dl>
            </section>
          ) : null}

          <section className="panel">
            <div className="panelHeader"><h2>Events</h2><span>{snapshot.events.length}</span></div>
            {snapshot.events.length === 0 ? <div className="panelEmpty">No structured events recorded.</div> : (
              <ol className="eventList">
                {[...snapshot.events].reverse().map((event, index) => (
                  <li key={`${event.timestamp}-${event.type}-${index}`}>
                    <span className="eventMarker" />
                    <span className="primaryCell"><strong>{event.type}</strong><small>{JSON.stringify(event.data)}</small></span>
                    <StatusBadge state={event.severity} tone={event.severity === "error" ? "bad" : "muted"} />
                    <time>{relativeTime(event.timestamp)}</time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="detailStack">
          <section className="panel">
            <div className="panelHeader"><h2>Execution result</h2>{result ? <StatusBadge state={result.status} /> : null}</div>
            {result ? (
              <dl className="definitionList">
                <div><dt>Summary</dt><dd>{result.summary}</dd></div>
                <div><dt>Test</dt><dd><StatusBadge state={result.quality?.test?.status ?? "not reported"} /></dd></div>
                <div><dt>Test command</dt><dd className="mono">{result.quality?.test?.command ?? "not reported"}</dd></div>
                <div><dt>Build</dt><dd><StatusBadge state={result.quality?.build?.status ?? "not reported"} /></dd></div>
                <div><dt>Build command</dt><dd className="mono">{result.quality?.build?.command ?? "not reported"}</dd></div>
                {result.errorCode ? <div><dt>Error</dt><dd>{result.errorCode}: {result.errorMessage}</dd></div> : null}
              </dl>
            ) : <div className="panelEmpty">Result is not ready. This page refreshes every 3 seconds.</div>}
          </section>

          <section className="panel">
            <div className="panelHeader"><h2>Review handoff</h2><StatusBadge state={snapshot.run.state === "waiting_for_review" ? "ready" : "pending"} tone={snapshot.run.state === "waiting_for_review" ? "good" : "muted"} /></div>
            <dl className="definitionList">
              <div><dt>Preview</dt><dd>{previewUrl ? <a href={previewUrl} rel="noreferrer" target="_blank">Open preview ↗</a> : "not available"}</dd></div>
              <div><dt>Pull request</dt><dd>{reviewUrl ? <a href={reviewUrl} rel="noreferrer" target="_blank">Open review ↗</a> : "not available"}</dd></div>
              <div><dt>Sandbox</dt><dd>{result?.sandboxOutcome?.session?.provider ?? "not reported"} · {result?.sandboxOutcome?.session?.sessionId ?? "n/a"}</dd></div>
              <div><dt>Agent</dt><dd>{result?.agentExecution?.agent ?? "not reported"} {result?.agentExecution?.cliVersion ?? ""}</dd></div>
              <div><dt>Mode</dt><dd>{result?.agentExecution?.mode ?? "not reported"} · cap {result?.agentExecution?.maxAutopilotContinues ?? "n/a"}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
