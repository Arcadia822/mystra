"use client";

import {
  type FormEventHandler,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

import { UiTextarea } from "./ui-fields";

export interface AiComposerProps {
  /** The textarea's id for label association. */
  inputId: string;
  /** Placeholder shown in the textarea. */
  placeholder?: string;
  /** Current text value. */
  value: string;
  onChange: (value: string) => void;
  /** Called when the form is submitted (Enter or submit button). */
  onSubmit: FormEventHandler<HTMLFormElement>;
  /**
   * Whether Enter alone submits. When true, the composer intercepts keydown
   * and calls `onSubmit` if the condition is met. Defaults to `false`.
   */
  submitOnEnter?: boolean;
  /** Whether submission is currently allowed. Used to gate Enter submission. */
  canSubmit?: boolean;
  /** Slot for attachment / project controls (left side of footer). */
  tools?: ReactNode;
  /** Slot for voice / send actions (right side of footer). */
  actions?: ReactNode;
  /** Optional content rendered between the textarea and the footer (e.g. issue list). */
  middle?: ReactNode;
  className?: string;
}

/**
 * AiComposer — reusable prompt-input surface.
 *
 * Renders a bordered card containing a textarea, an optional middle region,
 * and a footer row split into tool controls (left) and action controls (right).
 * The caller is responsible for all business logic; this component handles
 * only layout and keyboard wiring.
 */
export function AiComposer({
  inputId,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitOnEnter = false,
  canSubmit = false,
  tools,
  actions,
  middle,
  className,
}: AiComposerProps) {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (submitOnEnter && event.key === "Enter" && !event.shiftKey && canSubmit) {
      event.preventDefault();
      // Dispatch a synthetic submit to the parent form handler.
      onSubmit(new Event("submit") as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  return (
    <form
      className={`aiComposer${className ? ` ${className}` : ""}`}
      onSubmit={onSubmit}
    >
      <UiTextarea
        autoFocus
        id={inputId}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {middle ? <div className="aiComposerMiddle">{middle}</div> : null}

      {(tools ?? actions) ? (
        <footer className="aiComposerFooter">
          {tools ? <div className="aiComposerTools">{tools}</div> : null}
          {actions ? <div className="aiComposerActions">{actions}</div> : null}
        </footer>
      ) : null}
    </form>
  );
}
