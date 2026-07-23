import {
  coordinationRunSummarySchema,
  isTerminalRunState,
  type CoordinationMilestone,
  type CoordinationRunSummary,
  type RunEvent,
  type RunState,
  type RunResult,
} from "@mystra/shared";

import type { JobRecord, RunRecord } from "./db/rdb-provider";

type SummaryProjectionInput = {
  job: JobRecord;
  run: RunRecord;
  projectSlug?: string;
  recentEvents: RunEvent[];
};

const assignmentStates = new Set<RunState>(["assigned", "starting"]);
type TerminalStatus = NonNullable<CoordinationRunSummary["terminal"]>["status"];

function terminalLabel(status: TerminalStatus): string {
  switch (status) {
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "timed_out":
      return "Timed out";
    case "waiting_for_review":
      return "Waiting for review";
  }
}

function fallbackTerminalSummary(run: RunRecord): string {
  if (run.staleReason === "runner_stale") {
    return "Runner session became stale before the run reached a terminal result.";
  }
  return `Run ended with state ${run.state}.`;
}

function linkSummary(result: RunResult | undefined, branchName: string) {
  const review = result?.reviewResult?.review;
  const metadata = result?.metadata ?? {};
  const frontendPreviewUrl = typeof metadata.frontendPreviewUrl === "string" ? metadata.frontendPreviewUrl : undefined;
  const backendPreviewUrl = typeof metadata.backendPreviewUrl === "string" ? metadata.backendPreviewUrl : undefined;

  return {
    branch: result?.branch ?? branchName,
    ...(review?.url ? { reviewUrl: review.url } : result?.mrUrl ? { reviewUrl: result.mrUrl } : {}),
    ...(review?.displayId
      ? { reviewDisplayId: review.displayId }
      : typeof result?.mrIid === "number"
      ? { reviewDisplayId: String(result.mrIid) }
      : {}),
    ...(frontendPreviewUrl ? { frontendPreviewUrl } : {}),
    ...(backendPreviewUrl ? { backendPreviewUrl } : {}),
  };
}

function latestEvent(events: RunEvent[], types: readonly RunEvent["type"][]): RunEvent | undefined {
  return events.findLast((event) => types.includes(event.type));
}

function executionPhaseForEvent(
  event: RunEvent | undefined,
): CoordinationRunSummary["currentPhase"] {
  if (!event) {
    return undefined;
  }
  if ([
    "git.branch_created",
    "git.commit_created",
    "git.push_succeeded",
    "review.created",
    "review.reused",
  ].includes(event.type)) {
    return "delivery";
  }
  if (["preview.started", "preview.ready", "preview.failed"].includes(event.type)) {
    return "preview";
  }
  if (event.type.startsWith("quality.build.")) {
    return "build";
  }
  if (event.type.startsWith("quality.test.")) {
    return "test";
  }
  if (event.type.startsWith("agent.")) {
    return "agent";
  }
  if (event.type.startsWith("repository.clone.")) {
    return "clone";
  }
  return undefined;
}

