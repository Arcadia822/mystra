"use client";

import type {
  IntegrationDescriptor,
  RepositoryListResponse,
} from "@mystra/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { useResource } from "../../_lib/use-resource";
import {
  canSubmitProject,
  type ProjectDraft,
} from "./project-create-model";

const initialDraft: ProjectDraft = {
  name: "",
  slug: "",
  integration: "github",
  repository: "",
  agent: "copilot",
  runtimeImage: "mystra-runner:local",
};

function responseError(payload: unknown, status: number): string {
  if (
    payload
    && typeof payload === "object"
    && "error" in payload
    && payload.error
    && typeof payload.error === "object"
    && "message" in payload.error
    && typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return `Project creation failed with status ${status}`;
}

export function ProjectCreateForm() {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const integrations = useResource<{ integrations: IntegrationDescriptor[] }>(
    "/api/integrations",
  );
  const repositoryIntegrations = useMemo(
    () => integrations.data?.integrations.filter((integration) =>
      integration.capabilities.includes("repositories")) ?? [],
    [integrations.data],
  );
  const repositories = useResource<RepositoryListResponse>(
    `/api/integrations/${encodeURIComponent(draft.integration)}/repositories?limit=100`,
  );
  const repositoryIdentifiers = repositories.data?.items.map((repository) =>
    repository.fullName) ?? [];
  const canSubmit = canSubmitProject({
    draft,
    repositoryIdentifiers,
    isSubmitting,
  });

  useEffect(() => {
    if (
      repositoryIntegrations.length > 0
      && !repositoryIntegrations.some((integration) =>
        integration.name === draft.integration)
    ) {
      setDraft((current) => ({
        ...current,
        integration: repositoryIntegrations[0]?.name ?? "",
        repository: "",
      }));
    }
  }, [draft.integration, repositoryIntegrations]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          repository: {
            integration: draft.integration,
            identifier: draft.repository,
          },
          defaultAgent: draft.agent,
          runtime: {
            provider: "docker",
            image: draft.runtimeImage.trim(),
          },
        }),
      });
      const payload = await response.json() as {
        project?: { slug: string };
      };
      if (!response.ok || !payload.project) {
        throw new Error(responseError(payload, response.status));
      }
      router.push(`/projects/${encodeURIComponent(payload.project.slug)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel projectCreatePanel" aria-labelledby="create-project-title">
      <div className="panelHeader">
        <div>
          <h2 id="create-project-title">Create Project</h2>
          <span>Bind execution defaults to an immutable remote repository identity.</span>
        </div>
        <span>{repositoryIntegrations.length} repository integration</span>
      </div>
      <ul aria-label="Integration capabilities" className="integrationCapabilityList">
        {integrations.data?.integrations.map((integration) => (
          <li key={integration.name}>
            <strong>{integration.name}</strong>
            <span>{integration.capabilities.join(" + ")}</span>
          </li>
        ))}
      </ul>
      <form className="projectForm" onSubmit={(event) => void submit(event)}>
        <div className="projectFormGrid">
          <label>
            <span>Name</span>
            <input
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Mystra fixture"
              required
              value={draft.name}
            />
          </label>
          <label>
            <span>Slug</span>
            <input
              autoComplete="off"
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              pattern="[a-z0-9][a-z0-9-]*"
              placeholder="mystra-fixture"
              required
              value={draft.slug}
            />
          </label>
          <label>
            <span>Repository Integration</span>
            <select
              disabled={integrations.isLoading || repositoryIntegrations.length === 0}
              onChange={(event) => setDraft({
                ...draft,
                integration: event.target.value,
                repository: "",
              })}
              value={draft.integration}
            >
              {repositoryIntegrations.map((integration) => (
                <option key={integration.name} value={integration.name}>
                  {integration.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Remote repository</span>
            <select
              aria-describedby="repository-status"
              disabled={repositories.isLoading || Boolean(repositories.error)}
              onChange={(event) => setDraft({ ...draft, repository: event.target.value })}
              required
              value={draft.repository}
            >
              <option value="">Select a repository</option>
              {repositories.data?.items.map((repository) => (
                <option disabled={repository.isArchived} key={repository.externalId} value={repository.fullName}>
                  {repository.fullName}{repository.isArchived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Default agent</span>
            <select
              onChange={(event) => setDraft({
                ...draft,
                agent: event.target.value as ProjectDraft["agent"],
              })}
              value={draft.agent}
            >
              <option value="copilot">Copilot</option>
              <option value="codex">Codex</option>
            </select>
          </label>
          <label>
            <span>Runtime image</span>
            <input
              autoComplete="off"
              onChange={(event) => setDraft({
                ...draft,
                runtimeImage: event.target.value,
              })}
              required
              value={draft.runtimeImage}
            />
          </label>
        </div>
        <div className="projectFormFooter">
          <p aria-live="polite" className={notice ? "formNotice formError" : "formNotice"} id="repository-status">
            {notice
              ?? (repositories.isLoading
                ? "Loading remote repositories…"
                : repositories.error
                  ? repositories.error
                  : repositoryIdentifiers.length === 0
                    ? "No remote repositories are available from this Integration."
                    : `${repositoryIdentifiers.length} remote repositories available.`)}
          </p>
          <button className="primaryButton" disabled={!canSubmit} type="submit">
            {isSubmitting ? "Creating…" : "Create Project"}
          </button>
        </div>
      </form>
    </section>
  );
}
