import {
  sessionClaimAssignmentSchema,
  sessionEventBatchSchema,
  type SessionClaimAssignment,
  type SessionEventInput,
} from "@mystra/shared";

export class SessionClientHttpError extends Error {
  constructor(readonly status: number) {
    super(`Session control plane request failed (${status})`);
    this.name = "SessionClientHttpError";
  }
}

export interface SessionControlPlaneClient {
  claim(runtimeId: string, runnerId: string, waitSeconds: number): Promise<SessionClaimAssignment | undefined>;
  appendEvents(assignment: SessionClaimAssignment, events: SessionEventInput[]): Promise<void>;
}

export class HttpSessionControlPlaneClient implements SessionControlPlaneClient {
  constructor(private readonly endpoint: string) {}

  async claim(runtimeId: string, runnerId: string, waitSeconds: number): Promise<SessionClaimAssignment | undefined> {
    const response = await fetch(new URL("/api/runner/sessions/claim", this.endpoint), {
      method: "POST",
      headers: { "content-type": "application/json", "x-mystra-runtime-id": runtimeId },
      body: JSON.stringify({ runnerId, waitSeconds }),
    });
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!response.ok) throw new SessionClientHttpError(response.status);
    const value = JSON.parse(text) as { assignment?: unknown };
    return sessionClaimAssignmentSchema.parse(value.assignment);
  }

  async appendEvents(assignment: SessionClaimAssignment, events: SessionEventInput[]): Promise<void> {
    const batch = sessionEventBatchSchema.parse({ leaseToken: assignment.lease.leaseToken, events });
    const body = JSON.stringify(batch);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(new URL(
          `/api/runner/sessions/${encodeURIComponent(assignment.session.id)}/events`,
          this.endpoint,
        ), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-mystra-team-id": assignment.session.teamId,
            "x-mystra-lease-token": assignment.lease.leaseToken,
          },
          body,
        });
        await response.text();
        if (response.ok) return;
        const error = new SessionClientHttpError(response.status);
        if (response.status < 500) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof SessionClientHttpError && error.status < 500) throw error;
        lastError = error;
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
    throw lastError ?? new Error("Session event append failed");
  }
}
