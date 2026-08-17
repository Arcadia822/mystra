"use client";

import type { RuntimeView, Task, TaskSessionLaunchResponse } from "@mystra/shared";
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

function supportsTaskWorkspace(runtime: RuntimeView): boolean {
  const capability = runtime.metadata.workspaceMaterialization;
  return Boolean(capability?.kinds.includes("task-repository") && capability.sharingModes.includes("shared-mutable"));
}

function waitForPreparation(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Session launch canceled", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Session launch canceled", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, 1_000);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function CreateSessionDialog({ onClose, task, triggerRef }: {
  onClose: () => void;
  task: Task;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runtimes = useResource<{ runtimes: RuntimeView[] }>("/api/runtimes", 5_000);
  const [prompt, setPrompt] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtime = useMemo(() => task.runtimeId
    ? runtimes.data?.runtimes.find((item) => item.id === task.runtimeId)
    : null, [runtimes.data?.runtimes, task.runtimeId]);
  const providers = useMemo(() => {
    const candidates = task.runtimeId
      ? runtime && runtime.status === "online" && supportsTaskWorkspace(runtime) ? [runtime] : []
      : (runtimes.data?.runtimes ?? []).filter((item) => item.status === "online" && supportsTaskWorkspace(item));
    return Array.from(new Map(candidates.flatMap((item) => item.providers)
      .filter((provider) => provider.available)
      .map((provider) => [provider.provider, provider])).values());
  }, [runtime, runtimes.data?.runtimes, task.runtimeId]);
  const unavailable = !runtimes.isLoading && providers.length === 0
    ? task.runtimeId ? "No Provider is available on this Task Runtime." : "No eligible Runtime provides a Provider."
    : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!providers.some((provider) => provider.provider === providerKey)) setProviderKey(providers[0]?.provider ?? "");
  }, [providerKey, providers]);

  function close() {
    abortRef.current?.abort();
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function create() {
    if (submitting || unavailable || !providerKey) return;
    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const sessionId = crypto.randomUUID();
    const body = JSON.stringify({
      sessionId,
      providerKey,
      ...(prompt.trim() ? { manualContext: { text: prompt.trim() } } : {}),
    });
    try {
      while (!controller.signal.aborted) {
        const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/sessions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: controller.signal,
        });
        const payload = await response.json() as TaskSessionLaunchResponse | { error?: unknown };
        if (!response.ok || !("state" in payload)) throw new Error(responseError(payload, response.status));
        if (payload.state === "ready") {
          abortRef.current = null;
          onClose();
          router.push(`/sessions/${encodeURIComponent(payload.session.id)}`);
          router.refresh();
          return;
        }
        await waitForPreparation(controller.signal);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
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
          <UiButton disabled={submitting || Boolean(unavailable) || !providerKey} onClick={() => void create()} size="inline" tone="solid">{submitting ? "Preparing…" : "Create"}</UiButton>
        </UiSurfaceFooter>
      </UiDialogSurface>
    </dialog>
  );
}
