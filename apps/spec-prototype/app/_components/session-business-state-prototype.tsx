"use client";

import { UiButton, UiSurface, UiSurfaceBody, UiSurfaceHeader } from "@mystra/ui";
import { useState } from "react";

import styles from "./session-business-state-prototype.module.css";
import {
  internalSessionExecutionFacts,
  sessionBusinessStateTransitions,
  type SessionBusinessState,
} from "./session-business-state-model";
import { PrototypeShell } from "./prototype-shell";

const stateDescriptions: Record<SessionBusinessState, string> = {
  INIT: "The Session has not left its first initialization phase.",
  RUNNING: "The Session is actively advancing work.",
  INTERRUPTED: "The Session needs input, approval, an external action, or Human handoff.",
  DONE: "The current work has ended. The Session can run or become interrupted again.",
};

export function SessionBusinessStatePrototype() {
  const [state, setState] = useState<SessionBusinessState>("INIT");
  const [history, setHistory] = useState<SessionBusinessState[]>(["INIT"]);

  function transition(next: SessionBusinessState) {
    setState(next);
    setHistory((current) => [...current, next]);
  }

  return (
    <PrototypeShell onNewTask={() => undefined} onSearch={() => undefined} title="Session state contract">
      <main className={styles.page}>
        <UiSurface as="section" aria-labelledby="session-business-state-title">
          <UiSurfaceHeader>
            <strong id="session-business-state-title">Current product state</strong>
            <code className={styles.currentState} data-state={state}>{state}</code>
          </UiSurfaceHeader>
          <UiSurfaceBody className={styles.stateBody}>
            <p aria-live="polite" className={styles.description}>{stateDescriptions[state]}</p>
            <div aria-label={`Transitions available from ${state}`} className={styles.transitionActions} role="group">
              {sessionBusinessStateTransitions[state].map((target) => (
                <UiButton key={target} onClick={() => transition(target)} size="header" tone="soft">
                  Move to {target}
                </UiButton>
              ))}
            </div>
          </UiSurfaceBody>
        </UiSurface>

        <div className={styles.supportingGrid}>
          <UiSurface as="section" aria-labelledby="internal-facts-title" variant="outline">
            <UiSurfaceHeader><strong id="internal-facts-title">Internal execution facts</strong></UiSurfaceHeader>
            <UiSurfaceBody className={styles.compactBody}>
              <p>Diagnostic only · not Session state</p>
              <div className={styles.factList}>
                {internalSessionExecutionFacts.map((fact) => <code key={fact}>{fact}</code>)}
              </div>
            </UiSurfaceBody>
          </UiSurface>

          <UiSurface as="section" aria-labelledby="transition-history-title" variant="outline">
            <UiSurfaceHeader><strong id="transition-history-title">Prototype transition history</strong></UiSurfaceHeader>
            <UiSurfaceBody className={styles.compactBody}>
              <ol className={styles.history}>
                {history.map((item, index) => <li key={`${index}-${item}`}><code>{item}</code></li>)}
              </ol>
            </UiSurfaceBody>
          </UiSurface>
        </div>

        <p className={styles.boundaryNote}>
          Task, TaskExecutionContext, Workspace, and Runtime state remain independent from this Session business state.
        </p>
      </main>
    </PrototypeShell>
  );
}
