import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  sessionClaimAssignmentSchema,
  sessionClaimRequestSchema,
  sessionEventBatchSchema,
  effectiveSystemPromptEvidenceSchema,
  type SessionClaimAssignment,
} from "@mystra/shared";

import type { RdbProvider } from "../db/rdb-provider";
import { SessionFailure } from "./session-errors";

type RuntimeSessionDb = Pick<RdbProvider,
  "claimSession" | "listSessionEvents" | "appendSessionEvents" | "updateSessionLeaseProviderId" |
  "listExpiredSessionLeases" | "getSession"
>;

function hashLeaseToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class RuntimeSessionService {
  readonly #db: RuntimeSessionDb;
  readonly #now: () => Date;
  readonly #newId: () => string;
  readonly #newToken: () => string;
  readonly #newExecutionCode: () => string;

  constructor(input: { db: RuntimeSessionDb; now?: () => Date; newId?: () => string; newToken?: () => string; newExecutionCode?: () => string }) {
    this.#db = input.db;
    this.#now = input.now ?? (() => new Date());
    this.#newId = input.newId ?? randomUUID;
    this.#newToken = input.newToken ?? (() => randomBytes(32).toString("base64url"));
    this.#newExecutionCode = input.newExecutionCode ?? (() => randomBytes(32).toString("base64url"));
  }

  async claim(input: { runtimeId: string; request: unknown }): Promise<SessionClaimAssignment | undefined> {
    const request = sessionClaimRequestSchema.parse(input.request);
    const now = this.#now();
    const leaseToken = this.#newToken();
    const executionCode = this.#newExecutionCode();
    const executionCodeExpiresAt = new Date(now.getTime() + 6 * 60 * 60_000).toISOString();
    const lease = {
      id: this.#newId(),
      runtimeId: input.runtimeId,
      runnerId: request.runnerId,
      leaseToken,
      leaseTokenHash: hashLeaseToken(leaseToken),
      executionCodeHash: hashLeaseToken(executionCode),
      executionCodeExpiresAt,
      providerSessionId: null,
      leaseExpiresAt: new Date(now.getTime() + 6 * 60 * 60_000).toISOString(),
      claimedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const claimed = await this.#db.claimSession({ runtimeId: input.runtimeId, runnerId: request.runnerId, lease });
    if (!claimed) return undefined;
    const page = await this.#db.listSessionEvents({ sessionId: claimed.session.id, teamId: claimed.session.teamId, limit: 100 });
    const promptEvent = page.events.find((event) => event.kind === "session.system_prompt_configured");
    const workspaceEvent = page.events.find((event) => event.kind === "session.workspace_attached");
    const messageEvent = page.events.find((event) => (
      event.kind === "session.user_message_submitted"
      && event.messageId === claimed.session.activeMessageId
    ));
    if (!promptEvent || !workspaceEvent || !messageEvent?.messageId) {
      throw new SessionFailure("session_conflict", "Claimed Session has incomplete launch events");
    }
    const promptEvidence = effectiveSystemPromptEvidenceSchema.parse(promptEvent.payload);
    return sessionClaimAssignmentSchema.parse({
      session: claimed.session,
      lease: { ...claimed.lease, sessionId: claimed.session.id },
      systemPrompt: promptEvidence.finalPrompt,
      workspace: workspaceEvent.payload,
      message: { messageId: messageEvent.messageId, content: messageEvent.payload.content },
      ...(claimed.executionCodeExpiresAt ? {
        execution: {
          code: executionCode,
          expiresAt: claimed.executionCodeExpiresAt,
          capabilities: ["context:read", "task-status:read", "task-status:transition"],
        },
      } : {}),
    });
  }

  async appendEvents(input: { sessionId: string; teamId: string; leaseToken: string; batch: unknown }) {
    const batch = sessionEventBatchSchema.parse(input.batch);
    if (batch.leaseToken !== input.leaseToken) throw new SessionFailure("lease_invalid", "Lease token header and body differ");
    return this.#db.appendSessionEvents({
      sessionId: input.sessionId,
      teamId: input.teamId,
      leaseTokenHash: hashLeaseToken(input.leaseToken),
      events: batch.events,
    });
  }

  async setProviderSessionId(input: { sessionId: string; leaseToken: string; providerSessionId: string }): Promise<void> {
    const updated = await this.#db.updateSessionLeaseProviderId({
      sessionId: input.sessionId,
      leaseTokenHash: hashLeaseToken(input.leaseToken),
      providerSessionId: input.providerSessionId,
    });
    if (!updated) throw new SessionFailure("lease_invalid", "Session lease is invalid");
  }

  async reconcileExpiredLeases(isRuntimeOnline: (runtimeId: string) => Promise<boolean>): Promise<number> {
    const now = this.#now().toISOString();
    const leases = await this.#db.listExpiredSessionLeases(now);
    let failed = 0;
    for (const lease of leases) {
      if (await isRuntimeOnline(lease.runtimeId)) continue;
      const session = await this.#db.getSession(lease.sessionId, { teamId: lease.teamId });
      if (!session || session.state === "closed" || session.state === "failed") continue;
      await this.#db.appendSessionEvents({
        sessionId: session.id,
        teamId: session.teamId,
        events: [{
          eventId: this.#newId(),
          sessionId: session.id,
          sourceId: `control-plane:lease-reaper:${lease.id}`,
          sourceSequence: 1,
          kind: "session.runtime_lost",
          version: 1,
          payload: { code: "runtime_lost", message: "Runtime went offline after its Session lease expired" },
          metadata: {},
          occurredAt: now,
        }],
      });
      failed += 1;
    }
    return failed;
  }

}
