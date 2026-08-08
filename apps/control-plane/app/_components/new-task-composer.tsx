"use client";

import type { Project } from "@mystra/shared";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { AiComposer } from "./ai-composer";
import { MystraLogo } from "./mystra-logo";
import {
  clearNewTaskDraft,
  createEmptyNewTaskDraft,
  loadNewTaskDraft,
  saveNewTaskDraft,
  type NewTaskDraft,
} from "./new-task-model";
import { NEW_TASK_COPY } from "./shell-copy";
import { ShellIcon } from "./shell-icons";
import { useShellLocale } from "./shell-locale";
import { UiButton, UiIconButton } from "./ui-actions";
import { UiDropdown } from "./ui-dropdown";
import { UiTextarea } from "./ui-fields";

interface TaskCreateResponse {
  task?: { id?: string };
  error?: { message?: string };
}

type AccountResponse = { user: { id: string } };
type TeamsResponse = { teams: Array<{ id: string; isActive: boolean }> };

export function NewTaskComposer() {
  const router = useRouter();
  const locale = useShellLocale();
  const copy = NEW_TASK_COPY[locale];
  const projectsResource = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const accountResource = useResource<AccountResponse>("/api/auth/session", 10_000);
  const teamsResource = useResource<TeamsResponse>("/api/teams", 10_000);
  const projects = projectsResource.data?.projects ?? [];
  const userId = accountResource.data?.user.id;
  const teamId = teamsResource.data?.teams.find((team) => team.isActive)?.id;
  const [draft, setDraft] = useState<NewTaskDraft>(() => createEmptyNewTaskDraft());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedScope = useRef<string | null>(null);
  const skipNextDraftSave = useRef(false);
  const projectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const selectedProject = projects.find((project) => project.id === draft.projectId);
  const canSubmit = Boolean(draft.title.trim() && !isSubmitting);

  useEffect(() => {
    if (!userId || !teamId || projectsResource.isLoading) return;
    const scope = `${userId}:${teamId}`;
    if (loadedScope.current === scope) return;
    setDraft(loadNewTaskDraft(window.localStorage, userId, teamId, projectIds));
    loadedScope.current = scope;
  }, [projectIds, projectsResource.isLoading, teamId, userId]);

  useEffect(() => {
    if (!userId || !teamId || loadedScope.current !== `${userId}:${teamId}`) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    saveNewTaskDraft(window.localStorage, userId, teamId, draft);
  }, [draft, teamId, userId]);

  function resetDraft() {
    if (userId && teamId) clearNewTaskDraft(window.localStorage, userId, teamId);
    skipNextDraftSave.current = true;
    setDraft(createEmptyNewTaskDraft());
    setError(null);
    document.getElementById("new-task-title")?.focus();
  }

  async function createTask() {
    if (!draft.title.trim() || isSubmitting) {
      setError(copy.invalidTitle);
      document.getElementById("new-task-title")?.focus();
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description || null,
          projectId: selectedProject?.id ?? null,
          idempotencyKey: draft.idempotencyKey,
        }),
      });
      const payload = await response.json() as TaskCreateResponse;
      if (!response.ok || !payload.task?.id) {
        throw new Error(payload.error?.message ?? `Task creation failed with status ${response.status}`);
      }
      if (userId && teamId) clearNewTaskDraft(window.localStorage, userId, teamId);
      router.push(`/tasks/${payload.task.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setIsSubmitting(false);
    }
  }

  const tools = (
    <>
      <UiDropdown
        aria-label={copy.project}
        className="composerProjectDropdown"
        disabled={projectsResource.isLoading}
        icon={<ShellIcon name="project" />}
        onValueChange={(value) => setDraft((current) => ({ ...current, projectId: value === "__none__" ? "" : value }))}
        options={[
          { value: "__none__", label: copy.noProject },
          ...projects.map((project) => ({
            value: project.id,
            label: project.name,
            description: project.repositoryExternalId,
          })),
        ]}
        placeholder={copy.noProject}
        value={draft.projectId || "__none__"}
      />
      <UiButton disabled={isSubmitting} onClick={resetDraft} size="compact" type="button">
        {copy.clear}
      </UiButton>
    </>
  );

  const actions = (
    <UiIconButton
      aria-label={copy.create}
      className="composerSendButton"
      data-loading={isSubmitting || undefined}
      disabled={!canSubmit}
      size="header"
      tone="solid"
      type="submit"
    >
      <ShellIcon name={isSubmitting ? "spinner" : "arrow-up"} />
    </UiIconButton>
  );

  return (
    <section aria-labelledby="new-task-heading" className="newTaskSurface">
      <div className="newTaskLogo"><MystraLogo className="newTaskLogoMark" title="Mystra" /></div>
      <h1 className="srOnly" id="new-task-heading">{copy.heading}</h1>
      <label className="srOnly" htmlFor="new-task-title">{copy.titleLabel}</label>
      <AiComposer
        actions={actions}
        canSubmit={!isSubmitting}
        className="newTaskComposer"
        inputId="new-task-title"
        middle={(
          <div className="newTaskDescriptionField">
            <label className="srOnly" htmlFor="new-task-description">{copy.descriptionLabel}</label>
            <UiTextarea
              id="new-task-description"
              maxLength={100_000}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder={copy.descriptionPlaceholder}
              value={draft.description}
            />
          </div>
        )}
        onChange={(title) => setDraft((current) => ({ ...current, title }))}
        onSubmit={(event) => { event.preventDefault(); void createTask(); }}
        placeholder={copy.titlePlaceholder}
        submitOnEnter
        tools={tools}
        value={draft.title}
      />
      <p
        aria-live="polite"
        className={`newTaskNotice${projectsResource.error || error ? " error" : ""}`}
        role={projectsResource.error || error ? "alert" : "status"}
      >
        {isSubmitting ? copy.creating : projectsResource.error ? copy.projectLoadFailed : error ?? ""}
      </p>
    </section>
  );
}
