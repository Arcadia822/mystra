import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

import {
  CodexProviderAdapter,
  CopilotProviderAdapter,
  createProviderSessionAdapter,
  type ProviderSessionCommand,
  type ProviderProcessResult,
} from "@mystra/agent-adapters";
import { agentCliBinDirectory } from "@mystra/agent-cli";
import type { SessionClaimAssignment, SessionEventInput } from "@mystra/shared";

import type { SessionControlPlaneClient } from "./session-client.js";
import { runProviderProcess, type ProviderProcessObserver } from "./provider-process.js";

type WorkspaceResolver = { resolveReadyWorkspace(ref: string): Promise<{ directory: string }> };

export async function executeSessionAssignment(input: {
  assignment: SessionClaimAssignment;
  client: Pick<SessionControlPlaneClient, "appendEvents">;
  workspace: WorkspaceResolver;
  providerExecutable: string;
  runProcess?: (
    command: ProviderSessionCommand,
    signal?: AbortSignal,
    observer?: ProviderProcessObserver,
  ) => Promise<ProviderProcessResult>;
  controlPlaneUrl?: string;
  signal?: AbortSignal;
}): Promise<void> {
  const { assignment } = input;
  let resolved: { directory: string };
  try {
    resolved = await input.workspace.resolveReadyWorkspace(assignment.workspace.workspaceRef);
  } catch {
    await input.client.appendEvents(assignment, [failureEvent(assignment, "workspace_unavailable", "Task Workspace is unavailable")]);
    return;
  }
  const message = assignment.message.content
    .map((part) => part.type === "text" ? part.text : `Artifact: ${part.artifactId}`)
    .join("\n");
  let adapter: ReturnType<typeof createProviderSessionAdapter>;
  let command: ProviderSessionCommand;
  try {
    adapter = createProviderSessionAdapter(baseAdapter(assignment.session.providerKey));
    command = assignment.lease.providerSessionId
      ? adapter.buildContinueCommand({
          mystraSessionId: assignment.session.id,
          providerSessionId: assignment.lease.providerSessionId,
          userMessage: message,
          workingDirectory: resolved.directory,
        })
      : adapter.buildStartCommand({
          mystraSessionId: assignment.session.id,
          systemPrompt: assignment.systemPrompt,
          userMessage: message,
          workingDirectory: resolved.directory,
        });
    if (!path.isAbsolute(input.providerExecutable)) {
      throw new Error("Provider executable must be an absolute discovered path");
    }
    command = {
      ...command,
      argv: [input.providerExecutable, ...command.argv.slice(1)],
    };
    if (assignment.execution) {
      if (!input.controlPlaneUrl) throw new Error("Control Plane URL is unavailable");
      command = {
        ...command,
        environment: {
          ...command.environment,
          PATH: [agentCliBinDirectory, process.env.PATH].filter(Boolean).join(path.delimiter),
          MYSTRA_CONTROL_PLANE_URL: input.controlPlaneUrl,
          MYSTRA_EXECUTION_CODE: assignment.execution.code,
        },
      };
    }
  } catch {
    await input.client.appendEvents(assignment, [failureEvent(assignment, "provider_unavailable", "Provider is unsupported by this Runtime")]);
    return;
  }
  let sequence = 1;
  const event = (kind: SessionEventInput["kind"], payload: SessionEventInput["payload"], messageId?: string): SessionEventInput => ({
    eventId: randomUUID(), sessionId: assignment.session.id, sourceId: `${assignment.lease.runnerId}:${assignment.message.messageId}`,
    sourceSequence: sequence++, kind, version: 1, ...(messageId ? { messageId } : {}), payload, metadata: {}, occurredAt: new Date().toISOString(),
  });
  let responseStarted = false;
  let startEventsPromise: Promise<void> = Promise.resolve();
  const publishResponseStarted = (providerSessionId?: string): Promise<void> => {
    if (responseStarted) return startEventsPromise;
    responseStarted = true;
    const events: SessionEventInput[] = [];
    if (!assignment.lease.providerSessionId && providerSessionId) {
      events.push(event("session.provider_started", { providerSessionId }));
    }
    events.push(event("session.response_started", {}, assignment.message.messageId));
    startEventsPromise = input.client.appendEvents(assignment, events);
    void startEventsPromise.catch(() => undefined);
    return startEventsPromise;
  };
  let codexOutput = "";
  const observer: ProviderProcessObserver | undefined = assignment.session.providerKey === "codex"
    && !assignment.lease.providerSessionId
    ? {
        onStdoutChunk(chunk) {
          if (responseStarted) return;
          codexOutput = (codexOutput + chunk).slice(-65_536);
          const providerSessionId = extractCodexThreadId(codexOutput);
          if (providerSessionId) void publishResponseStarted(providerSessionId);
        },
      }
    : undefined;
  if (assignment.lease.providerSessionId) {
    await publishResponseStarted();
  } else if (assignment.session.providerKey === "copilot") {
    await publishResponseStarted(assignment.session.id);
  }
  let result: ProviderProcessResult;
  try {
    result = await (input.runProcess ?? runProviderProcess)(command, input.signal, observer);
    await startEventsPromise;
  } catch {
    if (input.signal?.aborted) {
      await startEventsPromise;
      await input.client.appendEvents(assignment, responseStarted
        ? [event("session.response_canceled", { reason: "Runtime assignment was canceled" }, assignment.message.messageId)]
        : cancellationEvents(assignment));
      return;
    }
    await startEventsPromise;
    await input.client.appendEvents(assignment, responseStarted
      ? [event("session.response_failed", { code: "provider_start_failed", message: "Provider process failed to start" }, assignment.message.messageId)]
      : [failureEvent(assignment, "provider_start_failed", "Provider process failed to start")]);
    return;
  }
  let parsed: ReturnType<typeof adapter.parseResult>;
  try {
    parsed = adapter.parseResult(result);
  } catch {
    await input.client.appendEvents(assignment, responseStarted
      ? [event("session.response_failed", { code: "provider_result_invalid", message: "Provider result could not be parsed" }, assignment.message.messageId)]
      : [failureEvent(assignment, "provider_result_invalid", "Provider result could not be parsed")]);
    return;
  }
  const providerSessionId = parsed.providerSessionId ?? assignment.lease.providerSessionId ?? assignment.session.id;
  await publishResponseStarted(providerSessionId);
  const events: SessionEventInput[] = [];
  const assistantMessage = redactExecutionCode(
    extractAssistantMessage(assignment.session.providerKey, result.stdout),
    assignment.execution?.code,
  );
  if (assistantMessage) {
    events.push(event("session.agent_message_chunk", { text: assistantMessage.slice(0, 32_768) }, assignment.message.messageId));
  }
  events.push(parsed.success
    ? event("session.response_completed", { stopReason: "end_turn" }, assignment.message.messageId)
    : event("session.response_failed", { code: "provider_failed", message: `Provider execution failed with exit code ${result.exitCode}` }, assignment.message.messageId));
  await input.client.appendEvents(assignment, events);
}

