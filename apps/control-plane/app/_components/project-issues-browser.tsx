"use client";

import type {
  GitHubIssueListResponse,
  LinearIssueListResponse,
  ProjectIssueSourcesResponse,
} from "@mystra/shared";
import { useEffect, useMemo, useState } from "react";

import { UiButton } from "./ui-actions";
import { UiInput, UiSelect } from "./ui-fields";
import { GitHubIssueTable, LinearIssueTable } from "./project-issue-tables";
import { ISSUE_COPY } from "./shell-copy";
import { useShellLocale } from "./shell-locale";

type Provider = "github" | "linear";
type Filters = Record<string, string>;
interface PageState { cursors: string[]; filters: Filters }

const initialGitHub: PageState = { cursors: [], filters: { state: "open", assignee: "", label: "", milestone: "" } };
const initialLinear: PageState = { cursors: [], filters: { status: "", priority: "", assignee: "", cycle: "" } };

function errorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: unknown };
    if (typeof error.message === "string") return error.message;
  }
  return `Request failed with status ${status}`;
}

export function ProjectIssuesBrowser({ projectSlug }: { projectSlug: string }) {
  const locale = useShellLocale();
  const copy = ISSUE_COPY[locale];
  const [provider, setProvider] = useState<Provider>("github");
  const [sources, setSources] = useState<ProjectIssueSourcesResponse | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [github, setGitHub] = useState<PageState>(initialGitHub);
  const [linear, setLinear] = useState<PageState>(initialLinear);
  const [githubData, setGitHubData] = useState<GitHubIssueListResponse | null>(null);
  const [linearData, setLinearData] = useState<LinearIssueListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const state = provider === "github" ? github : linear;
  const data = provider === "github" ? githubData : linearData;

  useEffect(() => {
    const controller = new AbortController();
    setSources(null);
    setSourceError(null);
    setGitHub(initialGitHub);
    setLinear(initialLinear);
    setGitHubData(null);
    setLinearData(null);
    void fetch(`/api/projects/${encodeURIComponent(projectSlug)}/issue-sources`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ProjectIssueSourcesResponse;
        if (!response.ok) throw new Error(errorMessage(payload, response.status));
        setSources(payload);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setSourceError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => controller.abort();
  }, [projectSlug, revision]);

  const requestUrl = useMemo(() => {
    if (!sources || (provider === "linear" && !sources.linear)) return null;
    const params = new URLSearchParams({ first: "25" });
    for (const [key, value] of Object.entries(state.filters)) if (value) params.set(key, value);
    const after = state.cursors.at(-1);
    if (after) params.set("after", after);
    return `/api/projects/${encodeURIComponent(projectSlug)}/issues/${provider}?${params}`;
  }, [projectSlug, provider, sources, state]);

  useEffect(() => {
    if (!requestUrl) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetch(requestUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as GitHubIssueListResponse | LinearIssueListResponse;
        if (!response.ok) throw new Error(errorMessage(payload, response.status));
        if (payload.provider === "github") setGitHubData(payload);
        else setLinearData(payload);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestUrl, revision]);

  function updateFilter(key: string, value: string) {
    const update = (current: PageState) => ({ filters: { ...current.filters, [key]: value }, cursors: [] });
    if (provider === "github") setGitHub(update);
    else setLinear(update);
  }

  function move(direction: "next" | "previous") {
    const cursor = data?.pageInfo.endCursor;
    const update = (current: PageState) => ({
      ...current,
      cursors: direction === "next" && cursor
        ? [...current.cursors, cursor]
        : current.cursors.slice(0, -1),
    });
    if (provider === "github") setGitHub(update);
    else setLinear(update);
  }

  function linkTask(externalId: string, taskId: string) {
    if (provider === "github") {
      setGitHubData((current) => current ? { ...current, items: current.items.map((item) => item.externalId === externalId ? { ...item, taskId } : item) } : current);
    } else {
      setLinearData((current) => current ? { ...current, items: current.items.map((item) => item.externalId === externalId ? { ...item, taskId } : item) } : current);
    }
  }

  if (sourceError) return <div className="issueState" role="alert"><strong>{copy.sourcesUnavailable}</strong><span>{sourceError}</span><UiButton tone="soft" onClick={() => setRevision((value) => value + 1)}>{copy.retry}</UiButton></div>;
  if (!sources) return <div className="issueState" role="status">{copy.loadingSources}</div>;

  const source = provider === "github" ? sources.github : sources.linear;
  const linearSource = sources.linear;
  return (
    <section aria-label="Project Issues" className="projectIssuesBrowser">
      <div aria-label="Issue provider" className="issueProviderTabs" role="tablist">
        <UiButton active={provider === "github"} aria-selected={provider === "github"} role="tab" onClick={() => setProvider("github")}>GitHub</UiButton>
        <UiButton active={provider === "linear"} aria-selected={provider === "linear"} role="tab" onClick={() => setProvider("linear")}>Linear</UiButton>
      </div>
      <div className="issueSourceLine">
        <strong>{provider === "github" ? `GitHub · ${sources.github.repositoryExternalId}` : linearSource ? `Linear · ${linearSource.team?.name ?? linearSource.linearTeamExternalId}` : "Linear · Not configured"}</strong>
        <span>{provider === "github" ? copy.derivedRepository : source ? copy.exactTeamScope : copy.noFallback}</span>
      </div>
      {!source ? (
        <div className="issueState"><strong>{copy.linearMissing}</strong><span>{copy.linearMissingHelp}</span></div>
      ) : source.availability === "unavailable" ? (
        <div className="issueState" role="alert"><strong>{copy.sourceUnavailable}</strong><span>{copy.sourceUnavailableHelp}</span></div>
      ) : (
        <>
          <div className="issueFilters">
            {provider === "github" ? (
              <>
                <UiSelect aria-label="GitHub state" value={github.filters.state} onChange={(event) => updateFilter("state", event.currentTarget.value)}><option value="open">{copy.open}</option><option value="closed">{copy.closed}</option><option value="all">{copy.allStates}</option></UiSelect>
                <UiInput aria-label="GitHub assignee" placeholder={copy.assignee} value={github.filters.assignee} onChange={(event) => updateFilter("assignee", event.currentTarget.value)} />
                <UiInput aria-label="GitHub label" placeholder={copy.label} value={github.filters.label} onChange={(event) => updateFilter("label", event.currentTarget.value)} />
                <UiInput aria-label="GitHub milestone" placeholder={copy.milestone} value={github.filters.milestone} onChange={(event) => updateFilter("milestone", event.currentTarget.value)} />
              </>
            ) : (
              <>
                <UiInput aria-label="Linear status ID" placeholder={copy.statusId} value={linear.filters.status} onChange={(event) => updateFilter("status", event.currentTarget.value)} />
                <UiSelect aria-label="Linear priority" value={linear.filters.priority} onChange={(event) => updateFilter("priority", event.currentTarget.value)}><option value="">{copy.allPriorities}</option><option value="0">{copy.noPriority}</option><option value="1">{copy.urgent}</option><option value="2">{copy.high}</option><option value="3">{copy.medium}</option><option value="4">{copy.low}</option></UiSelect>
                <UiInput aria-label="Linear assignee ID" placeholder={copy.assigneeId} value={linear.filters.assignee} onChange={(event) => updateFilter("assignee", event.currentTarget.value)} />
                <UiInput aria-label="Linear cycle ID" placeholder={copy.cycleId} value={linear.filters.cycle} onChange={(event) => updateFilter("cycle", event.currentTarget.value)} />
              </>
            )}
            <UiButton tone="soft" onClick={() => setRevision((value) => value + 1)}>{copy.refresh}</UiButton>
          </div>
          {loading ? <div className="issueState" role="status">{copy.loadingIssues}</div> : null}
          {error ? <div className="issueState" role="alert"><strong>{copy.loadFailed} · {provider}</strong><span>{error}</span></div> : null}
          {!loading && !error && data?.items.length === 0 ? <div className="issueState"><strong>{copy.noIssues}</strong><span>{copy.noIssuesHelp}</span></div> : null}
          {!loading && !error && data?.provider === "github" && data.items.length ? <GitHubIssueTable items={data.items} locale={locale} onTaskLinked={linkTask} projectSlug={projectSlug} /> : null}
          {!loading && !error && data?.provider === "linear" && data.items.length ? <LinearIssueTable items={data.items} locale={locale} onTaskLinked={linkTask} projectSlug={projectSlug} /> : null}
          {!loading && !error && data ? (
            <footer className="issuePager"><span>{copy.page} {state.cursors.length + 1} · {provider} {copy.cursorIndependent}</span><div><UiButton disabled={state.cursors.length === 0} tone="soft" onClick={() => move("previous")}>{copy.previous}</UiButton><UiButton disabled={!data.pageInfo.hasNextPage || !data.pageInfo.endCursor} tone="soft" onClick={() => move("next")}>{copy.next}</UiButton></div></footer>
          ) : null}
        </>
      )}
    </section>
  );
}
