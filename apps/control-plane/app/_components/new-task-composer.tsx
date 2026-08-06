"use client";

import type { Issue, IssueListResponse, Project } from "@mystra/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { MystraLogo } from "./mystra-logo";
import { ShellIcon } from "./shell-icons";
import { UiButton, UiIconButton } from "./ui-actions";
import { UiDropdown } from "./ui-dropdown";
import { UiTextarea } from "./ui-fields";

interface TaskCreateResponse {
  task?: { id?: string };
  error?: { code?: string; message?: string };
}

function issueBranch(identifier: string): string {
  const slug = identifier.toLowerCase().match(/[a-z0-9]+/g)?.join("-") ?? "issue";
  return `codex/${slug}`;
}

export function NewTaskComposer() {
  const router = useRouter();
  const projectsResource = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const projects = projectsResource.data?.projects ?? [];
  const [objective, setObjective] = useState("");
  const [projectId, setProjectId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.reference.externalId === selectedIssueId),
    [issues, selectedIssueId],
  );
  const selectedProjectIntegration = selectedProject?.repository.integration;
  const selectedProjectRepository = selectedProject?.repository.fullName;
  const canSubmit = Boolean(selectedProject)
    && (objective.trim().length > 0 || Boolean(selectedIssue))
    && !isSubmitting;

  useEffect(() => {
    setIssues([]);
    setSelectedIssueId("");
    setIssuesError(null);
    if (!selectedProjectIntegration || !selectedProjectRepository) {
      setIssuesLoading(false);
      return;
    }

    const controller = new AbortController();
    const integration = encodeURIComponent(selectedProjectIntegration);
    const repository = encodeURIComponent(selectedProjectRepository);
    setIssuesLoading(true);

    void fetch(`/api/integrations/${integration}/issues?repository=${repository}&limit=8`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as IssueListResponse & TaskCreateResponse;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? `Issue loading failed with status ${response.status}`);
        }
        setIssues(payload.items);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setIssuesError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIssuesLoading(false);
      });

    return () => controller.abort();
  }, [selectedProjectIntegration, selectedProjectRepository]);

  async function createTask() {
    if (!selectedProject || (!objective.trim() && !selectedIssue) || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(selectedIssue
        ? `/api/integrations/${encodeURIComponent(selectedIssue.reference.integration)}/issues/${encodeURIComponent(selectedIssue.reference.identifier)}/dispatch`
        : "/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selectedIssue ? {
          projectId: selectedProject.id,
          agent: selectedProject.defaultAgent,
          branch: issueBranch(selectedIssue.reference.identifier),
          ...(objective.trim() ? { sessionObjective: objective.trim() } : {}),
        } : {
          source: "api",
          projectId: selectedProject.id,
          objective: objective.trim(),
        }),
      });
      const payload = await response.json() as TaskCreateResponse;
      if (!response.ok || !payload.task?.id) {
        throw new Error(payload.error?.message ?? `Task creation failed with status ${response.status}`);
      }
      router.push(`/tasks/${payload.task.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="new-task-heading" className="newTaskSurface">
      <div className="newTaskLogo">
        <MystraLogo className="newTaskLogoMark" title="Mystra" />
      </div>
      <h1 className="srOnly" id="new-task-heading">Create a new Task</h1>

      <form
        className="newTaskComposer"
        onSubmit={(event) => {
          event.preventDefault();
          void createTask();
        }}
      >
        <label className="newTaskInputLabel" htmlFor="new-task-objective">Task objective</label>
        <UiTextarea
          autoFocus
          id="new-task-objective"
          placeholder="What should Mystra work on?"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && canSubmit) {
              event.preventDefault();
              void createTask();
            }
          }}
        />

        {selectedProject && (issuesLoading || issuesError || issues.length > 0) ? (
          <div aria-label="Issues" className="newTaskIssueRegion">
            {issuesLoading ? <p aria-live="polite" className="newTaskIssueState">Loading Issues…</p> : null}
            {issuesError ? <p className="newTaskIssueState error" role="alert">{issuesError}</p> : null}
            {!issuesLoading && !issuesError && issues.length > 0 ? (
              <div aria-label="Select an Issue" className="newTaskIssueList" role="list">
                {issues.map((issue) => (
                  <div key={issue.reference.externalId} role="listitem">
                    <UiButton
                      active={selectedIssue?.reference.externalId === issue.reference.externalId}
                      aria-label={`Select ${issue.reference.identifier}: ${issue.title}`}
                      aria-pressed={selectedIssue?.reference.externalId === issue.reference.externalId}
                      className="newTaskIssueCard"
                      onClick={() => setSelectedIssueId((current) => current === issue.reference.externalId ? "" : issue.reference.externalId)}
                    >
                      <ShellIcon name="issue" />
                      <span className="newTaskIssueCopy">
                        <strong>{issue.reference.identifier}</strong>
                        <span>{issue.title}</span>
                      </span>
                      <small>{issue.state.name}</small>
                    </UiButton>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <footer className="newTaskComposerFooter">
          <div className="composerTools">
            <UiIconButton aria-label="Attach file" className="composerIconButton" disabled size="header" title="Attachments are not connected to the Task API yet">
              <ShellIcon name="attachment" />
            </UiIconButton>
            <UiDropdown
              aria-label="Project"
              className="composerProjectDropdown"
              disabled={projectsResource.isLoading || projects.length === 0}
              icon={<ShellIcon name="project" />}
              onValueChange={setProjectId}
              options={projects.map((project) => ({
                value: project.id,
                label: project.name,
                description: project.repository.fullName,
              }))}
              placeholder="Project"
              value={projectId}
            />
          </div>

          <div className="composerActions">
            <UiIconButton aria-label="Voice input" className="composerIconButton" disabled size="header" title="Voice input is not available">
              <ShellIcon name="microphone" />
            </UiIconButton>
            <UiIconButton aria-label={selectedIssue ? "Create Task from Issue" : "Send Task"} className="composerSendButton" data-loading={isSubmitting || undefined} disabled={!canSubmit} size="default" tone="solid" type="submit">
              <ShellIcon name={isSubmitting ? "spinner" : "send"} />
            </UiIconButton>
          </div>
        </footer>
      </form>

      {projectsResource.error ? <p className="newTaskNotice error" role="alert">{projectsResource.error}</p> : null}
      {error ? <p className="newTaskNotice error" role="alert">{error}</p> : null}
    </section>
  );
}
