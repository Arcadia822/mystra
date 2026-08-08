"use client";

import type { Project } from "@mystra/shared";
import { useState } from "react";

import { useResource } from "../_lib/use-resource";
import { ProjectIssuesBrowser } from "./project-issues-browser";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { UiSelect } from "./ui-fields";
import { ISSUE_COPY } from "./shell-copy";
import { useShellLocale } from "./shell-locale";
import { hasSelectedProject } from "./project-issues-model";

export function IssuesProjectPicker() {
  const locale = useShellLocale();
  const copy = ISSUE_COPY[locale];
  const projects = useResource<{ projects: Project[] }>("/api/projects");
  const [slug, setSlug] = useState("");
  return (
    <div className="pageContent issuesLandingPage">
      <header className="projectContext"><div><h1>{copy.issues}</h1><p>{copy.selectProjectHelp}</p></div><UiSelect aria-label={copy.selectProject} fieldSize="default" value={slug} onChange={(event) => setSlug(event.currentTarget.value)}><option value="">{copy.selectProject}</option>{(projects.data?.projects ?? []).map((project) => <option key={project.id} value={project.slug}>{project.name}</option>)}</UiSelect></header>
      {projects.isLoading ? <LoadingState label="Loading Projects" /> : null}
      {projects.error ? <ErrorState message={projects.error} onRetry={() => void projects.refresh()} /> : null}
      {!projects.isLoading && !projects.error && !slug ? <EmptyState title={copy.selectProjectTitle} description={copy.selectProjectDescription} /> : null}
      {hasSelectedProject(slug) ? <ProjectIssuesBrowser key={slug} projectSlug={slug} /> : null}
    </div>
  );
}