function milestoneForRun(input: SummaryProjectionInput): {
  phase: CoordinationRunSummary["phase"];
  headline: string;
  milestone: CoordinationMilestone;
  sourceEventType: CoordinationRunSummary["sourceEventType"];
  currentPhase?: CoordinationRunSummary["currentPhase"];
  terminal?: CoordinationRunSummary["terminal"];
} {
  const { run, recentEvents } = input;
  const executionEvent = latestEvent(recentEvents, [
    "repository.clone.started",
    "repository.clone.succeeded",
    "agent.started",
    "agent.succeeded",
    "agent.failed",
    "quality.test.started",
    "quality.test.passed",
    "quality.test.failed",
    "quality.build.started",
    "quality.build.passed",
    "quality.build.failed",
    "preview.started",
    "preview.ready",
    "preview.failed",
    "git.branch_created",
    "git.commit_created",
    "git.push_succeeded",
    "review.created",
    "review.reused",
  ]);
  const reviewEvent = latestEvent(recentEvents, ["review.created", "review.reused"]);
  const executionStartedEvent = latestEvent(recentEvents, [
    "execution.started",
    "container.started",
    "agent.started",
  ]);
  const assignedEvent = latestEvent(recentEvents, ["run.assigned"]);
  const queuedEvent = latestEvent(recentEvents, ["run.queued"]);

  if (isTerminalRunState(run.state)) {
    const terminalStatus = run.result?.status ?? (run.state as TerminalStatus);
    const terminal = run.result
      ? {
          status: terminalStatus,
          summary: run.result.summary,
          ...(run.result.errorCode ? { errorCode: run.result.errorCode } : {}),
          ...(run.result.errorMessage ? { errorMessage: run.result.errorMessage } : {}),
        }
      : {
          status: terminalStatus,
          summary: fallbackTerminalSummary(run),
        };
    const observedAt = run.finishedAt ?? run.updatedAt;
    return {
      phase: "terminal",
      headline: terminal.summary,
      milestone: {
        key: "terminal",
        label: terminalLabel(terminal.status),
        observedAt,
      },
      sourceEventType: run.result ? "run.result" : "run.state",
      terminal,
    };
  }

  if (reviewEvent) {
    return {
      phase: "review_ready",
      headline: "Review artifact is ready for handoff.",
      milestone: {
        key: "review_created",
        label: "Review ready",
        observedAt: reviewEvent.timestamp,
      },
      sourceEventType: reviewEvent.type,
      currentPhase: "delivery",
    };
  }

  const currentPhase = executionPhaseForEvent(executionEvent);
  if (run.state === "running" && executionEvent && currentPhase) {
    return {
      phase: "running",
      headline: `Direct execution is running the ${currentPhase} phase.`,
      milestone: {
        key: "execution_running",
        label: "Execution running",
        observedAt: executionEvent.timestamp,
      },
      sourceEventType: executionEvent.type,
      currentPhase,
    };
  }

  if (run.state === "running" && executionStartedEvent) {
    return {
      phase: "running",
      headline: "Direct execution has started.",
      milestone: {
        key: "execution_started",
        label: "Execution started",
        observedAt: executionStartedEvent.timestamp,
      },
      sourceEventType: executionStartedEvent.type,
    };
  }

  if (run.state === "running") {
    return {
      phase: "running",
      headline: "Direct execution is running.",
      milestone: {
        key: "execution_started",
        label: "Execution started",
        observedAt: run.startedAt ?? run.updatedAt,
      },
      sourceEventType: "run.state",
    };
  }

  if (assignmentStates.has(run.state)) {
    return {
      phase: "assigned",
      headline: "Runner has claimed the task and is preparing execution.",
      milestone: {
        key: "runner_assigned",
        label: "Runner assigned",
        observedAt: assignedEvent?.timestamp ?? run.updatedAt,
      },
      sourceEventType: assignedEvent?.type ?? "run.state",
    };
  }

  return {
    phase: "queued",
    headline: "Waiting for runner assignment.",
    milestone: {
      key: "queued",
      label: "Queued",
      observedAt: queuedEvent?.timestamp ?? run.createdAt,
    },
    sourceEventType: queuedEvent?.type ?? "run.state",
  };
}

export function projectCoordinationRunSummary(input: SummaryProjectionInput): CoordinationRunSummary {
  const state = milestoneForRun(input);
  return coordinationRunSummarySchema.parse({
    jobId: input.job.id,
    runId: input.run.id,
    attempt: input.run.attempt,
    taskId: input.job.spec.taskId,
    ...(input.projectSlug ? { projectSlug: input.projectSlug } : {}),
    runState: input.run.state,
    phase: state.phase,
    headline: state.headline,
    milestone: state.milestone,
    sourceEventType: state.sourceEventType,
    ...(input.run.startedAt ? { startedAt: input.run.startedAt } : {}),
    ...(input.run.finishedAt ? { finishedAt: input.run.finishedAt } : {}),
    updatedAt: input.run.updatedAt,
    ...(state.currentPhase ? { currentPhase: state.currentPhase } : {}),
    ...(state.terminal ? { terminal: state.terminal } : {}),
    links: linkSummary(input.run.result, input.job.spec.branchName),
  });
}
