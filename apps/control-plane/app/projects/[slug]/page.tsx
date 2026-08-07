"use client";

import type { Project } from "@mystra/shared";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { relativeTime } from "../../_lib/format";
import { useResource } from "../../_lib/use-resource";

export default function ProjectDetailPage() {
  const slug = useParams<{ slug: string }>().slug;
  const resource = useResource<{ project: Project }>(`/api/projects/${encodeURIComponent(slug)}`);

  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading project detail" /></div>;
  if (resource.error || !resource.data) {
    return <div className="pageContent"><ErrorState message={resource.error ?? "Project response missing"} onRetry={() => void resource.refresh()} /></div>;
  }
  const { project } = resource.data;

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity">
          <Link className="backLink" href="/projects">← Projects</Link>
          <strong>{project.name}</strong>
          <StatusBadge state={project.archivedAt ? "archived" : "active"} tone={project.archivedAt ? "muted" : "good"} />
        </div>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      <section className="panel">
        <div className="panelHeader"><h2>Project</h2><span className="mono">{project.id}</span></div>
        <dl className="definitionList">
          <div><dt>Slug</dt><dd>{project.slug}</dd></div>
          <div><dt>Repository external ID</dt><dd className="mono">{project.repositoryExternalId}</dd></div>
          <div><dt>Repository connection</dt><dd className="mono">{project.repositoryConnectionId}</dd></div>
          <div><dt>Base branch</dt><dd className="mono">{project.repositoryBaseBranch}</dd></div>
          <div><dt>Metadata keys</dt><dd>{Object.keys(project.metadata).sort().join(", ") || "none"}</dd></div>
          <div><dt>Created</dt><dd>{relativeTime(project.createdAt)} · {project.createdAt}</dd></div>
          <div><dt>Updated</dt><dd>{relativeTime(project.updatedAt)} · {project.updatedAt}</dd></div>
          {project.archivedAt ? <div><dt>Archived</dt><dd>{project.archivedAt}</dd></div> : null}
        </dl>
      </section>
      <section className="panel">
        <div className="panelHeader"><h2>Execution configuration</h2><span>Temporarily unavailable</span></div>
        <p className="pageDescription">Session runtime, Runner assignment, and Context Bundle persistence are outside the active Prisma schema.</p>
      </section>
    </div>
  );
}
