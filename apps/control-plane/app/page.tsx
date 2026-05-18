"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  applyThemeToDocument,
  buildThemeSwatch,
  CONTROL_PLANE_THEMES,
  getDefaultTheme,
  getThemeById,
} from "./theme-system";

type AgentName = "codex" | "copilot";
type RunnerExecutor = "docker" | "fake";

interface PlatformCapabilitiesView {
  agents: AgentName[];
  executor: RunnerExecutor;
  image?: string;
}

interface TaskSnapshot {
  task: {
    id: string;
    spec: {
      taskId: string;
      repo: string;
      baseBranch: string;
      branchName: string;
      agent: AgentName;
      prompt: string;
      mergeRequest?: {
        title?: string;
        body?: string;
      };
    };
    createdAt: string;
    updatedAt: string;
  };
  run: {
    id: string;
    state: string;
    attempt: number;
    result?: {
      status: string;
      summary: string;
      branch?: string;
      mrUrl?: string;
      errorCode?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    };
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    finishedAt?: string;
  };
  events: Array<{
    timestamp: string;
    type: string;
    severity: string;
    data: Record<string, unknown>;
  }>;
  workflow?: {
    provider?: string;
    blueprintName?: string;
    blueprintVersion?: string;
    status: string;
    currentNodeId?: string;
    terminalNodeId?: string;
    startedAt: string;
    updatedAt: string;
    nodeExecutions: Array<{
      nodeId: string;
      handler: string;
      nodeKind: "deterministic" | "agentic";
      status: "running" | "succeeded" | "failed";
      startedAt: string;
      finishedAt?: string;
      data: Record<string, unknown>;
    }>;
  };
}

interface RunnerSession {
  id: string;
  runnerName: string;
  capabilities: PlatformCapabilitiesView;
  maxConcurrency: number;
  activeRunCount: number;
  lastHeartbeatAt: string;
  createdAt: string;
}

interface RunnerNode {
  name: string;
  capabilities: PlatformCapabilitiesView;
  sessionCount: number;
  activeRunCount: number;
  maxConcurrency: number;
  lastHeartbeatAt: string;
  firstSeenAt: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  repo: string;
  baseBranch: string;
  defaultAgent: AgentName;
  runtime: {
    provider: "docker";
    image: string;
    contextBundleRefs?: Array<{ slug: string }>;
    mounts?: unknown[];
    secretRefs?: unknown[];
  };
  prewarmConfig: Record<string, unknown>;
}

interface JobFormState {
  taskId: string;
  branchName: string;
  projectId: string;
  title: string;
  body: string;
  prompt: string;
}

const initialForm: JobFormState = {
  taskId: "manual-task",
  branchName: "mystra/manual-task",
  projectId: "",
  title: "Mystra manual task",
  body: "Created from Mystra control plane.",
  prompt: "",
};

const THEME_STORAGE_KEY = "mystra-control-plane-theme";
const DEFAULT_THEME = getDefaultTheme();

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function stateTone(state: string): string {
  if (["succeeded"].includes(state)) return "good";
  if (["failed", "canceled", "timed_out"].includes(state)) return "bad";
  if (["running", "starting", "assigned"].includes(state)) return "active";
  return "muted";
}

function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function heartbeatTone(value: string): string {
  const ageMs = Date.now() - new Date(value).getTime();
  if (ageMs <= 45_000) return "good";
  if (ageMs <= 120_000) return "active";
  return "bad";
}

function severityTone(value: string): string {
  if (["error", "critical"].includes(value)) return "bad";
  if (["warning", "warn"].includes(value)) return "warning";
  if (["info", "notice"].includes(value)) return "active";
  return "muted";
}

function workflowStatusTone(value: string): string {
  if (value === "succeeded") return "good";
  if (["failed", "canceled", "timed_out", "needs_human_review"].includes(value)) return "bad";
  if (value === "running") return "active";
  return "muted";
}

