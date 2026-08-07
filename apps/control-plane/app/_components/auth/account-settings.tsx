"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import { useRouter } from "next/navigation";

import { controlPlaneRequest, ControlPlaneApiError } from "../../_lib/control-plane-api";
import { useResource } from "../../_lib/use-resource";
import { UiButton } from "../ui-actions";
import { UiInput } from "../ui-fields";
import { SettingGroup, SettingRow } from "../setting-row";
import { PasswordChangeForm } from "./password-change-form";

interface AccountResponse {
  user: { displayName: string; username: string };
}
interface SessionsResponse {
  sessions: Array<{ id: string; createdAt: string; current: boolean; userAgent?: string }>;
}

export function AccountSettings({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const account = useResource<AccountResponse>("/api/auth/session");
  const sessions = useResource<SessionsResponse>("/api/auth/sessions");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => headingRef.current?.focus(), []);

  async function updateName(formData: FormData) {
    setStatus(null);
    try {
      await controlPlaneRequest("/api/account/display-name", {
        body: JSON.stringify({ displayName: formData.get("displayName") }),
        method: "POST",
      });
      setStatus("Display name saved.");
      await account.refresh();
    } catch (caught) {
      setStatus(caught instanceof ControlPlaneApiError ? caught.message : "Unable to save the display name.");
    }
  }

  async function revoke(sessionId: string) {
    setStatus(null);
    try {
      await controlPlaneRequest("/api/auth/sessions/revoke", {
        body: JSON.stringify({ sessionId }),
        method: "POST",
      });
      setStatus("Session revoked.");
      await sessions.refresh();
    } catch (caught) {
      setStatus(caught instanceof ControlPlaneApiError ? caught.message : "Unable to revoke the session.");
    }

  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const Container: ElementType = embedded ? "section" : "main";

  return (
    <Container className={`settingsPage${embedded ? " settingsModalPage" : ""}`}>
      <header><h1 ref={headingRef} tabIndex={-1}>Account settings</h1><p>Manage your local identity and signed-in sessions.</p></header>
      {account.isLoading ? <p aria-busy="true" className="statePanel">Loading account…</p> : null}
      {account.error ? <p className="statePanel errorState" role="alert">{account.error}</p> : null}
      {account.data ? (
        <SettingGroup aria-label="Profile">
          <form action={updateName} className="settingsTabForm">
            <SettingRow control={<UiInput disabled fieldSize="default" value={account.data.user.username} />} description="Used to sign in to this local Mystra instance." title="Username" />
            <SettingRow control={<UiInput defaultValue={account.data.user.displayName} fieldSize="default" name="displayName" required />} description="Shown to other members in this Team." title="Display name" />
            <div className="settingsTabActions"><UiButton size="default" tone="solid" type="submit">Save profile</UiButton></div>
          </form>
        </SettingGroup>
      ) : null}
      <PasswordChangeForm embedded={embedded} />
      <SettingGroup aria-label="Sessions">
        <SettingRow description="Review and revoke sessions that are no longer in use." title="Sessions">
          {sessions.isLoading ? <p aria-busy="true">Loading sessions…</p> : null}
          {sessions.error ? <p role="alert">{sessions.error}</p> : null}
          <ul className="sessionList">
            {(sessions.data?.sessions ?? []).map((session) => <li key={session.id}><span>{session.current ? "This session" : session.userAgent ?? "Signed-in session"}</span>{!session.current ? <UiButton size="compact" tone="danger" onClick={() => void revoke(session.id)}>Revoke</UiButton> : null}</li>)}
          </ul>
        </SettingRow>
        <div className="settingsTabActions"><UiButton size="compact" tone="ghost" onClick={() => void logout()}>Sign out</UiButton></div>
      </SettingGroup>
      {status ? <p aria-live="polite" className="formNotice" role="status">{status}</p> : null}
    </Container>
  );
}
