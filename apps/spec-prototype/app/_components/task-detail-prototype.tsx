"use client";

import {
  ProviderIcon,
  ShellIcon,
  StackedList,
  StackedListField,
  StackedListHelperRow,
  StackedListRow,
  TaskStatusIcon,
  UiButton,
  UiLabel,
  type StackedListStandardFieldDefinition,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { CreateSessionDialog } from "./create-session-dialog";
import { SearchDialog, TaskComposer } from "./navigation-task-workbench";
import { PrototypeShell } from "./prototype-shell";
import {
  SESSION_STATE_LABELS,
  TASK_DETAIL_MAIN_FIXTURE,
  type SessionState,
} from "./task-detail-main-model";

const TASK_TITLE = "Navigation task workbench";

const sessionFields = [
  { key: "state", align: "left", equalWidth: true, renderType: "labels" },
  { key: "provider", align: "left", renderType: "icon" },
  { key: "name", align: "left", renderType: "text" },
  { key: "runtime", align: "right", renderType: "labels" },
  { key: "updated", align: "right", equalWidth: true, renderType: "datetime" },
] as const satisfies readonly StackedListStandardFieldDefinition[];

const SESSION_FIELD_VISIBILITY = {
  runtime: false,
} as const;

const sessionDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function shortIdentifier(value: string): string {
  return `${value.slice(0, 8)}…`;
}

function SessionDate({ value }: { value: string }) {
  return <time dateTime={value}>{sessionDateFormatter.format(new Date(value))}</time>;
}

function sessionStateIcon(state: SessionState): "alert" | "check" | "circle" | "spinner" {
  if (state === "closed") return "check";
  if (state === "failed" || state === "interrupted" || state === "waiting_for_handoff") return "alert";
  if (state === "queued" || state === "ready") return "circle";
  return "spinner";
}

export function TaskDetailPrototype({ taskId }: { taskId: string }) {
  const router = useRouter();
  const { runtimeNames, sessions } = TASK_DETAIL_MAIN_FIXTURE;
  const newSessionButtonRef = useRef<HTMLButtonElement>(null);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  function closeCreateSession() {
    setCreateSessionOpen(false);
    window.requestAnimationFrame(() => newSessionButtonRef.current?.focus());
  }

  return (
    <PrototypeShell
      breadcrumbItems={[
        { href: "/054-navigation-task-workbench", label: "Tasks" },
        { label: TASK_TITLE },
      ]}
      headerActions={(
        <UiButton
          aria-expanded={createSessionOpen}
          aria-haspopup="dialog"
          aria-label="New Session"
          onClick={() => { setNewTaskOpen(false); setSearchOpen(false); setCreateSessionOpen(true); }}
          ref={newSessionButtonRef}
          size="header"
        >
          <ShellIcon name="plus" />
          <span className="newSessionActionLabel">New Session</span>
        </UiButton>
      )}
      onNewTask={() => { setCreateSessionOpen(false); setSearchOpen(false); setNewTaskOpen(true); }}
      onSearch={() => { setCreateSessionOpen(false); setNewTaskOpen(false); setSearchOpen(true); }}
      rightPanel={{
        ariaLabel: "Task details",
        content: (
          <div className="taskDetailRightPanel">
            <dl className="taskPropertyList">
              <div><dt>Status</dt><dd><span className="taskPropertyStatus"><TaskStatusIcon status="in_progress" />In progress</span></dd></div>
              <div><dt>Task ID</dt><dd>{taskId}</dd></div>
              <div><dt>Project</dt><dd><UiLabel icon="github">Mystra</UiLabel></dd></div>
              <div><dt>Issue</dt><dd><UiLabel icon="linear">MYS-118</UiLabel></dd></div>
              <div><dt>Labels</dt><dd className="taskPropertyLabels"><UiLabel>frontend</UiLabel><UiLabel><span className="taskLabelKey">priority</span>high</UiLabel></dd></div>
              <div><dt>Created</dt><dd><time dateTime="2026-08-13T08:10:00Z">Aug 13</time></dd></div>
              <div><dt>Updated</dt><dd><time dateTime="2026-08-14T03:18:00Z">Aug 14</time></dd></div>
            </dl>

            <section aria-labelledby="task-status-history-title" className="taskStatusHistorySection">
              <h2 id="task-status-history-title">Status history</h2>
              <ol className="taskStatusHistory">
                <li><TaskStatusIcon status="in_progress" /><span><strong>Execution started</strong><small>Codex · 2 hours ago</small></span></li>
                <li><TaskStatusIcon status="pending" /><span><strong>Task created</strong><small>Arcadia · Aug 13</small></span></li>
              </ol>
            </section>
          </div>
        ),
        header: "Properties",
      }}
    >
      <div className="taskDetailPrototype">
        <div className="taskDetailCanvas">
          <main className="taskDetailMain">
            <section aria-label="Sessions" className="taskSessionsSection">
              <StackedListHelperRow>{sessions.length} sessions</StackedListHelperRow>
              <div className="taskSessionsViewport">
                <StackedList className="taskSessionsList" fields={sessionFields}>
                  {sessions.map((session) => (
                    <StackedListRow
                      key={session.id}
                      left={<>
                        <StackedListField field={sessionFields[0]}>
                          <UiLabel icon={sessionStateIcon(session.state)}>{SESSION_STATE_LABELS[session.state]}</UiLabel>
                        </StackedListField>
                        <StackedListField field={sessionFields[1]}>
                          <ProviderIcon provider={session.providerKey} />
                        </StackedListField>
                      </>}
                      name={<span title={session.id}>{session.id}</span>}
                      onClick={() => router.push(`/sessions/${session.id}`)}
                      right={<>
                        {SESSION_FIELD_VISIBILITY.runtime ? (
                          <StackedListField field={sessionFields[3]}>
                            <UiLabel>{runtimeNames[session.runtimeId] ?? shortIdentifier(session.runtimeId)}</UiLabel>
                          </StackedListField>
                        ) : null}
                        <StackedListField field={sessionFields[4]}><SessionDate value={session.updatedAt} /></StackedListField>
                      </>}
                    />
                  ))}
                </StackedList>
              </div>
            </section>
          </main>
        </div>
      </div>
      {newTaskOpen ? <TaskComposer onClose={() => setNewTaskOpen(false)} /> : null}
      {searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} /> : null}
      {createSessionOpen ? <CreateSessionDialog onClose={closeCreateSession} onCreate={closeCreateSession} /> : null}
    </PrototypeShell>
  );
}