function extractCodexThreadId(stdout: string): string | undefined {
  for (const line of stdout.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as { type?: unknown; thread_id?: unknown };
      if (value.type === "thread.started" && typeof value.thread_id === "string" && value.thread_id.length > 0) {
        return value.thread_id;
      }
    } catch {
      // Partial and diagnostic lines are retained until a complete thread event arrives.
    }
  }
  return undefined;
}

function cancellationEvents(assignment: SessionClaimAssignment): SessionEventInput[] {
  const timestamp = new Date().toISOString();
  const sourceId = `${assignment.lease.runnerId}:${assignment.message.messageId}`;
  return [
    {
      eventId: randomUUID(), sessionId: assignment.session.id, sourceId, sourceSequence: 1,
      kind: "session.response_started", version: 1, messageId: assignment.message.messageId,
      payload: {}, metadata: {}, occurredAt: timestamp,
    },
    {
      eventId: randomUUID(), sessionId: assignment.session.id, sourceId, sourceSequence: 2,
      kind: "session.response_canceled", version: 1, messageId: assignment.message.messageId,
      payload: { reason: "Runtime assignment was canceled" }, metadata: {}, occurredAt: timestamp,
    },
  ];
}

function extractAssistantMessage(providerKey: string, stdout: string): string | undefined {
  if (providerKey === "copilot") {
    const assistantOutput = stdout.split(/\n{2,}Changes\s/u, 1)[0]?.trim();
    return assistantOutput || undefined;
  }
  const messages: string[] = [];
  for (const line of stdout.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as { type?: unknown; item?: { type?: unknown; text?: unknown } };
      if (value.type === "item.completed" && value.item?.type === "agent_message" && typeof value.item.text === "string") {
        messages.push(value.item.text);
      }
    } catch {
      // Codex diagnostics are not Session messages and are intentionally discarded.
    }
  }
  return messages.join("\n").trim() || undefined;
}

function redactExecutionCode(message: string | undefined, executionCode: string | undefined): string | undefined {
  if (!message || !executionCode) return message;
  return message.replaceAll(executionCode, "[REDACTED]");
}

function failureEvent(
  assignment: SessionClaimAssignment,
  code: string,
  message: string,
): SessionEventInput {
  return {
    eventId: randomUUID(),
    sessionId: assignment.session.id,
    sourceId: `${assignment.lease.runnerId}:${assignment.message.messageId}`,
    sourceSequence: 1,
    kind: "session.failed",
    version: 1,
    messageId: assignment.message.messageId,
    payload: { code, message },
    metadata: {},
    occurredAt: new Date().toISOString(),
  };
}

function baseAdapter(providerKey: string) {
  if (providerKey === "codex") return new CodexProviderAdapter();
  if (providerKey === "copilot") {
    const home = homedir();
    return new CopilotProviderAdapter({
      homeDir: home,
      configDir: process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
      cacheDir: process.env.XDG_CACHE_HOME ?? path.join(home, ".cache"),
      cliConfigDir: process.env.COPILOT_CLI_CONFIG_DIR ?? path.join(home, ".copilot"),
    });
  }
  throw new Error(`Unsupported Provider ${providerKey}`);
}
