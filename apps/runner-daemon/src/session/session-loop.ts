import { randomUUID } from "node:crypto";

import type { SessionControlPlaneClient } from "./session-client.js";
import { executeSessionAssignment } from "./session-worker.js";

export async function runSessionLoop(input: {
  runtimeId: string;
  runnerId: string;
  client: SessionControlPlaneClient;
  workspace: { resolveReadyWorkspace(ref: string): Promise<{ directory: string }> };
  providerExecutables: ReadonlyMap<string, string>;
  waitSeconds: number;
  retryIntervalSeconds: number;
  controlPlaneUrl?: string;
  signal: AbortSignal;
}): Promise<void> {
  const active = new Set<string>();
  while (!input.signal.aborted) {
    try {
      const assignment = await input.client.claim(input.runtimeId, input.runnerId, input.waitSeconds);
      if (!assignment) {
        await abortableSleep(input.retryIntervalSeconds * 1_000, input.signal).catch(() => undefined);
        continue;
      }
      if (active.has(assignment.session.id)) continue;
      active.add(assignment.session.id);
      const providerExecutable = input.providerExecutables.get(assignment.session.providerKey);
      if (!providerExecutable) {
        active.delete(assignment.session.id);
        await input.client.appendEvents(assignment, [{
          eventId: randomUUID(),
          sessionId: assignment.session.id,
          sourceId: `${assignment.lease.runnerId}:${assignment.message.messageId}`,
          sourceSequence: 1,
          kind: "session.failed",
          version: 1,
          messageId: assignment.message.messageId,
          payload: { code: "provider_unavailable", message: "Provider executable is unavailable on this Runtime" },
          metadata: {},
          occurredAt: new Date().toISOString(),
        }]);
        continue;
      }
      void executeSessionAssignment({
        assignment,
        client: input.client,
        workspace: input.workspace,
        providerExecutable,
        ...(input.controlPlaneUrl ? { controlPlaneUrl: input.controlPlaneUrl } : {}),
        signal: input.signal,
      }).finally(() => active.delete(assignment.session.id));
    } catch {
      await abortableSleep(input.retryIntervalSeconds * 1_000, input.signal).catch(() => undefined);
    }
  }
  while (active.size > 0) await abortableSleep(10, input.signal).catch(() => undefined);
}

function abortableSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}
