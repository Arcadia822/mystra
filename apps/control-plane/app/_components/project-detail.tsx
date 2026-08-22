"use client";

import type { Project } from "@mystra/shared";
import { UiSegmented, UiSurfaceTitle } from "@mystra/ui";
import { useState } from "react";

import { useResource } from "../_lib/use-resource";
import { ProjectIssueSourceSettings } from "./project-issue-source-settings";
import { ProjectIssuesBrowser } from "./project-issues-browser";
import { ProjectRepositorySettings } from "./project-repository-settings";
import { ErrorState, LoadingState } from "./states";
import { ISSUE_COPY } from "./shell-copy";
import { useShellLocale } from "./shell-locale";
import { ShellMainHeader } from "./shell-main-header";

type Tab = "overview" | "issues" | "settings";

export function ProjectDetail({ slug }: { slug: string }) {
  const locale = useShellLocale();
  const copy = ISSUE_COPY[locale];
  const resource = useResource<{ project: Project }>(`/api/projects/${encodeURIComponent(slug)}`);
  const [tab, setTab] = useState<Tab>("issues");
  if (resource.isLoading) return <div className="pageContent"><LoadingState label="Loading Project" /></div>;
  if (resource.error || !resource.data) return <div className="pageContent"><ErrorState message={resource.error ?? "Project unavailable"} onRetry={() => void resource.refresh()} /></div>;
  const project = resource.data.project;
  const tabs = [
    { label: copy.overview, value: "overview" },
    { label: copy.issues, value: "issues" },
    { label: copy.settings, value: "settings" },
  ] as const;
  return (
    <>
      <ShellMainHeader
        title={<><UiSurfaceTitle as="span">{project.name}</UiSurfaceTitle><UiSegmented aria-label="Project sections" onValueChange={setTab} options={tabs} role="tablist" value={tab} /></>}
      />
      <div className="pageContent projectDetailPage">
        {tab === "overview" ? <section className="projectOverview"><dl><div><dt>Repository external ID</dt><dd>{project.repositoryExternalId}</dd></div><div><dt>Connection</dt><dd>{project.repositoryConnectionId}</dd></div><div><dt>Base branch</dt><dd>{project.repositoryBaseBranch}</dd></div></dl></section> : null}
        {tab === "issues" ? <ProjectIssuesBrowser projectSlug={project.slug} /> : null}
        {tab === "settings" ? <div className="projectSettingsStack"><ProjectRepositorySettings project={project} onSaved={resource.refresh} /><ProjectIssueSourceSettings projectSlug={project.slug} /></div> : null}
      </div>
    </>
  );
}