function eventSummary(data: Record<string, unknown>): string {
  const message = data.message;
  if (typeof message === "string" && message.trim()) return message;

  const summary = data.summary;
  if (typeof summary === "string" && summary.trim()) return summary;

  const errorMessage = data.errorMessage;
  if (typeof errorMessage === "string" && errorMessage.trim()) return errorMessage;

  const state = data.state;
  if (typeof state === "string" && state.trim()) return `State ${state}`;

  const keys = Object.keys(data);
  return keys.length > 0 ? `Fields: ${keys.join(", ")}` : "No additional data";
}

function workflowNodeTiming(execution: NonNullable<TaskSnapshot["workflow"]>["nodeExecutions"][number]): string {
  if (execution.finishedAt) {
    return `${relativeTime(execution.finishedAt)} · started ${relativeTime(execution.startedAt)}`;
  }
  return `Started ${relativeTime(execution.startedAt)}`;
}

function queueSummary(snapshot: TaskSnapshot): string {
  if (snapshot.run.result?.summary) {
    return snapshot.run.result.summary;
  }

  if (snapshot.run.result?.errorMessage) {
    return snapshot.run.result.errorMessage;
  }

  const latestEvent = snapshot.events.at(-1);
  if (latestEvent) {
    return eventSummary(latestEvent.data);
  }

  return `Attempt ${snapshot.run.attempt}`;
}

function runnerNodesFromSessions(sessions: RunnerSession[]): RunnerNode[] {
  const nodes = new Map<string, RunnerNode>();

  for (const session of sessions) {
    const existing = nodes.get(session.runnerName);
    if (!existing) {
      nodes.set(session.runnerName, {
        name: session.runnerName,
        capabilities: session.capabilities,
        sessionCount: 1,
        activeRunCount: session.activeRunCount,
        maxConcurrency: session.maxConcurrency,
        lastHeartbeatAt: session.lastHeartbeatAt,
        firstSeenAt: session.createdAt,
      });
      continue;
    }

    existing.sessionCount += 1;
    existing.activeRunCount += session.activeRunCount;
    existing.maxConcurrency += session.maxConcurrency;
    if (session.lastHeartbeatAt > existing.lastHeartbeatAt) {
      existing.lastHeartbeatAt = session.lastHeartbeatAt;
      existing.capabilities = session.capabilities;
    }
    if (session.createdAt < existing.firstSeenAt) {
      existing.firstSeenAt = session.createdAt;
    }
  }

  return [...nodes.values()].sort((a, b) => b.lastHeartbeatAt.localeCompare(a.lastHeartbeatAt));
}

