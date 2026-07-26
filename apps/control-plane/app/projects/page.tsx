"use client";

import type { Project } from "@mystra/shared";
import Link from "next/link";

import { EmptyState, ErrorState, LoadingState } from "../_components/states";
import { relativeTime } from "../_lib/format";
import { useResource } from "../_lib/use-resource";

export default function ProjectsPage() {
  const resource = useResource<{ projects: Project[] }>("/api/projects");

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <p className="pageDescription">Repository execution defaults and sandbox configuration.</p>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      {resource.isLoading ? <LoadingState label="Loading projects" /> : null}
      {resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.refresh()} /> : null}
      {!resource.isLoading && !resource.error && resource.data?.projects.length === 0 ? (
        <EmptyState title="No projects configured" description="Create a Project through the canonical API before dispatching work." />
      ) : null}
      {resource.data?.projects.length ? (
        <section className="panel">
          <div className="tableHeader projectColumns">
            <span>Project</span><span>Repository</span><span>Agent</span><span>Runtime</span><span>Updated</span>
          </div>
          <div className="dataList">
            {resource.data.projects.map((project) => (
              <Link
                className="dataRow projectColumns"
                href={`/projects/${encodeURIComponent(project.slug)}`}
                key={project.id}
              >
                <span className="primaryCell"><strong>{project.name}</strong><small>{project.slug}</small></span>
                <span className="mono">{project.repo}</span>
                <span>{project.defaultAgent}</span>
                <span className="primaryCell">
                  <strong>{project.runtime.provider}</strong>
                  <small>{project.runtime.image}</small>
                </span>
                <time dateTime={project.updatedAt}>{relativeTime(project.updatedAt)}</time>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
