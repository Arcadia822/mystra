import {
  workspacePreparationClaimSchema,
  type WorkspacePreparationClaim,
  type WorkspacePreparationReport,
} from "@mystra/shared";

import {
  WorkspaceMaterializationError,
  type WorkspaceMaterializer,
} from "./workspace-materializer.js";

export class WorkspaceLoopHttpError extends Error {
  constructor(readonly status: number, responseText: string) {
    super(`Workspace control plane request failed (${status}): ${responseText}`);
    this.name = "WorkspaceLoopHttpError";
  }
}

export interface WorkspaceControlPlaneClient {
  claim(runnerId: string, waitSeconds: number): Promise<WorkspacePreparationClaim | undefined>;
  report(
    workspaceId: string,
    attemptId: string,
    report: WorkspacePreparationReport,
  ): Promise<void>;
  reportMissing?(workspaceId: string, runnerId: string): Promise<void>;
}

type WorkspaceLoopInput = {
  runnerId: string;
  client: WorkspaceControlPlaneClient;
  materializer: Pick<WorkspaceMaterializer, "materialize">;
  waitSeconds: number;
  retryIntervalSeconds: number;
  signal: AbortSignal;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

export class HttpWorkspaceControlPlaneClient implements WorkspaceControlPlaneClient {
  readonly #endpoint: string;

  constructor(endpoint: string) {
    this.#endpoint = endpoint;
  }

  async claim(runnerId: string, waitSeconds: number): Promise<WorkspacePreparationClaim | undefined> {
    const response = await fetch(new URL("/api/runner/workspaces/claim", this.#endpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runnerId, waitSeconds }),
    });
    if (response.status === 204) return undefined;
    const responseText = await response.text();
    if (!response.ok) throw new WorkspaceLoopHttpError(response.status, responseText);
    return workspacePreparationClaimSchema.parse(JSON.parse(responseText));
  }

  async report(
    workspaceId: string,
    attemptId: string,
    report: WorkspacePreparationReport,
  ): Promise<void> {
    const response = await fetch(new URL(
      `/api/runner/workspaces/${encodeURIComponent(workspaceId)}/attempts/${encodeURIComponent(attemptId)}`,
      this.#endpoint,
    ), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
    const responseText = await response.text();
    if (!response.ok) throw new WorkspaceLoopHttpError(response.status, responseText);
  }

  async reportMissing(workspaceId: string, runnerId: string): Promise<void> {
    const response = await fetch(new URL(
      `/api/runner/workspaces/${encodeURIComponent(workspaceId)}/availability`,
      this.#endpoint,
    ), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runnerId,
        status: "missing",
        failure: { code: "workspace_missing", message: "Task Workspace directory or repository is unavailable" },
      }),
    });
    const responseText = await response.text();
    if (!response.ok) throw new WorkspaceLoopHttpError(response.status, responseText);
  }
}

export async function resolveTaskWorkspaceForSession(input: {
  workspaceRef: string;
  runnerId: string;
  client: Pick<WorkspaceControlPlaneClient, "reportMissing">;
  materializer: Pick<WorkspaceMaterializer, "resolveReadyWorkspace">;
}) {
  try {
    return await input.materializer.resolveReadyWorkspace(input.workspaceRef);
  } catch (error) {
    const workspaceId = /^host-task-workspace:([0-9a-f-]{36})$/iu.exec(input.workspaceRef)?.[1];
    if (
      workspaceId
      && error instanceof WorkspaceMaterializationError
      && error.code === "workspace_missing"
      && input.client.reportMissing
    ) {
      await input.client.reportMissing(workspaceId, input.runnerId);
    }
    throw error;
  }
}

export async function processNextWorkspace(input: WorkspaceLoopInput): Promise<boolean> {
  const claim = await input.client.claim(input.runnerId, input.waitSeconds);
  if (!claim) return false;
  let report: WorkspacePreparationReport;
  try {
    report = await input.materializer.materialize(claim, input.runnerId);
  } catch (error) {
    const code = error instanceof WorkspaceMaterializationError ? error.code : "unknown";
    report = {
      runnerId: input.runnerId,
      attemptSequence: claim.attemptSequence,
      status: "failed",
      failure: {
        code: "materialization_failed",
        message: `Workspace materialization failed (${code})`,
      },
    };
  }
  await reportUntilAccepted(input, claim, report);
  return true;
}

export async function runWorkspaceLoop(input: WorkspaceLoopInput): Promise<void> {
  const wait = input.sleep ?? abortableSleep;
  while (!input.signal.aborted) {
    try {
      await processNextWorkspace({ ...input, sleep: wait });
    } catch {
      if (input.signal.aborted) return;
      await wait(input.retryIntervalSeconds * 1_000, input.signal).catch(() => undefined);
    }
  }
}

async function reportUntilAccepted(
  input: WorkspaceLoopInput,
  claim: WorkspacePreparationClaim,
  report: WorkspacePreparationReport,
): Promise<void> {
  const wait = input.sleep ?? abortableSleep;
  while (!input.signal.aborted) {
    try {
      await input.client.report(claim.workspaceId, claim.attemptId, report);
      return;
    } catch (error) {
      if (error instanceof WorkspaceLoopHttpError && error.status === 409) return;
      await wait(input.retryIntervalSeconds * 1_000, input.signal);
    }
  }
}

function abortableSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Runner stopped"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
