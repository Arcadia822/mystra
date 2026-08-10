"use client";

import type { Project, ProjectRepositoryBranchPage } from "@mystra/shared";
import { useEffect, useState } from "react";

import { SettingGroup, SettingRow } from "./setting-row";
import { UiButton } from "./ui-actions";
import { UiInput, UiSelect } from "./ui-fields";
import {
  branchReadFailed,
  branchReadLoaded,
  createProjectRepositorySettingsModel,
  validateProjectRepositoryBaseBranch,
} from "./project-repository-settings-model";

export function ProjectRepositorySettings({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => Promise<void>;
}) {
  const [model, setModel] = useState(() => createProjectRepositorySettingsModel(project.repositoryBaseBranch));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const validation = validateProjectRepositoryBaseBranch(model.value);

  async function refreshBranches() {
    setModel((current) => ({ ...current, mode: "loading", readError: null }));
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project.slug)}/repository/branches?first=100`,
        { cache: "no-store" },
      );
      const payload = await response.json() as ProjectRepositoryBranchPage & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Branch read failed (${response.status})`);
      setModel((current) => branchReadLoaded(current, payload));
    } catch (error) {
      setModel((current) => branchReadFailed(
        current,
        error instanceof Error ? error.message : String(error),
      ));
    }
  }

  useEffect(() => {
    setModel(createProjectRepositorySettingsModel(project.repositoryBaseBranch));
    void refreshBranches();
  // Project identity/config changes intentionally reset the editor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.repositoryBaseBranch]);

  async function save() {
    if (validation) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryBaseBranch: model.value }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Save failed (${response.status})`);
      setStatus("Repository base branch saved.");
      await onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const configuredMissing = model.mode === "picker"
    && !model.branches.some((branch) => branch.name === model.value);
  return (
    <div className="projectRepositorySettings">
      <SettingGroup aria-label="Repository settings">
        <SettingRow
          title="Repository base branch"
          description="Ordinary Project configuration. Remote HEAD is an observation only and never overwrites this value."
          control={model.mode === "picker" ? (
            <UiSelect
              disabled={busy}
              value={model.value}
              onChange={(event) => setModel({ ...model, value: event.currentTarget.value })}
            >
              {configuredMissing ? <option value={model.value}>{model.value} · configured</option> : null}
              {model.branches.map((branch) => <option key={branch.ref} value={branch.name}>{branch.name}</option>)}
            </UiSelect>
          ) : (
            <UiInput
              disabled={busy}
              value={model.value}
              onChange={(event) => setModel({ ...model, value: event.currentTarget.value })}
            />
          )}
        >
          <p className="repositoryBranchHint">
            {model.mode === "loading"
              ? "Reading remote branches…"
              : model.readError
                ? `${model.readError} Text entry remains available.`
                : `Observed symbolic HEAD: ${model.observedHead ?? "none"}`}
          </p>
        </SettingRow>
      </SettingGroup>
      <div className="projectSourceActions">
        <UiButton disabled={model.mode === "loading" || busy} onClick={() => void refreshBranches()}>Refresh branches</UiButton>
        <UiButton disabled={busy || Boolean(validation) || model.value === project.repositoryBaseBranch} tone="solid" onClick={() => void save()}>
          {busy ? "Saving…" : "Save branch"}
        </UiButton>
      </div>
      {validation ? <p className="formNotice formError">{validation}</p> : null}
      {status ? <p aria-live="polite" className="formNotice">{status}</p> : null}
    </div>
  );
}
