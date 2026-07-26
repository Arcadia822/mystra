"use client";

import Link from "next/link";

import { ErrorState, LoadingState } from "./_components/states";
import { StatusBadge } from "./_components/status-badge";
import { relativeTime, taskLabel } from "./_lib/format";
import type { ControlPlanePayload } from "./_lib/types";
import { useResource } from "./_lib/use-resource";

export default function Page() {
  const resource = useResource<ControlPlanePayload>("/api/control-plane", 5_000);

  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading control plane" /></div>;
  if (resource.error || !resource.data) {
    return <div className="pageContent"><ErrorState message={resource.error ?? "Missing response"} onRetry={() => void resource.refresh()} /></div>;
  }

  const { controlPlane } = resource.data;
  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity">
          <StatusBadge state={controlPlane.status} tone={controlPlane.status === "ready" ? "good" : "warning"} />
          <span>Checked {relativeTime(controlPlane.checkedAt)}</span>
        </div>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>

      <section aria-label="Control plane summary" className="metricGrid">
        <article className="metric"><span>Active tasks</span><strong>{controlPlane.tasks.active}</strong><small>{controlPlane.tasks.queued} queued</small></article>
        <article className="metric"><span>Waiting review</span><strong>{controlPlane.tasks.waitingForReview}</strong><small>{controlPlane.tasks.succeeded} succeeded</small></article>
        <article className="metric"><span>Runner capacity</span><strong>{controlPlane.runners.availableCapacity}</strong><small>{controlPlane.runners.activeRuns} / {controlPlane.runners.maxConcurrency} active</small></article>
        <article className="metric"><span>Failed tasks</span><strong>{controlPlane.tasks.failed}</strong><small>{controlPlane.tasks.total} total</small></article>
      </section>

      <div className="dashboardGrid">
        <section className="panel">
          <div className="panelHeader"><h2>Recent tasks</h2><Link href="/tasks">View all</Link></div>
          {controlPlane.recentTasks.length === 0 ? (
            <div className="panelEmpty">No tasks have been submitted.</div>
          ) : (
            <div className="dataList">
              {controlPlane.recentTasks.map((snapshot) => (
                <Link className="dataRow taskRow" href={`/tasks/${snapshot.job.id}`} key={snapshot.job.id}>
                  <span className="primaryCell">
                    <strong>{taskLabel(snapshot.job.spec.taskId, snapshot.job.spec.issue?.reference.identifier)}</strong>
                    <small>{snapshot.job.spec.issue?.title ?? snapshot.run.result?.summary ?? snapshot.job.spec.branchName}</small>
                  </span>
                  <StatusBadge state={snapshot.run.state} />
                  <span className="quietCell">{snapshot.project?.slug ?? snapshot.lane?.projectSlug ?? "unassigned"}</span>
                  <time>{relativeTime(snapshot.run.updatedAt)}</time>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel capacityPanel">
          <div className="panelHeader"><h2>Runner health</h2><Link href="/runners">Inspect</Link></div>
          <dl className="definitionList">
            <div><dt>Online</dt><dd>{controlPlane.runners.online}</dd></div>
            <div><dt>Stale</dt><dd>{controlPlane.runners.stale}</dd></div>
            <div><dt>Active runs</dt><dd>{controlPlane.runners.activeRuns}</dd></div>
            <div><dt>Max concurrency</dt><dd>{controlPlane.runners.maxConcurrency}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
