import {
  agentTaskStatusSetRequestSchema,
  workloadExecutionContextSchema,
  type AgentTaskStatusSetRequest,
  workflowTransitionRequestSchema,
  type WorkflowTransitionRequest,
} from "@mystra/shared";
import { randomUUID } from "node:crypto";

import { AgentCliFailure, AgentExecutionClient } from "./client.js";
import { materializeWorkflowSkills, WorkflowMaterializationError } from "./workflow-materializer.js";

type Io = { write(value: string): void };

export async function runAgentCli(input: {
  argv: string[];
  env: Record<string, string | undefined>;
  cwd: () => string;
  fetch?: typeof fetch;
  stdout: Io;
  stderr: Io;
}): Promise<number> {
  try {
    const endpoint = input.env.MYSTRA_CONTROL_PLANE_URL;
    const executionCode = input.env.MYSTRA_EXECUTION_CODE;
    if (!endpoint) throw new AgentCliFailure("invalid_request", "MYSTRA_CONTROL_PLANE_URL is required");
    if (!executionCode) throw new AgentCliFailure("capability_expired", "MYSTRA_EXECUTION_CODE is required");
    const client = new AgentExecutionClient({ endpoint, executionCode, ...(input.fetch ? { fetch: input.fetch } : {}) });
    const [first, second, third, ...rest] = input.argv;
    let result: unknown;
    if (first === "whoami" && second === undefined) {
      result = await client.whoami();
    } else if (first === "context" && second === "get" && third === undefined) {
      const context = await client.context();
      result = workloadExecutionContextSchema.parse({
        ...context,
        workspace: { ...context.workspace, root: input.cwd() },
      });
    } else if (first === "task" && second === "status" && third === "get" && rest.length === 0) {
      result = await client.taskStatus();
    } else if (first === "task" && second === "status" && third === "set") {
      result = await client.setTaskStatus(parseStatusSet(rest));
    } else if (first === "workflow" && second === "current" && (third === undefined || (third === "--json" && rest.length === 0))) {
      const current = await client.workflowCurrent();
      await reconcileWorkflowSkills(client, current.materialization, input.cwd(), current);
      result = current;
    } else if (first === "workflow" && second === "transition" && third !== undefined) {
      const transition = await client.workflowTransition(parseWorkflowTransition(third, rest));
      await reconcileWorkflowSkills(client, transition.current.materialization, input.cwd(), transition);
      result = transition;
    } else if (first === "workflow" && second === "help" && third === undefined) {
      result = {
        usage: [
          "mystra-agent workflow current [--json]",
          "mystra-agent workflow transition <action-id> --expected-revision <n> [--command-id <uuid>] [--json]",
        ],
      };
    } else {
      throw new AgentCliFailure("invalid_request", "Invalid mystra-agent command");
    }
    input.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const failure = error instanceof AgentCliFailure
      ? error
      : new AgentCliFailure("invalid_request", error instanceof Error ? error.message : "Invalid command");
    input.stderr.write(`${JSON.stringify({ error: { code: failure.code, message: failure.message, ...(failure.details ?? {}) } })}\n`);
    return input.argv[0] === "workflow"
      ? workflowExitCode(failure.code)
      : failure.code === "invalid_request" ? 2 : 1;
  }
}

async function reconcileWorkflowSkills(
  client: AgentExecutionClient,
  assignment: import("@mystra/shared").WorkflowSkillProjectionAssignment,
  workspaceDirectory: string,
  authority: import("@mystra/shared").WorkflowCurrentResponse | import("@mystra/shared").WorkflowTransitionResponse,
) {
  if (assignment.entries.length === 0 && assignment.removals.length === 0) return;
  try {
    await materializeWorkflowSkills({
      assignment, workspaceDirectory,
      download: (entry) => client.workflowSkillDownload(entry.downloadPath),
    });
    const ready = {
      workspaceId: assignment.workspaceId, generation: assignment.generation,
      results: assignment.entries.map(({ skillId }) => ({ skillId, status: "ready" as const, failureCode: null })),
    };
    if (!(await client.workflowSkillReport(ready))) {
      throw new WorkflowMaterializationError("publish_failed", "Workflow Skill report was stale");
    }
  } catch (error) {
    const failureCode = error instanceof WorkflowMaterializationError ? error.code : "publish_failed";
    await client.workflowSkillReport({
      workspaceId: assignment.workspaceId, generation: assignment.generation,
      results: assignment.entries.map(({ skillId }) => ({ skillId, status: "failed", failureCode })),
    }).catch(() => false);
    throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skills could not be materialized", { authority });
  }
}

function parseWorkflowTransition(actionId: string, args: string[]): WorkflowTransitionRequest {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]!;
    if (flag === "--json") continue;
    const value = args[index + 1];
    if (!["--expected-revision", "--command-id"].includes(flag) || value === undefined || value.startsWith("--")) {
      throw new AgentCliFailure("invalid_request", `Invalid Workflow flag ${flag}`);
    }
    if (values.has(flag)) throw new AgentCliFailure("invalid_request", `Duplicate flag ${flag}`);
    values.set(flag, value);
    index += 1;
  }
  return workflowTransitionRequestSchema.parse({
    commandId: values.get("--command-id") ?? randomUUID(),
    actionId,
    expectedStateVersion: Number(values.get("--expected-revision")),
  });
}

function workflowExitCode(code: string): number {
  const workflowCodes: Record<string, number> = {
    workflow_not_enabled: 4,
    workflow_action_not_allowed: 5,
    workflow_state_conflict: 6,
    workflow_command_conflict: 7,
    workflow_skill_resolution_failed: 8,
    workflow_skill_projection_failed: 9,
    scope_mismatch: 10,
    capability_expired: 11,
  };
  return workflowCodes[code] ?? (code === "invalid_request" ? 2 : 1);
}

function parseStatusSet(args: string[]): AgentTaskStatusSetRequest {
  const [status, ...flags] = args;
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new AgentCliFailure("invalid_request", "Status flags require values");
    }
    if (values.has(flag)) throw new AgentCliFailure("invalid_request", `Duplicate flag ${flag}`);
    values.set(flag, value);
  }
  for (const flag of values.keys()) {
    if (!["--expected-revision", "--idempotency-key", "--note"].includes(flag)) {
      throw new AgentCliFailure("invalid_request", `Unknown flag ${flag}`);
    }
  }
  const parsedRevision = Number(values.get("--expected-revision"));
  return agentTaskStatusSetRequestSchema.parse({
    status,
    expectedRevision: parsedRevision,
    idempotencyKey: values.get("--idempotency-key"),
    ...(values.has("--note") ? { note: values.get("--note") } : {}),
  });
}

export async function main(): Promise<void> {
  process.exitCode = await runAgentCli({
    argv: process.argv.slice(2),
    env: process.env,
    cwd: process.cwd,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
