import {
  agentTaskStatusSetRequestSchema,
  workloadExecutionContextSchema,
  type AgentTaskStatusSetRequest,
} from "@mystra/shared";

import { AgentCliFailure, AgentExecutionClient } from "./client.js";

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
    } else {
      throw new AgentCliFailure("invalid_request", "Invalid mystra-agent command");
    }
    input.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const failure = error instanceof AgentCliFailure
      ? error
      : new AgentCliFailure("invalid_request", error instanceof Error ? error.message : "Invalid command");
    input.stderr.write(`${JSON.stringify({ error: { code: failure.code, message: failure.message } })}\n`);
    return failure.code === "invalid_request" ? 2 : 1;
  }
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
