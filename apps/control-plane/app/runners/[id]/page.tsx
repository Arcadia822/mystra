"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { EmptyState, ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { relativeTime, runnerStatus, taskLabel } from "../../_lib/format";
import type { JobSnapshot, RunnerSession } from "../../_lib/types";
import { useResource } from "../../_lib/use-resource";

export default function RunnerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const resource = useResource<{ runner: RunnerSession; assignedTasks: JobSnapshot[] }>(
    `/api/runners/${encodeURIComponent(id)}`,
    5_000,
  );

  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading runner detail" /></div>;
  if (resource.error || !resource.data) {
    return <div className="pageContent"><ErrorState message={resource.error ?? "Runner response missing"} onRetry={() => void resource.refresh()} /></div>;
  }

  const { runner, assignedTasks } = resource.data;
  const status = runnerStatus(runner.lastHeartbeatAt, runner.staleAfterSeconds);
  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity">
          <Link className="backLink" href="/runners">← Runners</Link>
          <strong>{runner.runnerName}</strong>
          <StatusBadge state={status} tone={status === "online" ? "good" : "bad"} />
        </div>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      <div className="detailGrid">
        <section className="panel">
          <div className="panelHeader"><h2>Session</h2><span className="mono">{runner.id}</span></div>
          <dl className="definitionList">
            <div><dt>Last heartbeat</dt><dd>{relativeTime(runner.lastHeartbeatAt)} · {runner.lastHeartbeatAt}</dd></div>
            <div><dt>Concurrency</dt><dd>{runner.activeRunCount} active / {runner.maxConcurrency} max</dd></div>
            <div><dt>Executor</dt><dd>{runner.capabilities.executor}</dd></div>
            <div><dt>Agents</dt><dd>{runner.capabilities.agents.join(", ") || "none"}</dd></div>
            <div><dt>Image</dt><dd className="mono">{runner.capabilities.image ?? "not reported"}</dd></div>
            <div><dt>Stale threshold</dt><dd>{runner.staleAfterSeconds}s</dd></div>
          </dl>
        </section>
        <section className="panel">
          <div className="panelHeader"><h2>Assigned tasks</h2><span>{assignedTasks.length}</span></div>
          {assignedTasks.length === 0 ? (
            <EmptyState title="No assigned tasks" description="This runner currently owns no persisted Run." />
          ) : (
            <div className="dataList">
              {assignedTasks.map((snapshot) => (
                <Link className="dataRow compactRow" href={`/tasks/${snapshot.job.id}`} key={snapshot.job.id}>
                  <span className="primaryCell"><strong>{taskLabel(snapshot.job.spec.taskId, snapshot.job.spec.issue?.reference.identifier)}</strong><small>{snapshot.job.spec.branchName}</small></span>
                  <StatusBadge state={snapshot.run.state} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
