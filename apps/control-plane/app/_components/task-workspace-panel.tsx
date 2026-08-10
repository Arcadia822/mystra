"use client";

import type { RuntimeView, Task, TaskWorkspaceView } from "@mystra/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { taskWorkspacePresentation } from "./task-workspace-model";
import { UiButton } from "./ui-actions";
import { UiSelect } from "./ui-fields";

type WorkspaceResponse = { workspace: TaskWorkspaceView };
type WorkspaceLoad = {
  state: "loading" | "absent" | "loaded" | "error";
  workspace?: TaskWorkspaceView;
  error?: string;
};

export function TaskWorkspacePanel({ task }: { task: Task }) {
  const runtimes = useResource<{ runtimes: RuntimeView[] }>("/api/runtimes", 5_000);
  const [load, setLoad] = useState<WorkspaceLoad>({ state: "loading" });
  const [selectedRuntimeId, setSelectedRuntimeId] = useState("");
  const [busy, setBusy] = useState(false);
  const eligibleRuntimes = useMemo(() => (runtimes.data?.runtimes ?? []).filter((runtime) => (
    runtime.status === "online"
    && runtime.metadata.workspaceMaterialization.kinds.includes("task-repository")
    && runtime.metadata.workspaceMaterialization.sharingModes.includes("shared-mutable")
  )), [runtimes.data?.runtimes]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/workspace`, { cache: "no-store" });
      const payload = await response.json() as WorkspaceResponse & { error?: { code?: string; message?: string } };
      if (response.status === 404 && payload.error?.code === "workspace_missing") {
        setLoad({ state: "absent" });
        return;
      }
      if (!response.ok) throw new Error(payload.error?.message ?? `Workspace read failed (${response.status})`);
      setLoad({ state: "loaded", workspace: payload.workspace });
    } catch (error) {
      setLoad({ state: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }, [task.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!selectedRuntimeId && eligibleRuntimes[0]) setSelectedRuntimeId(eligibleRuntimes[0].id);
  }, [eligibleRuntimes, selectedRuntimeId]);
  useEffect(() => {
    const workspace = load.workspace;
    if (!workspace || (workspace.state !== "queued" && workspace.state !== "preparing")) return;
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [load.workspace, refresh]);

  const workspace = load.workspace;
  const presentation = taskWorkspacePresentation(workspace, task.projectId !== null);
  const runtimeId = workspace?.runtimeId ?? selectedRuntimeId;

  async function setup() {
    if (!runtimeId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/workspace`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runtimeId, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json() as WorkspaceResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Workspace setup failed (${response.status})`);
      setLoad({ state: "loaded", workspace: payload.workspace });
    } catch (error) {
      setLoad({ state: "error", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel taskWorkspacePanel" aria-labelledby="task-workspace-heading">
      <div className="panelHeader">
        <div><h2 id="task-workspace-heading">Workspace</h2><span>One shared mutable directory for every Session of this Task.</span></div>
        <span className={`statusBadge ${workspace?.state === "ready" ? "good" : workspace?.failure ? "bad" : ""}`}>
          {load.state === "loading" ? "loading" : presentation.state}
        </span>
      </div>
      <div className="taskWorkspaceBody">
        {load.state === "error" ? <p className="formError">{load.error}</p> : null}
        {!workspace ? (
          <label className="taskWorkspaceRuntime">Runtime
            <UiSelect
              disabled={busy || !presentation.canSetup || eligibleRuntimes.length === 0}
              value={selectedRuntimeId}
              onChange={(event) => setSelectedRuntimeId(event.currentTarget.value)}
            >
              {eligibleRuntimes.length === 0 ? <option value="">No eligible online Runtime</option> : null}
              {eligibleRuntimes.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.name}</option>)}
            </UiSelect>
          </label>
        ) : (
          <dl className="definitionList">
            <div><dt>Runtime · locked</dt><dd className="mono">{workspace.runtimeId}</dd></div>
            <div><dt>Configured base</dt><dd className="mono">{workspace.configuredBaseBranch}</dd></div>
            <div><dt>Exact base commit</dt><dd className="mono">{workspace.baseCommit}</dd></div>
            <div><dt>Working branch</dt><dd className="mono">{workspace.branchName}</dd></div>
            <div><dt>Sharing</dt><dd>{workspace.sharingMode}</dd></div>
          </dl>
        )}
        {presentation.reason ? <p className="formNotice formError">{workspace?.failure?.message ?? presentation.reason}</p> : null}
        {presentation.canStartSession ? <p className="formNotice">Ready for Task Session attachment. Session creation is implemented by feature 049.</p> : null}
        <div className="taskWorkspaceActions">
          <UiButton disabled={busy} onClick={() => void refresh()}>Refresh</UiButton>
          <UiButton
            disabled={busy || (!presentation.canSetup && !presentation.canRetry) || !runtimeId}
            tone="solid"
            onClick={() => void setup()}
          >
            {busy ? "Submitting…" : presentation.canRetry ? "Retry setup" : "Setup Workspace"}
          </UiButton>
        </div>
      </div>
    </section>
  );
}
