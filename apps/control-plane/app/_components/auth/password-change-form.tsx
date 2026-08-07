"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { controlPlaneRequest, ControlPlaneApiError } from "../../_lib/control-plane-api";
import { UiButton } from "../ui-actions";
import { UiInput } from "../ui-fields";
import { SettingGroup, SettingRow } from "../setting-row";

export function PasswordChangeForm({ embedded = false, required = false }: { embedded?: boolean; required?: boolean }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => headingRef.current?.focus(), []);

  async function submit(formData: FormData) {
    setMessage(null);
    if (formData.get("newPassword") !== formData.get("confirmation")) {
      setMessage("The new passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await controlPlaneRequest("/api/account/password", {
        body: JSON.stringify({
          currentPassword: formData.get("currentPassword"),
          newPassword: formData.get("newPassword"),
        }),
        method: "POST",
      });
      setMessage("Password updated. Other sessions have been signed out.");
      if (required) router.replace("/");
    } catch (caught) {
      setMessage(caught instanceof ControlPlaneApiError ? caught.message : "Unable to update the password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (embedded) {
    return (
      <SettingGroup aria-label="Password">
        <form action={submit} className="settingsTabForm">
          <SettingRow control={<UiInput autoComplete="current-password" fieldSize="default" name="currentPassword" required type="password" />} description="Required to make a password change." title="Current password" />
          <SettingRow control={<UiInput autoComplete="new-password" fieldSize="default" minLength={1} name="newPassword" required type="password" />} description="Any non-empty password is accepted." title="New password" />
          <SettingRow control={<UiInput autoComplete="new-password" fieldSize="default" minLength={1} name="confirmation" required type="password" />} description="Must match the new password." title="Confirm password" />
          <div className="settingsTabActions"><UiButton disabled={isSubmitting} size="default" tone="solid" type="submit">{isSubmitting ? "Saving…" : "Save password"}</UiButton></div>
        </form>
        {message ? <p aria-live="polite" className="formNotice" role="status">{message}</p> : null}
      </SettingGroup>
    );
  }

  return (
    <form action={submit} className="settingsForm">
      <h1 ref={headingRef} tabIndex={-1}>{required ? "Set a new password" : "Change password"}</h1>
      <p>{required ? "Choose a new password to continue to Mystra." : "Changing your password signs out your other sessions."}</p>
      <label><span>Current password</span><UiInput autoComplete="current-password" fieldSize="default" name="currentPassword" required type="password" /></label>
      <label><span>New password</span><UiInput autoComplete="new-password" fieldSize="default" minLength={1} name="newPassword" required type="password" /></label>
      <label><span>Confirm new password</span><UiInput autoComplete="new-password" fieldSize="default" minLength={1} name="confirmation" required type="password" /></label>
      {message ? <p aria-live="polite" className="formNotice" role="status">{message}</p> : null}
      <UiButton disabled={isSubmitting} size="default" tone="solid" type="submit">{isSubmitting ? "Saving…" : "Save password"}</UiButton>
      {required ? <UiButton size="default" tone="ghost" onClick={() => void logout()}>Sign out</UiButton> : null}
    </form>
  );
}
