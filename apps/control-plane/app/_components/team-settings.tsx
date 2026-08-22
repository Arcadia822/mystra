"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { TeamListItem } from "@mystra/shared";

import { controlPlaneRequest, ControlPlaneApiError } from "../_lib/control-plane-api";
import { useResource } from "../_lib/use-resource";
import { UiButton } from "./ui-actions";
import { UiInput } from "./ui-fields";
import { SettingGroup, SettingRow } from "./setting-row";

export function TeamSettings({
  embedded = false,
  onOpenMembers,
}: {
  embedded?: boolean;
  onOpenMembers?: () => void;
}) {
  const teams = useResource<{ teams: TeamListItem[] }>("/api/teams");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<TeamListItem | null>(null);
  const active = teams.data?.teams.find((team) => team.isActive);

  useEffect(() => {
    if (!archiving) return;
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
  }, [archiving]);
  useEffect(() => headingRef.current?.focus(), []);

  async function create(formData: FormData) {
    await mutate("/api/teams", "POST", { displayName: formData.get("displayName") }, async (body) => {
      await controlPlaneRequest("/api/teams/switch", { body: JSON.stringify({ teamId: body.team.id }), method: "POST" });
    });
  }

  async function rename(formData: FormData) {
    if (!active) return;
    await mutate(`/api/teams/${active.id}`, "PATCH", { displayName: formData.get("displayName") });
  }

  async function archive() {
    if (!archiving) return;
    await mutate(`/api/teams/${archiving.id}`, "DELETE");
    dialogRef.current?.close();
    setArchiving(null);
  }

  async function mutate(url: string, method: string, body?: unknown, after?: (body: { team: TeamListItem }) => Promise<void>) {
    setStatus(null);
    try {
      const response = await controlPlaneRequest<{ team: TeamListItem }>(url, body ? { body: JSON.stringify(body), method } : { method });
      await after?.(response);
      setStatus(method === "DELETE" ? "Team archived." : "Team saved.");
      await teams.refresh();
    } catch (caught) {
      setStatus(caught instanceof ControlPlaneApiError ? caught.message : "Unable to save the Team.");
    }
  }

  const content = <>
      {teams.isLoading ? <p aria-busy="true" className="statePanel">Loading Teams…</p> : null}
      {teams.error ? <p className="statePanel errorState" role="alert">{teams.error}</p> : null}
      {!teams.isLoading && !teams.error && teams.data?.teams.length === 0 ? <p className="statePanel">No active Teams are available.</p> : null}
      <SettingGroup aria-label="Your Teams">
        <SettingRow description="Switch the Team context used by the control plane." title="Your Teams">
          <ul className="teamList">
            {(teams.data?.teams ?? []).map((team) => <li key={team.id}><span><strong>{team.displayName}</strong><small>{team.currentUserRole}{team.isActive ? " · active" : ""}</small></span><UiButton disabled={team.isActive} size="compact" onClick={() => void mutate("/api/teams/switch", "POST", { teamId: team.id })}>Switch</UiButton></li>)}
          </ul>
        </SettingRow>
      </SettingGroup>
      <SettingGroup aria-label="Create Team">
        <form action={create} className="settingsTabForm"><SettingRow control={<UiInput fieldSize="default" name="displayName" required />} description="A new Team starts with you as its Owner." title="Team name" /><div className="settingsTabActions"><UiButton size="default" tone="solid" type="submit">Create Team</UiButton></div></form>
      </SettingGroup>
      {active ? <SettingGroup aria-label="Active Team">
        <SettingRow description={`You are an ${active.currentUserRole} in ${active.displayName}.`} title="Active Team" />
        {active.currentUserRole === "owner" ? <form action={rename} className="settingsTabForm"><SettingRow control={<UiInput defaultValue={active.displayName} fieldSize="default" name="displayName" required />} description="Visible to all Team members." title="Team name" /><div className="settingsTabActions"><UiButton size="compact" tone="soft" type="submit">Rename Team</UiButton></div></form> : <p className="readOnlyState">Read-only. Only an Owner can rename or archive this Team.</p>}
        <SettingRow control={onOpenMembers ? <UiButton size="compact" tone="soft" onClick={onOpenMembers}>Manage members</UiButton> : <Link className="settingsLink" href="/team/members">Manage members</Link>} description="Add, remove, and assign roles for this Team." title="Members" />
        {active.currentUserRole === "owner" ? <SettingRow control={<UiButton size="compact" tone="danger" onClick={() => setArchiving(active)}>Archive Team</UiButton>} description="Archived Teams leave member switchers but retain historical attribution." title="Archive Team" /> : null}
      </SettingGroup> : null}
      {status ? <p aria-live="polite" className="formNotice" role="status">{status}</p> : null}
      <dialog aria-labelledby="archive-team-title" className="confirmDialog" ref={dialogRef} onCancel={() => setArchiving(null)}>
        <h2 id="archive-team-title">Archive {archiving?.displayName}?</h2><p>This removes the Team from every member’s switcher. Historical work remains available to the system.</p>
        <div><UiButton ref={cancelRef} size="default" onClick={() => { dialogRef.current?.close(); setArchiving(null); }}>Cancel</UiButton><UiButton size="default" tone="danger" onClick={() => void archive()}>Archive Team</UiButton></div>
      </dialog>
    </>;

  if (embedded) return content;

  return (
    <main className="settingsPage">
      <header><h1 ref={headingRef} tabIndex={-1}>Team settings</h1><p>Switch, create, and manage the active Team.</p></header>
      {content}
    </main>
  );
}
