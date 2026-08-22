"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { MemberView, TeamListItem, TeamRole } from "@mystra/shared";

import { controlPlaneRequest, ControlPlaneApiError } from "../_lib/control-plane-api";
import { useResource } from "../_lib/use-resource";
import { UiButton } from "./ui-actions";
import { UiInput, UiSelect } from "./ui-fields";
import { SettingGroup, SettingRow } from "./setting-row";

export function TeamMembers({ embedded = false }: { embedded?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const teams = useResource<{ teams: TeamListItem[] }>("/api/teams");
  const [members, setMembers] = useState<MemberView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const active = teams.data?.teams.find((team) => team.isActive);
  const canManage = active?.currentUserRole === "owner" || active?.currentUserRole === "admin";

  const loadMembers = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const result = await controlPlaneRequest<{ members: MemberView[] }>(`/api/teams/${active.id}/members`);
      setMembers(result.members);
    } catch (caught) {
      setError(caught instanceof ControlPlaneApiError ? caught.message : "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { void loadMembers(); }, [loadMembers]);

  async function addMember(formData: FormData) {
    if (!active) return;
    await mutate(`/api/teams/${active.id}/members`, "POST", { username: formData.get("username") });
  }
  async function setRole(userId: string, role: TeamRole) {
    if (!active) return;
    await mutate(`/api/teams/${active.id}/members/role`, "PATCH", { userId, role });
  }
  async function remove(userId: string) {
    if (!active) return;
    await mutate(`/api/teams/${active.id}/members/remove`, "POST", { userId });
  }
  async function mutate(url: string, method: string, body: unknown) {
    setStatus(null);
    try {
      await controlPlaneRequest(url, { body: JSON.stringify(body), method });
      setStatus("Team members updated.");
      await loadMembers();
    } catch (caught) {
      const message = caught instanceof ControlPlaneApiError ? caught.message : "Unable to update Team members.";
      setStatus(message);
      if (caught instanceof ControlPlaneApiError && caught.status === 403) setError(message);
    }
  }

  const canEdit = (member: MemberView) => canManage && (active?.currentUserRole === "owner" || member.role === "member");
  const canChangeRole = active?.currentUserRole === "owner";

  const content = <>
      {teams.isLoading || loading ? <p aria-busy="true" className="statePanel">Loading members…</p> : null}
      {teams.error || error ? <p className="statePanel errorState" role="alert">{teams.error ?? error}</p> : null}
      {!teams.isLoading && !active ? <p className="statePanel">No active Team is available.</p> : null}
      {active && !canManage ? <p className="readOnlyState">Read-only. Your role cannot manage Team members.</p> : null}
      {active && canManage ? <SettingGroup aria-label="Add member"><form action={addMember} className="settingsTabForm"><SettingRow control={<UiInput fieldSize="default" name="username" required />} description="Add an existing local user to this Team." title="Username" /><div className="settingsTabActions"><UiButton size="default" tone="solid" type="submit">Add member</UiButton></div></form></SettingGroup> : null}
      {active && !loading && members?.length === 0 ? <p className="statePanel">This Team has no active members.</p> : null}
      {members?.length ? <SettingGroup aria-label="Members"><SettingRow description="Roles are enforced by the control plane for every Team resource." title="Members"><ul className="memberList">
        {members.map((member) => <li key={member.userId}>
          <span><strong>{member.displayName}</strong><small>{member.username} · {member.status}</small></span>
          <label><span className="srOnly">Role for {member.username}</span><UiSelect disabled={!canChangeRole} fieldSize="compact" value={member.role} onChange={(event) => void setRole(member.userId, event.currentTarget.value as TeamRole)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="member">Member</option></UiSelect></label>
          <UiButton disabled={!canEdit(member)} size="compact" tone="danger" onClick={() => void remove(member.userId)}>Remove</UiButton>
        </li>)}
      </ul></SettingRow></SettingGroup> : null}
      {status ? <p aria-live="polite" className="formNotice" role="status">{status}</p> : null}
    </>;

  if (embedded) return content;

  return (
    <main className="settingsPage">
      <header><h1 ref={headingRef} tabIndex={-1}>Team members</h1><p>Manage membership by local username for {active?.displayName ?? "the active Team"}.</p></header>
      {content}
    </main>
  );
}
