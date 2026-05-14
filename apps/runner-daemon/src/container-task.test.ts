import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(resolve(currentDir, "../assets/container-task.sh"), "utf8");
const runner = readFileSync(resolve(currentDir, "index.ts"), "utf8");
const workflowProviders = readFileSync(resolve(currentDir, "workflow-providers.ts"), "utf8");

describe("container task quality gate", () => {
  it("runs the deterministic test-build gate before push and MR creation", () => {
    const gateIndex = script.indexOf("run_quality_gates 0");
    const pushIndex = script.indexOf('git push -u origin "$MYSTRA_BRANCH_NAME"');
    const mrIndex = script.indexOf("GitLab MR create failed");

    expect(gateIndex).toBeGreaterThan(0);
    expect(pushIndex).toBeGreaterThan(gateIndex);
    expect(mrIndex).toBeGreaterThan(gateIndex);
  });

  it("removes the bounded quality-gate fix loop from the shell lifecycle", () => {
    expect(script).toContain('errorCode === "quality_gate_failed"');
    expect(script).toContain('sequence: ["test", "build"]');
    expect(script).toContain('logPath: "/mystra/workspace/quality-gate.log"');
    expect(script).not.toContain('QUALITY_FIX_ATTEMPTS="${MYSTRA_QUALITY_FIX_ATTEMPTS:-2}"');
    expect(script).not.toContain("write_quality_fix_prompt()");
    expect(script).not.toContain('run_agent "$QUALITY_FIX_PROMPT"');
    expect(script).not.toContain("while true; do");
    expect(runner).not.toContain("MYSTRA_QUALITY_FIX_ATTEMPTS");
  });

  it("exposes workflow step commands for the local provider", () => {
    expect(script).toContain('case "${1:-}" in');
    expect(script).toContain('clone)');
    expect(script).toContain('agent)');
    expect(script).toContain('quality-gate)');
    expect(script).toContain('push)');
    expect(script).toContain('review-create)');
    expect(script).toContain('MYSTRA_STEP_OUTPUT_FILE');
    expect(script).toContain("Missing container workflow command. Use one of: clone, agent, quality-gate, push, review-create.");
    expect(script).toContain("Deprecated container workflow entrypoint: use explicit workflow step commands instead of 'main'.");
    expect(script).toContain("run_command quality-gate");
    expect(runner).toContain('workflowProviderName: process.env.MYSTRA_WORKFLOW_PROVIDER ?? "local"');
    expect(runner).toContain("workflowBlueprintName: process.env.MYSTRA_WORKFLOW_BLUEPRINT");
    expect(runner).toContain('workflowProviderModules: csvEnv("MYSTRA_WORKFLOW_PROVIDER_MODULES")');
    expect(runner).toContain('workflowBlueprintFiles: csvEnv("MYSTRA_WORKFLOW_BLUEPRINT_FILES")');
    expect(runner).toContain("moduleSpecifiers: config.workflowProviderModules");
    expect(runner).toContain("blueprintFiles: config.workflowBlueprintFiles");
    expect(runner).toContain('const workflowRegistry = config.executor === "docker"');
    expect(runner).toContain("executeJob(config, registration.runnerToken, claim, workflowRegistry)");
    expect(runner).not.toContain("const workflowRegistry = await createRunnerWorkflowProviderRegistry({");
    expect(workflowProviders).toContain("LocalWorkflowProvider");
    expect(workflowProviders).toContain("createWorkflowProviderRegistry");
    expect(workflowProviders).toContain("mvpCodingBlueprint");
    expect(workflowProviders).toContain("loadWorkflowBlueprints");
  });

  it("emits workflow node lifecycle events around local provider execution", () => {
    expect(runner).toContain('"workflow.start_requested"');
    expect(runner).toContain('"workflow.started"');
    expect(runner).toContain('"workflow.start_failed"');
    expect(runner).toContain("async function emitWorkflowNodeEvent(");
    expect(runner).toContain("`workflow.node.${phase}`");
    expect(runner).toContain('phase: "started" | "succeeded" | "failed"');
    expect(runner).toContain("nodeId: node.id");
    expect(runner).toContain("handler: node.handler");
    expect(runner).toContain("nodeKind: node.kind");
  });

  it("treats docs-only changes as a no-code quality gate pass", () => {
    expect(script).toContain("docs_only_change()");
    expect(script).toContain("Docs-only change detected");
    expect(script).toContain("git ls-files --others --exclude-standard");
  });

  it("runs changed backend tests directly when an agent edits backend test files", () => {
    expect(script).toContain("backend pytest changed tests");
    expect(script).toContain("tr '\\n' ' '");
    expect(script).toContain("uv run pytest --no-cov $changed_backend_tests");
    expect(script).toContain('run_backend_tests_if_present "$changed_files"');
  });

  it("does not treat untracked files as no changes", () => {
    expect(script).toContain('git status --porcelain');
    expect(script).not.toContain("git diff --quiet && git diff --cached --quiet");
  });

  it("only reports preview URLs for repositories with matching services", () => {
    expect(script).toContain('fs.existsSync("frontend/package.json")');
    expect(script).toContain('fs.existsSync("backend/pyproject.toml")');
    expect(script).toContain("portIsReachable(\"http://127.0.0.1:3000\")");
    expect(script).toContain("portIsReachable(\"http://127.0.0.1:8000\")");
    expect(script).toContain("frontendPreviewUrl: frontendPreviewUrl || null");
    expect(script).toContain("backendPreviewUrl: backendPreviewUrl || null");
  });

  it("renders prompt context from resolved runtime bundles", () => {
    expect(runner).toContain("function renderRuntimeContextPrompt(runtime: ResolvedRuntimeContract): string[]");
    expect(runner).toContain("Mystra context bundles:");
    expect(runner).toContain("bundle.source.metadata.prompt");
    expect(runner).toContain("...renderRuntimeContextPrompt(runtime)");
    expect(runner).toContain("MYSTRA_SKILLS_DIR=/mystra/skills");
  });

  it("does not hard-code issue context policy into task prompts", () => {
    expect(runner).not.toContain("Mystra issue context boundary:");
    expect(runner).not.toContain("Linear issue IDs, titles, and requirements are already supplied");
    expect(runner).not.toContain("Do not start, authenticate to, or query Linear, Linear MCP, mcp-remote");
  });

  it("does not mount host copilot config into task containers", () => {
    expect(runner).toContain('dockerArgs.push("-e", "COPILOT_GITHUB_TOKEN");');
    expect(runner).not.toContain("config.copilotConfigDir");
    expect(runner).not.toContain(":/root/.copilot");
  });

  it("uses the resolved runtime image instead of a Project image or global runner image", () => {
    expect(runner).toContain("runtime.environment.image");
    expect(runner).toContain("projectSlug: project.slug");
    expect(runner).toContain("dockerArgs.push(image, \"sleep\", \"infinity\")");
    expect(runner).not.toContain("project.image");
    expect(runner).not.toContain("runnerImage:");
    expect(runner).not.toContain("MYSTRA_RUNNER" + "_IMAGE");
    expect(runner).not.toContain("config.runnerImage");
  });

  it("translates resolved runtime ports, mounts, caches, and secrets into Docker args", () => {
    expect(runner).toContain("const runtimeMounts = effectiveDockerMounts(runtime.mounts)");
    expect(runner).toContain("const runtimePorts = runtime.exposedPorts.length > 0 ? runtime.exposedPorts : defaultDockerPorts()");
    expect(runner).toContain("const runtimeSecrets = runtime.secrets.length > 0 ? runtime.secrets : defaultDockerSecrets()");
    expect(runner).toContain("appendRuntimePorts(dockerArgs, runtimePorts)");
    expect(runner).toContain("appendRuntimeSecrets(dockerArgs, containerEnv, runtimeSecrets)");
    expect(runner).toContain("appendRuntimeMounts(dockerArgs, config, workspace, gitMirror, runtimeMounts)");
    expect(runner).toContain("dockerArgs.push(\"-p\", port.hostBinding ?? `0.0.0.0::${port.containerPort}`)");
    expect(runner).toContain("dockerArgs.push(\"-e\", secret.name)");
    expect(runner).toContain("dockerArgs.push(\"-v\", `${runtimeMountSource(config, workspace, gitMirror, mount)}:${mount.target}${suffix}`)");
  });

  it("merges system mounts with resolved Project/runtime mounts instead of replacing them", () => {
    expect(runner).toContain("function effectiveDockerMounts(runtimeMounts: ResolvedRuntimeContract[\"mounts\"]): ResolvedRuntimeContract[\"mounts\"]");
    expect(runner).toContain("const merged = [...defaultDockerMounts()]");
    expect(runner).toContain("merged.push(mount)");
    expect(runner).toContain("owner: \"system\", target: \"/mystra/workspace\"");
    expect(runner).toContain("owner: \"system\", target: \"/mystra/cache/git/repo.git\"");
  });

  it("registers Docker runtime capabilities with the control plane", () => {
    expect(runner).toContain('providers: config.executor === "docker" ? ["docker"] : []');
    expect(runner).toContain('contextBundleModes: config.executor === "docker" ? ["read-only", "job-scoped"] : []');
    expect(runner).toContain('mountKinds: config.executor === "docker" ? ["workspace", "gitMirror", "cache", "contextBundle", "secret"] : []');
    expect(runner).toContain("supportsDynamicHostPorts: config.executor === \"docker\"");
    expect(runner).toContain('secretInjectionModes: config.executor === "docker" ? ["env"] : []');
  });

  it("reads config-first durability settings from local runner env", () => {
    expect(runner).toContain('positiveIntEnv("MYSTRA_RUNNER_CONCURRENCY", 1)');
    expect(runner).toContain('positiveIntEnv("MYSTRA_RUNNER_POLL_INTERVAL_SECONDS", 5)');
    expect(runner).toContain('positiveIntEnv("MYSTRA_RUNNER_STALE_AFTER_SECONDS", 90)');
    expect(runner).toContain('positiveIntEnv("MYSTRA_RUNNER_DEFAULT_EXECUTION_TIMEOUT_SECONDS", 3600)');
    expect(runner).toContain('positiveIntEnv("MYSTRA_RUNNER_CANCEL_CHECK_INTERVAL_SECONDS", 10)');
    expect(runner).toContain('positiveIntEnv("MYSTRA_RUNNER_CLEANUP_TIMEOUT_SECONDS", 30)');
    expect(runner).toContain('csvEnv("MYSTRA_RUNNER_ELIGIBLE_PROJECT_IDS")');
    expect(runner).toContain('csvEnv("MYSTRA_RUNNER_ELIGIBLE_RUNTIME_PROVIDERS")');
  });

  it("registers config-derived concurrency and eligibility with the control plane", () => {
    expect(runner).toContain("maxConcurrency: config.concurrency");
    expect(runner).toContain("staleAfterSeconds: config.staleAfterSeconds");
    expect(runner).toContain("eligibleProjectIds: config.eligibleProjectIds");
    expect(runner).toContain("eligibleRuntimeProviders: config.eligibleRuntimeProviders");
  });

  it("uses the configured poll interval instead of a tight empty-queue loop", () => {
    expect(runner).toContain("function sleep(ms: number, signal?: AbortSignal): Promise<void>");
    expect(runner).toContain("await sleep(config.pollIntervalSeconds * 1000)");
  });

  it("supervises bounded active jobs from local concurrency", () => {
    expect(runner).toContain("const activeJobs = new Set<Promise<void>>()");
    expect(runner).toContain("activeJobs.size < config.concurrency");
    expect(runner).toContain("activeJobs.add(activeJob)");
    expect(runner).toContain("activeJobs.delete(activeJob)");
    expect(runner).toContain("await Promise.race([...activeJobs, sleep(config.pollIntervalSeconds * 1000)])");
  });

  it("polls active runs for cancellation requests and stops local execution", () => {
    expect(runner).toContain("async function pollCancellationRequest(");
    expect(runner).toContain("apiUrl(config, `/api/runner/jobs/${runId}`)");
    expect(runner).toContain("snapshot.run?.cancellationRequest");
    expect(runner).toContain("cancellationRequested = true");
    expect(runner).toContain("executionAbort.abort()");
    expect(runner).toContain("signal: executionAbort.signal");
  });

  it("uses a local execution timeout watchdog and cleanup timeout", () => {
    expect(runner).toContain("config.defaultExecutionTimeoutSeconds * 1000");
    expect(runner).toContain("executionTimedOut = true");
    expect(runner).toContain("type,");
    expect(runner).toContain("\"cleanup.started\"");
    expect(runner).toContain("\"stop\"");
    expect(runner).toContain("\"--time\"");
    expect(runner).toContain("String(config.cleanupTimeoutSeconds)");
    expect(runner).toContain("status: executionTimedOut ? \"timed_out\" : \"canceled\"");
  });

  it("reports cleanup failure instead of reading a missing stopped-container result", () => {
    expect(runner).toContain("\"run.cleanup_failed\"");
    expect(runner).toContain("errorCode: \"cleanup_failed\"");
    expect(runner).toContain("const result = terminalOverride ?? workflowDockerResult ?? {");
    expect(runner).toContain("Workflow execution did not produce a terminal result");
    expect(runner).not.toContain("JSON.parse(await readFile(resultPath, \"utf8\"))");
  });

  it("runs copilot with an isolated workspace config home", () => {
    expect(script).toContain('COPILOT_SANDBOX_HOME="${WORKSPACE}/copilot-home"');
    expect(script).toContain('COPILOT_SANDBOX_CLI_CONFIG_DIR="${COPILOT_SANDBOX_HOME}/.copilot"');
    expect(script).toContain('mkdir -p "$COPILOT_SANDBOX_CLI_CONFIG_DIR" "$COPILOT_SANDBOX_CONFIG_DIR" "$COPILOT_SANDBOX_CACHE_DIR"');
    expect(script).toContain('HOME="$COPILOT_SANDBOX_HOME"');
    expect(script).toContain('XDG_CONFIG_HOME="$COPILOT_SANDBOX_CONFIG_DIR"');
    expect(script).toContain('XDG_CACHE_HOME="$COPILOT_SANDBOX_CACHE_DIR"');
    expect(script).toContain('--config-dir "$COPILOT_SANDBOX_CLI_CONFIG_DIR"');
    expect(script).toContain("--disable-mcp-server linear");
    expect(script).toContain("--deny-url mcp.linear.app");
  });
});
