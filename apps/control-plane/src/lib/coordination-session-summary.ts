import {
  coordinationSessionSummarySchema,
  isTerminalSessionState,
  type CoordinationMilestone,
  type CoordinationSessionSummary,
  type SessionEvent,
  type SessionRecord,
  type SessionState,
  type TaskRecord,
} from "@mystra/shared";

type SummaryProjectionInput = {
  task: TaskRecord;
  session: SessionRecord;
  projectSlug?: string;
  recentEvents: SessionEvent[];
};

const assignmentStates = new Set<SessionState>(["assigned", "starting"]);
type TerminalStatus = NonNullable<CoordinationSessionSummary["terminal"]>["status"];

function terminalLabel(status: TerminalStatus): string {
  switch (status) {
    case "succeeded": return "Completed";
    case "failed": return "Failed";
    case "canceled": return "Canceled";
    case "timed_out": return "Timed out";
    case "waiting_for_review": return "Waiting for review";
  }
}

function fallbackTerminalSummary(session: SessionRecord): string {
  if (session.staleReason === "runner_stale") {
    return "Runner became stale before the Session produced a terminal result.";
  }
  return `Session ended with state ${session.state}.`;
}

function linkSummary(session: SessionRecord) {
  const result = session.result;
  const review = result?.reviewResult?.review;
  const metadata = result?.metadata ?? {};
  const frontendPreviewUrl = typeof metadata.frontendPreviewUrl === "string" ? metadata.frontendPreviewUrl : undefined;
  const backendPreviewUrl = typeof metadata.backendPreviewUrl === "string" ? metadata.backendPreviewUrl : undefined;
  return {
    branch: result?.branch ?? session.branch,
    ...(review?.url ? { reviewUrl: review.url } : {}),
    ...(review?.displayId ? { reviewDisplayId: review.displayId } : {}),
    ...(frontendPreviewUrl ? { frontendPreviewUrl } : {}),
    ...(backendPreviewUrl ? { backendPreviewUrl } : {}),
  };
}

function latestEvent(events: SessionEvent[], types: readonly SessionEvent["type"][]): SessionEvent | undefined {
  return events.findLast((event) => types.includes(event.type));
}

function executionPhaseForEvent(event: SessionEvent | undefined): CoordinationSessionSummary["currentPhase"] {
  if (!event) return undefined;
  if (["git.branch_created", "git.commit_created", "git.push_succeeded", "review.created", "review.reused"].includes(event.type)) return "delivery";
  if (["preview.started", "preview.ready", "preview.failed"].includes(event.type)) return "preview";
  if (event.type.startsWith("quality.build.")) return "build";
  if (event.type.startsWith("quality.test.")) return "test";
  if (event.type.startsWith("agent.")) return "agent";
  if (event.type.startsWith("repository.clone.")) return "clone";
  return undefined;
}

function milestoneForSession(input: SummaryProjectionInput): {
  phase: CoordinationSessionSummary["phase"];
  headline: string;
  milestone: CoordinationMilestone;
  currentPhase?: CoordinationSessionSummary["currentPhase"];
  terminal?: CoordinationSessionSummary["terminal"];
} {
  const { session, recentEvents } = input;
  const executionEvent = latestEvent(recentEvents, [
    "repository.clone.started", "repository.clone.succeeded", "agent.started", "agent.succeeded", "agent.failed",
    "quality.test.started", "quality.test.passed", "quality.test.failed", "quality.build.started",
    "quality.build.passed", "quality.build.failed", "preview.started", "preview.ready", "preview.failed",
    "git.branch_created", "git.commit_created", "git.push_succeeded", "review.created", "review.reused",
  ]);
  const reviewEvent = latestEvent(recentEvents, ["review.created", "review.reused"]);
  const executionStartedEvent = latestEvent(recentEvents, ["execution.started", "container.started", "agent.started"]);
  const assignedEvent = latestEvent(recentEvents, ["session.assigned"]);
  const queuedEvent = latestEvent(recentEvents, ["session.queued"]);

  if (isTerminalSessionState(session.state)) {
    const terminalStatus = session.result?.status ?? (session.state as TerminalStatus);
    const terminal = session.result
      ? {
          status: terminalStatus,
          summary: session.result.summary,
          ...(session.result.errorCode ? { errorCode: session.result.errorCode } : {}),
          ...(session.result.errorMessage ? { errorMessage: session.result.errorMessage } : {}),
        }
      : { status: terminalStatus, summary: fallbackTerminalSummary(session) };
    return {
      phase: "terminal",
      headline: terminal.summary,
      milestone: { key: "terminal", label: terminalLabel(terminal.status), observedAt: session.finishedAt ?? session.updatedAt },
      terminal,
    };
  }
  if (reviewEvent) {
    return {
      phase: "review_ready",
      headline: "Review artifact is ready for handoff.",
      milestone: { key: "review_created", label: "Review ready", observedAt: reviewEvent.timestamp },
      currentPhase: "delivery",
    };
  }
  const currentPhase = executionPhaseForEvent(executionEvent);
  if (session.state === "running" && executionEvent && currentPhase) {
    return {
      phase: "running",
      headline: `Direct execution is active in the ${currentPhase} phase.`,
      milestone: { key: "execution_running", label: "Execution active", observedAt: executionEvent.timestamp },
      currentPhase,
    };
  }
  if (session.state === "running") {
    return {
      phase: "running",
      headline: "Direct execution is active.",
      milestone: { key: "execution_started", label: "Execution started", observedAt: executionStartedEvent?.timestamp ?? session.startedAt ?? session.updatedAt },
    };
  }
  if (assignmentStates.has(session.state)) {
    return {
      phase: "assigned",
      headline: "Runner has claimed the Session and is preparing execution.",
      milestone: { key: "runner_assigned", label: "Runner assigned", observedAt: assignedEvent?.timestamp ?? session.updatedAt },
    };
  }
  return {
    phase: "queued",
    headline: "Waiting for Runner assignment.",
    milestone: { key: "queued", label: "Queued", observedAt: queuedEvent?.timestamp ?? session.createdAt },
  };
}

export function projectCoordinationSessionSummary(input: SummaryProjectionInput): CoordinationSessionSummary {
  const state = milestoneForSession(input);
  return coordinationSessionSummarySchema.parse({
    taskId: input.task.id,
    sessionId: input.session.id,
    ...(input.projectSlug ? { projectSlug: input.projectSlug } : {}),
    sessionState: input.session.state,
    phase: state.phase,
    headline: state.headline,
    milestone: state.milestone,
    ...(input.session.startedAt ? { startedAt: input.session.startedAt } : {}),
    ...(input.session.finishedAt ? { finishedAt: input.session.finishedAt } : {}),
    updatedAt: input.session.updatedAt,
    ...(state.currentPhase ? { currentPhase: state.currentPhase } : {}),
    ...(state.terminal ? { terminal: state.terminal } : {}),
    links: linkSummary(input.session),
  });
}
