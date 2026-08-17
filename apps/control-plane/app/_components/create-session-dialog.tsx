"use client";

import type { RuntimeView, Session, Task, TaskWorkspaceView } from "@mystra/shared";
import { SESSION_TEXT_MAX_LENGTH } from "@mystra/shared/session";
import {
  UiButton,
  UiDialogCloseButton,
  UiDialogSurface,
  UiDropdown,
  UiSurfaceBody,
  UiSurfaceFooter,
  UiSurfaceHeader,
  UiTextarea,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { useResource } from "../_lib/use-resource";

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { code?: unknown; message?: unknown };
    if (typeof error?.message === "string") return typeof error.code === "string" ? `${error.code}: ${error.message}` : error.message;
  }
  return `Session creation failed (${status})`;
}

export function CreateSessionDialog({ onClose, task, triggerRef, workspace }: {
  onClose: () => void;
  task: Task;
  triggerRef: RefObject<HTMLButtonElement | null>;
  workspace: TaskWorkspaceView | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const runtimes = useResource<{ runtimes: RuntimeView[] }>("/api/runtimes", 5_000);
  const [prompt, setPrompt] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtime = useMemo(() => runtimes.data?.runtimes.find((item) => item.id === workspace?.runtimeId), [runtimes.data?.runtimes, workspace?.runtimeId]);
  const providers = useMemo(() => runtime?.providers.filter((provider) => provider.available) ?? [], [runtime]);
  const unavailable = workspace?.state !== "ready"
    ? "Task Workspace is not ready."
    : !runtimes.isLoading && providers.length === 0
      ? "No Provider is available on the Task Workspace Runtime."
      : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!providers.some((provider) => provider.provider === providerKey)) setProviderKey(providers[0]?.provider ?? "");
  }, [providerKey, providers]);

  function close() {
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function create() {
    if (submitting || unavailable || !providerKey) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: crypto.randomUUID(),
          providerKey,
          ...(prompt.trim() ? { manualContext: { text: prompt.trim() } } : {}),
        }),
      });
      const payload = await response.json() as { session?: Session; error?: unknown };
      if (!response.ok || !payload.session) throw new Error(responseError(payload, response.status));
      onClose();
      router.push(`/sessions/${encodeURIComponent(payload.session.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSubmitting(false);
    }
  }

  return (
    <dialog
      aria-labelledby="create-session-dialog-title"
      className="featureDialog"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onClose={close}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      ref={dialogRef}
    >
      <UiDialogSurface className="sessionComposer" layout="rows">
        <UiSurfaceHeader className="sessionComposerHeader">
          <h2 id="create-session-dialog-title">Create Session</h2>
          <UiDialogCloseButton autoFocus aria-label="Close Session dialog" onClick={close} />
        </UiSurfaceHeader>
        <UiSurfaceBody className="sessionComposerBody">
          <UiTextarea
            aria-label="Prompt"
            className="sessionComposerPrompt"
            maxLength={SESSION_TEXT_MAX_LENGTH}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            placeholder="Session-only context, constraints, or a specific focus"
            rows={4}
            value={prompt}
          />
          {error || runtimes.error || unavailable ? <p className="formError" role="alert">{error ?? runtimes.error ?? unavailable}</p> : null}
        </UiSurfaceBody>
        <UiSurfaceFooter className="sessionComposerFooter">
          <UiDropdown
            aria-label="Provider"
            disabled={submitting || providers.length === 0}
            onValueChange={setProviderKey}
            options={providers.map((provider) => ({ value: provider.provider, label: provider.provider }))}
            placeholder="Select Provider"
            size="inline"
            value={providerKey}
            variant="ghost"
          />
          <UiButton disabled={submitting || Boolean(unavailable) || !providerKey} onClick={() => void create()} size="inline" tone="solid">{submitting ? "Creating…" : "Create"}</UiButton>
        </UiSurfaceFooter>
      </UiDialogSurface>
    </dialog>
  );
}
