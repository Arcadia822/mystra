"use client";

import { useMemo, useState, type FormEvent } from "react";

import type { Issue, JobSnapshot, Project } from "../_lib/types";
import { useResource } from "../_lib/use-resource";
import { StatusBadge } from "../_components/status-badge";

export function IssueDispatchPanel({ onDispatched }: { onDispatched: (snapshot: JobSnapshot) => void }) {
  const projects = useResource<{ projects: Project[] }>("/api/projects");
  const [integration, setIntegration] = useState("linear");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIdentifier, setSelectedIdentifier] = useState("");
  const [projectId, setProjectId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  const effectiveProjectId = projectId || projects.data?.projects[0]?.id || "";
  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.reference.identifier === selectedIdentifier),
    [issues, selectedIdentifier],
  );

  async function loadIssues() {
    setIsLoadingIssues(true);
    setNotice("");
    try {
      const response = await fetch(`/api/integrations/${encodeURIComponent(integration)}/issues?limit=25`, { cache: "no-store" });
      const payload = await response.json() as { items?: Issue[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      setIssues(payload.items ?? []);
      setNotice(payload.items?.length ? "Issues loaded. Select one to dispatch." : "No issues returned.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingIssues(false);
    }
  }

  function selectIssue(identifier: string) {
    setSelectedIdentifier(identifier);
    setBranchName(`codex/${identifier.toLowerCase().replaceAll(/[^a-z0-9-]/g, "-")}`);
  }

  async function dispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIdentifier || !effectiveProjectId || !branchName) {
      setNotice("Issue, Project and branch are required.");
      return;
    }
    setIsDispatching(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/integrations/${encodeURIComponent(integration)}/issues/${encodeURIComponent(selectedIdentifier)}/dispatch`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: effectiveProjectId,
            agent: "copilot",
            branchName,
          }),
        },
      );
      const payload = await response.json() as JobSnapshot | { error?: { message?: string } };
      if (!response.ok || !("job" in payload)) {
        throw new Error("error" in payload ? payload.error?.message ?? `HTTP ${response.status}` : "Invalid dispatch response");
      }
      setNotice(`Dispatched ${payload.job.spec.taskId}.`);
      onDispatched(payload);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDispatching(false);
    }
  }

  return (
    <details className="panel dispatchPanel">
      <summary>Dispatch from Issue</summary>
      <div className="dispatchBody">
        <p className="pageDescription">Issues are loaded only when requested. Opening this panel does not contact Linear.</p>
        <div className="inlineForm">
          <label><span>Integration</span><input value={integration} onChange={(event) => setIntegration(event.target.value)} /></label>
          <button className="secondaryButton" disabled={isLoadingIssues} type="button" onClick={() => void loadIssues()}>
            {isLoadingIssues ? "Loading…" : "Load issues"}
          </button>
        </div>
        {issues.length ? (
          <div className="issuePicker" role="listbox" aria-label="Issues">
            {issues.map((issue) => (
              <button
                aria-selected={selectedIdentifier === issue.reference.identifier}
                className={selectedIdentifier === issue.reference.identifier ? "selected" : ""}
                key={issue.reference.identifier}
                role="option"
                type="button"
                onClick={() => selectIssue(issue.reference.identifier)}
              >
                <span><strong>{issue.reference.identifier}</strong><small>{issue.title}</small></span>
                <StatusBadge state={issue.state.name} tone="muted" />
              </button>
            ))}
          </div>
        ) : null}
        {selectedIssue ? (
          <form className="dispatchForm" onSubmit={(event) => void dispatch(event)}>
            <label><span>Project</span>
              <select value={effectiveProjectId} onChange={(event) => setProjectId(event.target.value)}>
                {projects.data?.projects.map((project) => <option key={project.id} value={project.id}>{project.slug}</option>)}
              </select>
            </label>
            <label><span>Agent</span><input disabled value="copilot" /></label>
            <label className="wideField"><span>Branch</span><input value={branchName} onChange={(event) => setBranchName(event.target.value)} /></label>
            <button className="primaryButton" disabled={isDispatching || !effectiveProjectId} type="submit">
              {isDispatching ? "Dispatching…" : `Dispatch ${selectedIssue.reference.identifier}`}
            </button>
          </form>
        ) : null}
        {notice ? <p aria-live="polite" className="formNotice">{notice}</p> : null}
      </div>
    </details>
  );
}
