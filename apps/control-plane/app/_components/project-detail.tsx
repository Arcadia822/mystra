"use client";

import type { Project } from "@mystra/shared";
import { useState } from "react";

import { useResource } from "../_lib/use-resource";
import { ProjectIssueSourceSettings } from "./project-issue-source-settings";
import { ProjectIssuesBrowser } from "./project-issues-browser";
import { ErrorState, LoadingState } from "./states";
import { UiButton } from "./ui-actions";
import { ISSUE_COPY } from "./shell-copy";
import { useShellLocale } from "./shell-locale";

type Tab = "overview" | "issues" | "settings";

export function ProjectDetail({ slug }: { slug: string }) {
  const locale = useShellLocale();
  const copy = ISSUE_COPY[locale];
  const resource = useResource<{ project: Project }>(`/api/projects/${encodeURIComponent(slug)}`);
  const [tab, setTab] = useState<Tab>("issues");
  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading Project" /></div>;
  if (resource.error || !resource.data) return <div className="pageContent"><ErrorState message={resource.error ?? "Project unavailable"} onRetry={() => void resource.refresh()} /></div>;
  const project = resource.data.project;
  return (
    <div className="pageContent projectDetailPage">
      <header className="projectContext"><div><h1>{project.name}</h1><p>{project.slug} · {copy.projectScope}</p></div></header>
      <nav aria-label="Project sections" className="projectObjectTabs" role="tablist">
        {(["overview", "issues", "settings"] as const).map((item) => <UiButton active={tab === item} aria-selected={tab === item} key={item} role="tab" onClick={() => setTab(item)}>{item === "overview" ? copy.overview : item === "issues" ? copy.issues : copy.settings}</UiButton>)}
      </nav>
      {tab === "overview" ? <section className="projectOverview"><dl><div><dt>Repository external ID</dt><dd>{project.repositoryExternalId}</dd></div><div><dt>Connection</dt><dd>{project.repositoryConnectionId}</dd></div><div><dt>Base branch</dt><dd>{project.repositoryBaseBranch}</dd></div></dl></section> : null}
      {tab === "issues" ? <ProjectIssuesBrowser projectSlug={project.slug} /> : null}
      {tab === "settings" ? <ProjectIssueSourceSettings projectSlug={project.slug} /> : null}
    </div>
  );
}