export default function Page() {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME.id);
  const [jobs, setJobs] = useState<TaskSnapshot[]>([]);
  const [runners, setRunners] = useState<RunnerSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormState>(initialForm);
  const [notice, setNotice] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mcpResult, setMcpResult] = useState<string>("");

  const selectedJob = useMemo(
    () => jobs.find((snapshot) => snapshot.task.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId],
  );
  const runnerNodes = useMemo(() => runnerNodesFromSessions(runners), [runners]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? projects[0],
    [form.projectId, projects],
  );
  const activeTheme = useMemo(
    () => getThemeById(themeId) ?? DEFAULT_THEME,
    [themeId],
  );
  const jobSummary = useMemo(() => {
    return jobs.reduce(
      (summary, snapshot) => {
        const state = snapshot.run.state;
        if (["running", "starting", "assigned"].includes(state)) {
          summary.active += 1;
        } else if (state === "succeeded") {
          summary.succeeded += 1;
        } else if (["failed", "canceled", "timed_out"].includes(state)) {
          summary.failed += 1;
        } else {
          summary.queued += 1;
        }
        return summary;
      },
      { active: 0, queued: 0, succeeded: 0, failed: 0 },
    );
  }, [jobs]);
  const runnerSummary = useMemo(() => {
    return runnerNodes.reduce(
      (summary, node) => {
        const tone = heartbeatTone(node.lastHeartbeatAt);
        if (tone === "bad") {
          summary.stale += 1;
        } else {
          summary.online += 1;
        }
        if (node.activeRunCount > 0) {
          summary.busy += 1;
        }
        return summary;
      },
      { online: 0, busy: 0, stale: 0 },
    );
  }, [runnerNodes]);

  async function refresh() {
    const [jobsResponse, runnersResponse, projectsResponse] = await Promise.all([
      fetch("/api/tasks", { cache: "no-store" }),
      fetch("/api/runners", { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
    ]);

    if (jobsResponse.ok) {
      const payload = await jobsResponse.json() as { tasks: TaskSnapshot[] };
      setJobs(payload.tasks);
    }

    if (runnersResponse.ok) {
      const payload = await runnersResponse.json() as { runners: RunnerSession[] };
      setRunners(payload.runners);
    }

    if (projectsResponse.ok) {
      const payload = await projectsResponse.json() as { projects: Project[] };
      setProjects(payload.projects);
      const [firstProject] = payload.projects;
      setForm((current) => current.projectId || !firstProject
        ? current
        : { ...current, projectId: firstProject.id });
    }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && getThemeById(savedTheme)) {
      setThemeId(savedTheme);
    }
  }, []);

  useEffect(() => {
    applyThemeToDocument(activeTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, activeTheme.id);
  }, [activeTheme]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");

    try {
      const projectId = form.projectId || selectedProject?.id;
      if (!projectId) {
        throw new Error("Create a Project before submitting a task");
      }
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: form.taskId,
          source: "api",
          projectId,
          branchName: form.branchName,
          prompt: form.prompt,
          mergeRequest: {
            title: form.title,
            body: form.body,
          },
        }),
      });
      const payload = await response.json() as TaskSnapshot | { error: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : `HTTP ${response.status}`);
      }
      if (!("task" in payload)) {
        throw new Error("Create task returned an invalid response");
      }
      setSelectedJobId(payload.task.id);
      setNotice(`Created task ${payload.task.spec.taskId}`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function cancelTask(taskId: string) {
    const response = await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
    if (!response.ok) {
      setNotice(`Cancel failed: ${response.status}`);
      return;
    }
    setNotice(`Cancel requested for ${taskId}`);
    await refresh();
  }

  async function callMcpListTools() {
    const response = await fetch("/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "ui-tools-list",
        method: "tools/list",
      }),
    });
    setMcpResult(jsonPreview(await response.json()));
  }

  return (
    <main className="shell">
      <aside className="rail">
        <div className="railBrand">
          <p className="eyebrow">Mystra</p>
          <h1>Control Plane</h1>
          <p className="sectionCopy">
            Compact operations workbench for tasks, runner capacity, and MCP access.
          </p>
        </div>

        <nav className="railNav" aria-label="Control plane modules">
          <a className="railLink" href="#tasks">
            <strong>Tasks</strong>
            <span>{jobs.length} tasks in view</span>
          </a>
          <a className="railLink" href="#projects">
            <strong>Projects</strong>
            <span>{projects.length} configured</span>
          </a>
          <a className="railLink" href="#runners">
            <strong>Nodes</strong>
            <span>{runnerNodes.length} runner nodes</span>
          </a>
          <a className="railLink" href="#mcp">
            <strong>MCP</strong>
            <span>Endpoint and tools/list</span>
          </a>
        </nav>

        <section className="railSection" aria-labelledby="theme-system-heading">
          <div className="railSectionHeader">
            <p className="eyebrow">Theme system</p>
            <h2 id="theme-system-heading">Token moods</h2>
            <p className="sectionCopy">
              Keep the same control-plane structure while changing the atmosphere.
            </p>
          </div>
          <div className="themePicker" role="radiogroup" aria-label="Control plane theme">
            {CONTROL_PLANE_THEMES.map((option) => (
              <button
                key={option.id}
                aria-checked={option.id === activeTheme.id}
                className={`themeOption ${option.id === activeTheme.id ? "selected" : ""}`}
                role="radio"
                type="button"
                onClick={() => setThemeId(option.id)}
              >
                <span
                  aria-hidden="true"
                  className="themeSwatch"
                  style={{ background: buildThemeSwatch(option) }}
                />
                <span className="themeMeta">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="railStatus">
          <span className="pill active">live</span>
          <span>Refresh every 3s</span>
          <span className="subtleText">Theme {activeTheme.label}</span>
        </div>
        <div className="statusGrid" aria-label="Rail summaries">
          <div className="statusTile">
            <span>running</span>
            <strong>{jobSummary.active}</strong>
          </div>
          <div className="statusTile">
            <span>projects</span>
            <strong>{projects.length}</strong>
          </div>
          <div className="statusTile bad">
            <span>failed</span>
            <strong>{jobSummary.failed}</strong>
          </div>
          <div className="statusTile good">
            <span>online</span>
            <strong>{runnerSummary.online}</strong>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspaceHeader">
          <div>
            <p className="eyebrow">Workbench</p>
            <h2>Operational overview</h2>
            <p className="sectionCopy">
              Create tasks, inspect run state, watch runner nodes, and query MCP tools without leaving the queue.
            </p>
          </div>
          <div className="toolbar">
            <span className="pill">{activeTheme.label}</span>
            <span className="pill active">{jobSummary.active} running</span>
            <span className={`pill ${runnerSummary.stale > 0 ? "bad" : "good"}`}>
              {runnerSummary.online} online
            </span>
            <button className="secondaryButton" type="button" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
        </header>

        <section className="statusStrip" aria-label="Live control plane summary">
          <article className="statusTile active">
            <span>running</span>
            <strong>{jobSummary.active}</strong>
          </article>
          <article className="statusTile">
            <span>queued</span>
            <strong>{jobSummary.queued}</strong>
          </article>
          <article className="statusTile good">
            <span>succeeded</span>
            <strong>{jobSummary.succeeded}</strong>
          </article>
          <article className="statusTile bad">
            <span>failed</span>
            <strong>{jobSummary.failed}</strong>
          </article>
          <article className={`statusTile ${runnerSummary.stale > 0 ? "warning" : "good"}`}>
            <span>nodes</span>
            <strong>{runnerSummary.online}</strong>
            <em>{runnerSummary.busy} busy / {runnerSummary.stale} stale</em>
          </article>
        </section>

        {notice ? <div className="notice" role="status">{notice}</div> : null}

        <section className="module" id="projects">
          <div className="moduleHeader">
            <div>
              <p className="eyebrow">Projects</p>
              <h3>Project configuration</h3>
              <p className="sectionCopy">
                Tasks inherit repository, default branch, default agent, and runtime image from Projects.
              </p>
            </div>
            <span className="counter">{projects.length}</span>
          </div>
          <div className="projectGrid">
            {projects.length === 0 ? <p className="empty">No Projects configured.</p> : null}
            {projects.map((project) => (
              <article className="projectCard" key={project.id}>
                <div className="projectCardHeader">
                  <div>
                    <h4>{project.name}</h4>
                    <p className="subtleText">{project.slug}</p>
                  </div>
                  <span className="pill active">{project.defaultAgent}</span>
                </div>
                <div className="detailGrid">
                  <div className="kv"><span>Repo</span><strong>{project.repo}</strong></div>
                  <div className="kv"><span>Base</span><strong>{project.baseBranch}</strong></div>
                  <div className="kv"><span>Provider</span><strong>{project.runtime.provider}</strong></div>
                  <div className="kv"><span>Image</span><strong>{project.runtime.image}</strong></div>
                  <div className="kv"><span>Runtime</span><strong>{project.runtime.contextBundleRefs?.length ?? 0} ctx / {project.runtime.mounts?.length ?? 0} mounts</strong></div>
                  <div className="kv"><span>Prewarm</span><strong>{Object.keys(project.prewarmConfig).length} fields</strong></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="module" id="tasks">
          <div className="moduleHeader">
            <div>
              <p className="eyebrow">Tasks</p>
              <h3>Task queue and execution detail</h3>
              <p className="sectionCopy">
                Submit new work, scan queue state, and inspect the current task record.
              </p>
            </div>
          </div>

          <div className="jobsLayout">
            <section className="pane">
              <div className="paneHeader">
                <div>
                  <h4>Create task</h4>
                  <p className="subtleText">Tasks resolve repo, base branch, agent, and image from the selected Project.</p>
                </div>
                <span className="counter">{jobs.length}</span>
              </div>
              <form className="jobForm" onSubmit={(event) => void createTask(event)}>
                <label>
                  Task ID
                  <input
                    value={form.taskId}
                    onChange={(event) => setForm({ ...form, taskId: event.target.value })}
                  />
                </label>
                <label className="span2">
                  Project
                  <select
                    value={form.projectId || (selectedProject?.id ?? "")}
                    onChange={(event) => setForm({ ...form, projectId: event.target.value })}
                  >
                    {projects.length === 0 ? <option value="">No Projects</option> : null}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name} / {project.slug}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedProject ? (
                  <div className="projectSummary span2">
                    <div><span>Repo</span><strong>{selectedProject.repo}</strong></div>
                    <div><span>Base</span><strong>{selectedProject.baseBranch}</strong></div>
                    <div><span>Agent</span><strong>{selectedProject.defaultAgent}</strong></div>
                    <div><span>Provider</span><strong>{selectedProject.runtime.provider}</strong></div>
                    <div><span>Image</span><strong>{selectedProject.runtime.image}</strong></div>
                    <div><span>Runtime</span><strong>{selectedProject.runtime.contextBundleRefs?.length ?? 0} ctx / {selectedProject.runtime.mounts?.length ?? 0} mounts</strong></div>
                  </div>
                ) : null}
                <label className="span2">
                  Task branch
                  <input
                    value={form.branchName}
                    onChange={(event) => setForm({ ...form, branchName: event.target.value })}
                  />
                </label>
                <label className="span2">
                  MR title
                  <input
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </label>
                <label className="span2">
                  MR body
                  <textarea
                    rows={3}
                    value={form.body}
                    onChange={(event) => setForm({ ...form, body: event.target.value })}
                  />
                </label>
                <label className="span2">
                  Prompt
                  <textarea
                    rows={8}
                    placeholder="Describe the implementation task for the agent."
                    value={form.prompt}
                    onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                  />
                </label>
                <div className="formActions span2">
                  <button className="primaryButton" disabled={isSubmitting || projects.length === 0} type="submit">
                    {isSubmitting ? "Creating..." : "Create task"}
                  </button>
                </div>
              </form>
            </section>

            <section className="pane">
              <div className="paneHeader">
                <div>
                  <h4>Queue</h4>
                  <p className="subtleText">Recent tasks stay selectable, but now scan like an operator queue.</p>
                </div>
              </div>
              <div className="queueTable">
                {jobs.length > 0 ? (
                  <div className="queueHeader" aria-hidden="true">
                    <span>Task</span>
                    <span>State</span>
                    <span>Branch</span>
                    <span>Updated</span>
                  </div>
                ) : null}
                <div className="list">
                  {jobs.length === 0 ? <p className="empty">No tasks yet.</p> : null}
                  {jobs.map((snapshot) => (
                    <button
                      aria-pressed={snapshot.task.id === selectedJob?.task.id}
                      className={`listItem queueRow ${snapshot.task.id === selectedJob?.task.id ? "selected" : ""}`}
                      key={snapshot.task.id}
                      type="button"
                      onClick={() => setSelectedJobId(snapshot.task.id)}
                    >
                      <span className="queueCell queuePrimary">
                        <span className="itemTitle">{snapshot.task.spec.taskId}</span>
                        <span className="itemMeta">
                          {snapshot.task.spec.agent} / attempt {snapshot.run.attempt}
                        </span>
                        <span className="queueSummary">{queueSummary(snapshot)}</span>
                      </span>
                      <span className="queueCell queueState">
                        <span className={`pill ${stateTone(snapshot.run.state)}`}>{snapshot.run.state}</span>
                      </span>
                      <span className="queueCell queueBranch">
                        <span className="branchValue">{snapshot.task.spec.branchName}</span>
                        <span className="itemMeta">{snapshot.task.spec.baseBranch}</span>
                      </span>
                      <span className="queueCell queueUpdated">
                        <span className="timeValue">{relativeTime(snapshot.run.updatedAt)}</span>
                        <span className="itemMeta">{snapshot.run.result?.status ?? "pending"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="pane">
              <div className="paneHeader">
                <div>
                  <h4>Selected task</h4>
                  <p className="subtleText">Run state, merge request, and latest structured payload.</p>
                </div>
                <div className="paneActions">
                  {selectedJob ? (
                    <button
                      className="dangerButton"
                      type="button"
                      onClick={() => void cancelTask(selectedJob.task.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedJob ? (
                <div className="details">
                  <div className="detailsHeader">
                    <span className={`pill ${stateTone(selectedJob.run.state)}`}>{selectedJob.run.state}</span>
                    <span className="subtleText">Updated {relativeTime(selectedJob.run.updatedAt)}</span>
                  </div>
                  <div className="detailGrid">
                    <div className="kv"><span>Task</span><strong>{selectedJob.task.spec.taskId}</strong></div>
                    <div className="kv"><span>Agent</span><strong>{selectedJob.task.spec.agent}</strong></div>
                    <div className="kv"><span>Repo</span><strong>{selectedJob.task.spec.repo}</strong></div>
                    <div className="kv"><span>Base</span><strong>{selectedJob.task.spec.baseBranch}</strong></div>
                    <div className="kv"><span>Branch</span><strong>{selectedJob.task.spec.branchName}</strong></div>
                    <div className="kv"><span>Created</span><strong>{relativeTime(selectedJob.task.createdAt)}</strong></div>
                  </div>
                  {selectedJob.run.result?.summary ? (
                    <p className="summaryBlock">{selectedJob.run.result.summary}</p>
                  ) : null}
                  {selectedJob.run.result?.mrUrl ? (
                    <a className="linkButton" href={selectedJob.run.result.mrUrl} target="_blank" rel="noreferrer">
                      Open merge request
                    </a>
                  ) : null}
                  {selectedJob.workflow ? (
                    <section className="detailSection" aria-labelledby="workflow-execution-heading">
                      <div className="sectionHeader">
                        <h4 id="workflow-execution-heading">Workflow execution</h4>
                        <span className="counter">{selectedJob.workflow.nodeExecutions.length}</span>
                      </div>
                      <div className="detailGrid">
                        <div className="kv"><span>Provider</span><strong>{selectedJob.workflow.provider ?? "—"}</strong></div>
                        <div className="kv"><span>Blueprint</span><strong>{selectedJob.workflow.blueprintName ?? "—"}</strong></div>
                        <div className="kv"><span>Version</span><strong>{selectedJob.workflow.blueprintVersion ?? "—"}</strong></div>
                        <div className="kv"><span>Status</span><strong>{selectedJob.workflow.status}</strong></div>
                        <div className="kv"><span>Current node</span><strong>{selectedJob.workflow.currentNodeId ?? "—"}</strong></div>
                        <div className="kv"><span>Terminal node</span><strong>{selectedJob.workflow.terminalNodeId ?? "—"}</strong></div>
                        <div className="kv"><span>Updated</span><strong>{relativeTime(selectedJob.workflow.updatedAt)}</strong></div>
                      </div>
                      <div className="workflowList" role="list" aria-label="Workflow node executions">
                        {selectedJob.workflow.nodeExecutions.length > 0 ? selectedJob.workflow.nodeExecutions.map((execution) => (
                          <article className="workflowRow" key={`${execution.nodeId}-${execution.startedAt}`} role="listitem">
                            <div className="workflowRowHeader">
                              <div className="workflowPrimary">
                                <strong>{execution.nodeId}</strong>
                                <span>{execution.handler}</span>
                              </div>
                              <div className="workflowBadges">
                                <span className={`pill ${workflowStatusTone(execution.status)}`}>{execution.status}</span>
                                <span className="pill">{execution.nodeKind}</span>
                              </div>
                            </div>
                            <p className="workflowSummary">{eventSummary(execution.data)}</p>
                            <div className="workflowMeta">
                              <span>{workflowNodeTiming(execution)}</span>
                            </div>
                          </article>
                        )) : <p className="empty detailEmpty">Workflow metadata recorded; node execution has not started yet.</p>}
                      </div>
                    </section>
                  ) : null}
                  <section className="detailSection">
                    <div className="sectionHeader">
                      <h4>Recent events</h4>
                      <span className="counter">{selectedJob.events.length}</span>
                    </div>
                    {selectedJob.events.length > 0 ? (
                      <div className="eventList">
                        {selectedJob.events.slice(-6).reverse().map((event) => (
                          <div className="eventRow" key={`${event.timestamp}-${event.type}`}>
                            <span className={`pill ${severityTone(event.severity)}`}>{event.severity}</span>
                            <div className="eventBody">
                              <strong>{event.type}</strong>
                              <span>{eventSummary(event.data)}</span>
                            </div>
                            <span className="subtleText">{relativeTime(event.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty detailEmpty">No events recorded.</p>
                    )}
                  </section>
                  <pre className="jsonBlock">{jsonPreview(selectedJob.run.result ?? selectedJob.events.at(-1) ?? selectedJob)}</pre>
                </div>
              ) : (
                <p className="empty">Select a task to inspect it.</p>
              )}
            </section>
          </div>
        </section>

        <section className="module" id="runners">
          <div className="moduleHeader">
            <div>
              <p className="eyebrow">Nodes</p>
              <h3>Runner nodes</h3>
              <p className="sectionCopy">
                Sessions are aggregated into runner nodes so capacity and heartbeat stay readable.
              </p>
            </div>
            <span className="counter">{runnerNodes.length}</span>
          </div>
          <div className="stack">
            {runnerNodes.length === 0 ? <p className="empty">No runner nodes registered.</p> : null}
            {runnerNodes.map((node) => {
              const tone = heartbeatTone(node.lastHeartbeatAt);
              return (
                <article className="runnerRow" key={node.name}>
                  <div className="runnerSummary">
                    <div>
                      <h4>{node.name}</h4>
                      <p className="subtleText">Last heartbeat {relativeTime(node.lastHeartbeatAt)}</p>
                    </div>
                    <span className={`pill ${tone}`}>{tone === "bad" ? "stale" : "online"}</span>
                  </div>
                  <div className="runnerStats">
                    <div className="stat"><span>Capacity</span><strong>{node.activeRunCount}/{node.maxConcurrency}</strong></div>
                    <div className="stat"><span>Sessions</span><strong>{node.sessionCount}</strong></div>
                    <div className="stat"><span>First seen</span><strong>{relativeTime(node.firstSeenAt)}</strong></div>
                    <div className="stat"><span>Heartbeat</span><strong>{relativeTime(node.lastHeartbeatAt)}</strong></div>
                  </div>
                  <pre className="jsonBlock small">{jsonPreview(node.capabilities)}</pre>
                </article>
              );
            })}
          </div>
        </section>

        <section className="module" id="mcp">
          <div className="moduleHeader">
            <div>
              <p className="eyebrow">MCP</p>
              <h3>Streamable HTTP endpoint</h3>
              <p className="sectionCopy">Keep endpoint details and tools/list output reachable from the same workbench.</p>
            </div>
            <button className="secondaryButton" type="button" onClick={() => void callMcpListTools()}>
              List tools
            </button>
          </div>
          <div className="mcpLayout">
            <section className="pane">
              <div className="paneHeader">
                <div>
                  <h4>Endpoint</h4>
                  <p className="subtleText">Available over /api/mcp.</p>
                </div>
              </div>
              <div className="detailGrid">
                <div className="kv"><span>Transport</span><strong>Streamable HTTP</strong></div>
                <div className="kv"><span>Path</span><strong>/api/mcp</strong></div>
              </div>
              <div className="toolList">
                <span>mystra_create_task</span>
                <span>mystra_create_project</span>
                <span>mystra_list_projects</span>
                <span>mystra_get_project</span>
                <span>mystra_get_task</span>
                <span>mystra_cancel_task</span>
                <span>mystra_list_runners</span>
              </div>
            </section>
            <section className="pane">
              <div className="paneHeader">
                <div>
                  <h4>tools/list response</h4>
                  <p className="subtleText">On-demand JSON preview from the MCP endpoint.</p>
                </div>
              </div>
              <pre className="jsonBlock">{mcpResult || "Click List tools to call the MCP endpoint."}</pre>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
