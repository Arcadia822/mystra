import {
  SKILL_MAX_ARCHIVE_BYTES,
  sessionClaimAssignmentSchema,
  sessionEventBatchSchema,
  workflowSkillProjectionReportSchema,
  type SessionClaimAssignment,
  type SessionEventInput,
  type WorkflowSkillProjectionReport,
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
  downloadWorkflowSkill(assignment: SessionClaimAssignment, downloadPath: string): Promise<Buffer>;
  reportWorkflowSkills(assignment: SessionClaimAssignment, report: WorkflowSkillProjectionReport): Promise<boolean>;
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

  async downloadWorkflowSkill(assignment: SessionClaimAssignment, downloadPath: string): Promise<Buffer> {
    const response = await fetch(new URL(downloadPath, this.endpoint), {
      headers: {
        "x-mystra-team-id": assignment.session.teamId,
        "x-mystra-lease-token": assignment.lease.leaseToken,
      },
    });
    if (!response.ok || !response.body) throw new SessionClientHttpError(response.status);
    const declared = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(declared) || declared < 1 || declared > SKILL_MAX_ARCHIVE_BYTES) {
      await response.body.cancel();
      throw new Error("Workflow Skill archive length is invalid");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > declared || size > SKILL_MAX_ARCHIVE_BYTES) {
        await reader.cancel();
        throw new Error("Workflow Skill archive exceeds its declared bound");
      }
      chunks.push(value);
    }
    if (size !== declared) throw new Error("Workflow Skill archive length does not match its response");
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
  }

  async reportWorkflowSkills(assignment: SessionClaimAssignment, untrustedReport: WorkflowSkillProjectionReport): Promise<boolean> {
    const report = workflowSkillProjectionReportSchema.parse(untrustedReport);
    const response = await fetch(new URL(
      `/api/runner/sessions/${encodeURIComponent(assignment.session.id)}/skills/report`,
      this.endpoint,
    ), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mystra-team-id": assignment.session.teamId,
        "x-mystra-lease-token": assignment.lease.leaseToken,
      },
      body: JSON.stringify(report),
    });
    await response.text();
    if (response.status === 409) return false;
    if (!response.ok) throw new SessionClientHttpError(response.status);
    return true;
  }
}
