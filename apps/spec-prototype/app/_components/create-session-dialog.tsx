"use client";

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
import { useState } from "react";

import { PrototypeDialog } from "./prototype-shell";

const PROVIDER_OPTIONS = [
  { value: "codex", label: "Codex", description: "Available on Arcadia Mac" },
];

export function CreateSessionDialog({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("codex");

  return (
    <PrototypeDialog onClose={onClose} title="Create Session">
      <UiDialogSurface className="sessionComposer" layout="rows">
        <UiSurfaceHeader className="sessionComposerHeader">
          <h2>Create Session</h2>
          <UiDialogCloseButton autoFocus aria-label="Close Session dialog" onClick={onClose} />
        </UiSurfaceHeader>

        <UiSurfaceBody className="sessionComposerBody">
          <UiTextarea
            aria-label="Prompt"
            className="sessionComposerPrompt"
            maxLength={64 * 1024}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            placeholder="Session-only context, constraints, or a specific focus"
            rows={4}
            value={prompt}
          />
        </UiSurfaceBody>

        <UiSurfaceFooter className="sessionComposerFooter">
          <UiDropdown
            aria-label="Provider"
            onValueChange={setProvider}
            options={PROVIDER_OPTIONS}
            placeholder="Select Provider"
            size="inline"
            value={provider}
            variant="ghost"
          />
          <UiButton onClick={onCreate} size="inline" tone="solid">Create</UiButton>
        </UiSurfaceFooter>
      </UiDialogSurface>
    </PrototypeDialog>
  );
}
