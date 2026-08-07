"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { TeamListItem } from "@mystra/shared";

import { controlPlaneRequest, ControlPlaneApiError } from "../_lib/control-plane-api";
import { useResource } from "../_lib/use-resource";
import { UiButton } from "./ui-actions";

export function TeamSwitcher() {
  const router = useRouter();
  const teams = useResource<{ teams: TeamListItem[] }>("/api/teams");
  const [status, setStatus] = useState<string | null>(null);
  const active = teams.data?.teams.find((team) => team.isActive);

  async function switchTeam(teamId: string) {
    try {
      await controlPlaneRequest("/api/teams/switch", {
        body: JSON.stringify({ teamId }),
        method: "POST",
      });
      setStatus("Active Team changed.");
      await teams.refresh();
      router.refresh();
    } catch (caught) {
      setStatus(caught instanceof ControlPlaneApiError ? caught.message : "Unable to switch Team.");
    }
  }

  return (
    <details className="teamSwitcher">
      <summary aria-label="Change active Team">{teams.isLoading ? "Loading Team…" : active?.displayName ?? "Choose Team"}</summary>
      <div className="teamSwitcherMenu">
        <strong>Teams</strong>
        {teams.error ? <p role="alert">{teams.error}</p> : null}
        {(teams.data?.teams ?? []).map((team) => (
          <UiButton
            active={team.isActive}
            block
            key={team.id}
            size="header"
            onClick={() => void switchTeam(team.id)}
          >
            {team.displayName}<small>{team.currentUserRole}</small>
          </UiButton>
        ))}
        <Link href="/team">Manage Teams</Link>
        {status ? <p aria-live="polite" role="status">{status}</p> : null}
      </div>
    </details>
  );
}
