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
    case "needs_human_review":
      return "Needs human review";
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
  return events.find((event) => types.includes(event.type));
}

function milestoneForRun(input: SummaryProjectionInput): {
  phase: CoordinationRunSummary["phase"];
  headline: string;
  milestone: CoordinationMilestone;
  sourceEventType: CoordinationRunSummary["sourceEventType"];
  currentNodeId?: string;
  terminal?: CoordinationRunSummary["terminal"];
} {
  const { run, recentEvents } = input;
  const currentNodeEvent = latestEvent(recentEvents, ["workflow.node.started"]);
  const reviewEvent = latestEvent(recentEvents, ["review.created", "mr.created"]);
  const workflowStartedEvent = latestEvent(recentEvents, ["workflow.started", "container.started", "agent.started"]);
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
      ...(currentNodeEvent && typeof currentNodeEvent.data.nodeId === "string"
        ? { currentNodeId: currentNodeEvent.data.nodeId }
        : {}),
    };
  }

  if (run.state === "running" && currentNodeEvent && typeof currentNodeEvent.data.nodeId === "string") {
    return {
      phase: "running",
      headline: `Workflow is executing ${currentNodeEvent.data.nodeId}.`,
      milestone: {
        key: "workflow_running",
        label: "Workflow running",
        observedAt: currentNodeEvent.timestamp,
      },
      sourceEventType: currentNodeEvent.type,
      currentNodeId: currentNodeEvent.data.nodeId,
    };
  }

  if (run.state === "running" && workflowStartedEvent) {
    return {
      phase: "running",
      headline: "Workflow is running.",
      milestone: {
        key: "workflow_started",
        label: "Workflow started",
        observedAt: workflowStartedEvent.timestamp,
      },
      sourceEventType: workflowStartedEvent.type,
    };
  }

  if (run.state === "running") {
    return {
      phase: "running",
      headline: "Workflow is running.",
      milestone: {
        key: "workflow_started",
        label: "Workflow started",
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
    ...(state.currentNodeId ? { currentNodeId: state.currentNodeId } : {}),
    ...(state.terminal ? { terminal: state.terminal } : {}),
    links: linkSummary(input.run.result, input.job.spec.branchName),
  });
}
