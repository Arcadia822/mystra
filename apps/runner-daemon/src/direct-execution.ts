import type {
  AgentExecutionMetadata,
  QualityPhaseResult,
  QualityResult,
  SessionEventSeverity,
  SessionEventType,
} from "@mystra/shared";

type PhaseEnvironment = {
  environment: NodeJS.ProcessEnv;
};

type SecretBinding = {
  name: string;
  value: string;
};

type AgentPhaseResult = {
  exitCode: number;
  cliVersion: string;
  changedFiles: string[];
};

export interface DirectExecutionDependencies {
  emit(
    type: SessionEventType,
    data?: Record<string, unknown>,
    severity?: SessionEventSeverity,
  ): Promise<void>;
  launchSandbox(input: PhaseEnvironment): Promise<void>;
  clone(input: PhaseEnvironment): Promise<{ baseCommit: string }>;
  runAgent(input: PhaseEnvironment): Promise<AgentPhaseResult>;
  runTest(input: PhaseEnvironment): Promise<QualityPhaseResult>;
  runBuild(input: PhaseEnvironment): Promise<QualityPhaseResult>;
}

export type DirectExecutionResult =
  | {
      status: "succeeded";
      baseCommit: string;
      agentExecution: AgentExecutionMetadata;
      quality: QualityResult;
    }
  | {
      status: "failed";
      summary: string;
      errorCode: string;
      agentExecution?: AgentExecutionMetadata;
      quality?: QualityResult;
    };

function scopedEnvironment(secret: SecretBinding | undefined): NodeJS.ProcessEnv {
  return secret ? { [secret.name]: secret.value } : {};
}

function failure(
  errorCode: string,
  summary: string,
  detail: {
    agentExecution?: AgentExecutionMetadata;
    quality?: QualityResult;
  } = {},
): DirectExecutionResult {
  return {
    status: "failed",
    summary,
    errorCode,
    ...detail,
  };
}

/**
 * The direct execution contract is intentionally boring:
 *
 * launch sandbox
 *      |
 *    clone
 *      |
 * Copilot Agent
 *      |
 *     test
 *      |
 *    build
 *
 * Preview and repository delivery are later handoff phases. This service owns
 * the fixed sequence directly.
 */
export async function executeDirectExecution(input: {
  repositorySecret?: SecretBinding;
  agentSecret?: SecretBinding;
  maxAutopilotContinues?: number;
  dependencies: DirectExecutionDependencies;
}): Promise<DirectExecutionResult> {
  const { dependencies } = input;
  await dependencies.emit("execution.started");

  try {
    await dependencies.launchSandbox({ environment: {} });
  } catch (error) {
    return failure(
      "sandbox_launch_failed",
      error instanceof Error ? error.message : "Sandbox launch failed",
    );
  }

  await dependencies.emit("repository.clone.started");
  let clone: { baseCommit: string };
  try {
    clone = await dependencies.clone({
      environment: scopedEnvironment(input.repositorySecret),
    });
  } catch (error) {
    return failure(
      "repository_clone_failed",
      error instanceof Error ? error.message : "Repository clone failed",
    );
  }
  await dependencies.emit("repository.clone.succeeded", {
    baseCommit: clone.baseCommit,
  });

  await dependencies.emit("agent.started", {
    agent: "copilot",
    mode: "autopilot",
    maxAutopilotContinues: input.maxAutopilotContinues ?? 10,
  });
  let agent: AgentPhaseResult;
  try {
    agent = await dependencies.runAgent({
      environment: scopedEnvironment(input.agentSecret),
    });
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Agent execution failed";
    await dependencies.emit("agent.failed", { summary }, "error");
    return failure("agent_failed", summary);
  }
  const agentExecution: AgentExecutionMetadata = {
    agent: "copilot",
    cliVersion: agent.cliVersion,
    mode: "autopilot",
    maxAutopilotContinues: input.maxAutopilotContinues ?? 10,
    exitCode: agent.exitCode,
    changedFiles: agent.changedFiles,
  };
  if (agent.exitCode !== 0) {
    const summary = `Copilot exited with ${agent.exitCode}`;
    await dependencies.emit("agent.failed", {
      summary,
      exitCode: agent.exitCode,
    }, "error");
    return failure("agent_failed", summary, { agentExecution });
  }
  if (agent.changedFiles.length === 0) {
    const summary = "Agent finished without repository changes";
    await dependencies.emit("agent.failed", { summary }, "error");
    return failure("no_changes", summary, { agentExecution });
  }
  await dependencies.emit("agent.succeeded", {
    changedFilesCount: agent.changedFiles.length,
    cliVersion: agent.cliVersion,
  });

  await dependencies.emit("quality.test.started");
  let test: QualityPhaseResult;
  try {
    test = await dependencies.runTest({ environment: {} });
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Test phase failed";
    await dependencies.emit("quality.test.failed", { summary }, "error");
    return failure("test_failed", summary, { agentExecution });
  }
  if (test.status !== "passed") {
    const summary = `Test command failed: ${test.command}`;
    await dependencies.emit("quality.test.failed", {
      command: test.command,
      durationMs: test.durationMs,
    }, "error");
    return failure("test_failed", summary, {
      agentExecution,
      quality: { test },
    });
  }
  await dependencies.emit("quality.test.passed", {
    command: test.command,
    durationMs: test.durationMs,
  });

  await dependencies.emit("quality.build.started");
  let build: QualityPhaseResult;
  try {
    build = await dependencies.runBuild({ environment: {} });
  } catch (error) {
    const summary = error instanceof Error ? error.message : "Build phase failed";
    await dependencies.emit("quality.build.failed", { summary }, "error");
    return failure("build_failed", summary, {
      agentExecution,
      quality: {
        test,
        build: {
          status: "failed",
          command: "build",
          durationMs: 0,
        },
      },
    });
  }
  const quality: QualityResult = { test, build };
  if (build.status !== "passed") {
    const summary = `Build command failed: ${build.command}`;
    await dependencies.emit("quality.build.failed", {
      command: build.command,
      durationMs: build.durationMs,
    }, "error");
    return failure("build_failed", summary, {
      agentExecution,
      quality,
    });
  }
  await dependencies.emit("quality.build.passed", {
    command: build.command,
    durationMs: build.durationMs,
  });

  return {
    status: "succeeded",
    baseCommit: clone.baseCommit,
    agentExecution,
    quality,
  };
}
