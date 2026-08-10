"use client";

import type { Session, SessionEvent, SessionEventWindow, SessionResponse } from "@mystra/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, LoadingState } from "../../_components/states";
import { mergeSessionEvents, presentSessionEvent, sessionStateLabel, shouldPollSession } from "../../_components/session-presentation";
import { SESSION_DETAIL_COPY } from "../../_components/shell-copy";
import { useShellLocale } from "../../_components/shell-locale";
import { UiButton } from "../../_components/ui-actions";
import { relativeTime } from "../../_lib/format";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as T & { error?: { code?: string; message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
  return payload;
}

export default function SessionDetailPage() {
  const id = useParams<{ id: string }>().id;
  const locale = useShellLocale();
  const copy = SESSION_DETAIL_COPY[locale];
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [olderCursor, setOlderCursor] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const lastSequence = events.at(-1)?.globalSequence ?? 0;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, window] = await Promise.all([
        readJson<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}`),
        readJson<SessionEventWindow>(`/api/sessions/${encodeURIComponent(id)}/events?latest=100`),
      ]);
      setSession(detail.session);
      setEvents(window.events);
      setOlderCursor(window.olderCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  const refreshAfter = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return true;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const window = await readJson<SessionEventWindow>(
        `/api/sessions/${encodeURIComponent(id)}/events?afterSequence=${lastSequence}&limit=100`,
      );
      setEvents((current) => mergeSessionEvents(current, window.events));
      if (window.events.length > 0) {
        const detail = await readJson<SessionResponse>(`/api/sessions/${encodeURIComponent(id)}`);
        setSession(detail.session);
      }
      setRefreshError(null);
      return true;
    } catch (caught) {
      setRefreshError(caught instanceof Error ? caught.message : String(caught));
      return false;
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [id, lastSequence]);

  useEffect(() => {
    if (!session || !shouldPollSession(session.state)) return;
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      const success = shouldPollSession(session.state, document.hidden) ? await refreshAfter() : true;
      if (!stopped) timer = window.setTimeout(() => void tick(), success ? 3_000 : 15_000);
    };
    timer = window.setTimeout(() => void tick(), 3_000);
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refreshAfter, session]);

  async function loadEarlier() {
    if (!olderCursor || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const window = await readJson<SessionEventWindow>(
        `/api/sessions/${encodeURIComponent(id)}/events?beforeSequence=${olderCursor}&limit=100`,
      );
      setEvents((current) => mergeSessionEvents(current, window.events));
      setOlderCursor(window.olderCursor);
      setRefreshError(null);
    } catch (caught) {
      setRefreshError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }

  if (loading) return <div className="pageContent"><LoadingState label={copy.loading} /></div>;
  if (error || !session) return <div className="pageContent"><ErrorState message={error ?? "Session response missing"} onRetry={() => void loadInitial()} /></div>;
  const stateTone = session.state === "ready" || session.state === "closed" ? "good" : session.state === "failed" ? "bad" : "active";

  return (
    <div className="pageContent sessionDetailPage">
      <div className="pageToolbar">
        <div className="pageIdentity"><Link className="backLink" href={`/tasks/${encodeURIComponent(session.taskId)}`}>← {copy.back}</Link><strong>Session</strong><span className={`statusBadge ${stateTone}`}>{sessionStateLabel(session.state, locale)}</span></div>
        <span className="mono">{session.id}</span>
      </div>
      <div className="detailStack sessionReadingColumn">
        <section className="panel">
          <dl className="definitionList">
            <div><dt>{copy.runtime}</dt><dd className="mono">{session.runtimeId}</dd></div>
            <div><dt>{copy.provider}</dt><dd>{session.providerKey}</dd></div>
            <div><dt>{copy.agent}</dt><dd className="mono">{session.agentId} · r{session.agentRevision}</dd></div>
            <div><dt>{copy.project}</dt><dd className="mono">{session.projectId ?? copy.noProject}</dd></div>
            <div><dt>{copy.created}</dt><dd>{relativeTime(session.createdAt)} · {session.createdAt}</dd></div>
            <div><dt>{copy.updated}</dt><dd>{relativeTime(session.updatedAt)} · {session.updatedAt}</dd></div>
          </dl>
        </section>
        <section className="panel sessionEventsPanel" aria-labelledby="session-events-heading">
          <div className="panelHeader">
            <div><h2 id="session-events-heading">{copy.events}</h2><span>{copy.eventsDescription}</span></div>
            <div className="eventActions">
              {olderCursor ? <UiButton disabled={refreshing} onClick={() => void loadEarlier()}>{copy.loadEarlier}</UiButton> : null}
              <UiButton disabled={refreshing} onClick={() => void refreshAfter()}>{copy.refresh}</UiButton>
            </div>
          </div>
          <div className="sessionLiveState" aria-live="polite">
            <span>{shouldPollSession(session.state) ? copy.live : copy.paused}</span>
            {refreshError ? <span className="formError">{copy.requestFailed} {refreshError}</span> : null}
          </div>
          {events.length === 0 ? <div className="panelEmpty">{copy.empty}</div> : (
            <ol className="sessionEventList">
              {events.map((event) => {
                const presentation = presentSessionEvent(event, locale);
                return (
                  <li className={`sessionEventItem ${presentation.tone}`} key={event.eventId}>
                    <span className="eventSequence mono">#{event.globalSequence}</span>
                    <div><strong>{presentation.title}</strong>{presentation.detail ? <p>{presentation.detail}</p> : null}</div>
                    <time dateTime={event.occurredAt}>{relativeTime(event.occurredAt)}</time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
