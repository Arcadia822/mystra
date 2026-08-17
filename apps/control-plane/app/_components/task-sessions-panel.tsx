"use client";

import type { Session, Task, TaskSessionPage } from "@mystra/shared";
import {
  ProviderIcon,
  StackedList,
  StackedListField,
  StackedListHelperRow,
  StackedListRow,
  UiButton,
  UiLabel,
  type ShellIconName,
  type StackedListStandardFieldDefinition,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { sessionStateLabel } from "./session-presentation";
import { useShellLocale } from "./shell-locale";

const fields = [
  { key: "state", align: "left", equalWidth: true, renderType: "labels" },
  { key: "provider", align: "left", renderType: "icon" },
  { key: "name", align: "left", renderType: "text" },
  { key: "updated", align: "right", equalWidth: true, renderType: "datetime" },
] as const satisfies readonly StackedListStandardFieldDefinition[];

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function stateIcon(state: Session["state"]): ShellIconName {
  if (state === "closed") return "check";
  if (state === "failed" || state === "interrupted" || state === "waiting_for_handoff") return "alert";
  if (state === "queued" || state === "ready") return "circle";
  return "spinner";
}

export function TaskSessionsPanel({ task }: { task: Task }) {
  const locale = useShellLocale();
  const router = useRouter();
  const page = useResource<TaskSessionPage>(`/api/tasks/${encodeURIComponent(task.id)}/sessions?limit=50`, 0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!page.data) return;
    setSessions(page.data.sessions);
    setNextCursor(page.data.nextCursor);
  }, [page.data]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/sessions?limit=50&cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store" });
      const payload = await response.json() as TaskSessionPage & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? `Session page failed (${response.status})`);
      setSessions((current) => [...current, ...payload.sessions.filter((candidate) => !current.some((item) => item.id === candidate.id))]);
      setNextCursor(payload.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  if (page.error) return <div className="taskSessionsState" role="alert"><span>{page.error}</span><UiButton onClick={() => void page.refresh()}>Retry</UiButton></div>;
  if (page.isLoading && sessions.length === 0) return <div className="taskSessionsState" role="status">Loading sessions…</div>;

  return (
    <section aria-label="Sessions" className="taskSessionsSection">
      <StackedListHelperRow>{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</StackedListHelperRow>
      {sessions.length === 0 ? <div className="taskSessionsState" role="status">No sessions yet</div> : (
        <div className="taskSessionsViewport">
          <StackedList className="taskSessionsList" fields={fields}>
            {sessions.map((session) => <StackedListRow
              key={session.id}
              left={<>
                <StackedListField field={fields[0]}><UiLabel icon={stateIcon(session.state)}>{sessionStateLabel(session.state, locale)}</UiLabel></StackedListField>
                <StackedListField field={fields[1]}>{session.providerKey === "codex" || session.providerKey === "copilot" ? <ProviderIcon provider={session.providerKey} /> : <span className="mono">{session.providerKey}</span>}</StackedListField>
              </>}
              name={<span title={session.id}>{session.id}</span>}
              onClick={() => router.push(`/sessions/${encodeURIComponent(session.id)}`)}
              right={<StackedListField field={fields[3]}><time dateTime={session.updatedAt}>{dateFormatter.format(new Date(session.updatedAt))}</time></StackedListField>}
            />)}
          </StackedList>
        </div>
      )}
      {error ? <div className="taskSessionsState" role="alert">{error}</div> : null}
      {nextCursor ? <div className="taskSessionsPager"><UiButton disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</UiButton></div> : null}
    </section>
  );
}
