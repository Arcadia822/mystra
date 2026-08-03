"use client";

import Link from "next/link";

import { EmptyState, ErrorState, LoadingState } from "../_components/states";
import { StatusBadge } from "../_components/status-badge";
import { relativeTime } from "../_lib/format";
import type { Runner } from "../_lib/types";
import { useResource } from "../_lib/use-resource";

export default function RunnersPage() {
  const resource = useResource<{ runners: Runner[] }>("/api/runners", 5_000);

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <p className="pageDescription">Stable Runner identities, capabilities, health, and available capacity.</p>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      {resource.isLoading ? <LoadingState label="Loading runners" /> : null}
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.isLoading && !resource.error && resource.data?.runners.length === 0 ? (
        <EmptyState title="No runners registered" description="Start a runner daemon to make execution capacity available." />
      ) : null}
      {resource.data?.runners.length ? (
        <section className="panel">
          <div className="tableHeader runnerColumns"><span>Runner</span><span>Status</span><span>Capacity</span><span>Executor</span><span>Heartbeat</span></div>
          <div className="dataList">
            {resource.data.runners.map((runner) => {
              return (
                <Link className="dataRow runnerColumns" href={`/runners/${runner.id}`} key={runner.id}>
                  <span className="primaryCell"><strong>{runner.name}</strong><small>{runner.id}</small></span>
                  <StatusBadge state={runner.health} tone={runner.health === "healthy" ? "good" : "bad"} />
                  <span>{runner.activeSessionCount} / {runner.maxConcurrency}</span>
                  <span>{runner.capabilities.executor}</span>
                  <time>{relativeTime(runner.lastHeartbeatAt)}</time>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
