import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(resolve(currentDir, "../assets/container-task.sh"), "utf8");
const runner = readFileSync(resolve(currentDir, "index.ts"), "utf8");
const agentAdapters = readFileSync(resolve(currentDir, "agent-adapters.ts"), "utf8");
const directExecution = readFileSync(resolve(currentDir, "direct-execution.ts"), "utf8");

describe("container task direct execution", () => {
  it("exposes only explicit repository task phases", () => {
    expect(script).toContain('case "${1:-}" in');
    for (const phase of ["clone", "agent", "test", "build", "preview", "commit"]) {
      expect(script).toContain(`${phase})`);
    }
    expect(script).toContain("MYSTRA_PHASE_OUTPUT_FILE");
    expect(script).not.toMatch(/workflow|blueprint|quality-gate|review-create|compat_main/i);
  });

  it("writes independent structured test and build outputs", () => {
    expect(script).toContain('TEST_LOG="${WORKSPACE}/test.log"');
    expect(script).toContain('BUILD_LOG="${WORKSPACE}/build.log"');
    expect(script).toContain("write_quality_phase_output");
    expect(script).toContain("test_step()");
    expect(script).toContain("build_step()");
    expect(script).toContain("durationMs: Number(durationMs)");
    expect(script).not.toContain('sequence: ["test", "build"]');
  });

  it("counts untracked files and permits docs-only quality phases", () => {
    expect(script).toContain("git ls-files --others --exclude-standard");
    expect(script).toContain("docs_only_change()");
    expect(script).toContain("Docs-only change detected");
    expect(script).not.toContain("git diff --quiet && git diff --cached --quiet");
  });

  it("starts a generic package preview without repository mutation", () => {
    expect(script).toContain("preview_step()");
    expect(script).toContain("package_has_script preview");
    expect(script).toContain("package_has_script start");
    expect(script).toContain("MYSTRA_PREVIEW_PORT");
    expect(script).not.toMatch(/castrel|frontend\/|backend\/|preview@mystra/i);
  });

  it("uses askpass so clone URLs never contain credentials", () => {
    expect(script).toContain("GIT_ASKPASS");
    expect(script).toContain('url.username = ""');
    expect(script).toContain('url.password = ""');
    expect(script).not.toContain("url.password = token");
    expect(script).not.toContain("url.username = username");
  });

  it("falls back to a cold clone when a local reference is unusable", () => {
    expect(script).toContain("--reference-if-able");
    expect(script).toContain("--dissociate");
    expect(script).toContain('rm -rf "$REPO_DIR"');
    expect(script.match(/with_repository_credentials git clone/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("captures Agent stdout, stderr, exit code, and changed files", () => {
    expect(script).toContain("MYSTRA_AGENT_PROCESS_RESULT_FILE");
    expect(script).toContain("changed_files_json");
    expect(script).toContain("processResult: JSON.parse");
    expect(script).toContain("changedFiles: JSON.parse");
  });

  it("supports oversized prompts through stdin files", () => {
    expect(runner).toContain("MAX_INLINE_AGENT_PROMPT_BYTES");
    expect(runner).toContain("promptFilePath");
    expect(runner).toContain("MYSTRA_AGENT_STDIN_FILE");
    expect(script).toContain("const stdinFile = process.env.MYSTRA_AGENT_STDIN_FILE");
    expect(script).toContain("readFileSync(stdinFile)");
  });

  it("uses the direct execution service and only agent/repository/sandbox registries", () => {
    expect(runner).toContain("executeDirectExecution");
    expect(runner).toContain("createRunnerAgentAdapterRegistry");
    expect(runner).toContain("createRunnerRepoProviderRegistry");
    expect(runner).toContain("createRunnerSandboxProviderRegistry");
    expect(runner).not.toMatch(/workflow|blueprint/i);
  });

  it("keeps the fixed direct sequence visible and evented", () => {
    expect(directExecution).toContain("launch sandbox");
    expect(directExecution).toContain("Copilot Agent");
    expect(directExecution).toContain('"execution.started"');
    expect(directExecution).toContain('"repository.clone.started"');
    expect(directExecution).toContain('"agent.started"');
    expect(directExecution).toContain('"quality.test.started"');
    expect(directExecution).toContain('"quality.build.started"');
    expect(directExecution).not.toMatch(/workflow|blueprint|node registry/i);
  });

  it("injects phase credentials by environment name rather than command-line value", () => {
    expect(runner).toContain('flatMap(([name]) => ["-e", name])');
    expect(runner).toContain("env: { ...process.env, ...environment }");
    expect(runner).toContain("repositorySecret:");
    expect(runner).toContain("agentSecret:");
    expect(runner).not.toContain('dockerArgs.push("-e", "COPILOT_GITHUB_TOKEN")');
  });

  it("executes bounded Copilot autopilot with a pinned CLI version", () => {
    expect(runner).toContain('COPILOT_CLI_VERSION = "1.0.69-0"');
    expect(runner).toContain("MAX_AUTOPILOT_CONTINUES = 10");
    expect(runner).toContain('session.agent !== "copilot"');
    expect(runner).toContain('agentName === "copilot"');
    expect(agentAdapters).toContain("new CopilotAdapter");
    expect(directExecution).toContain('mode: "autopilot"');
  });

  it("uses the resolved runtime image and dynamic port mapping", () => {
    expect(runner).toContain("runtime.environment.image");
    expect(runner).toContain("appendRuntimePorts(dockerArgs, ports)");
    expect(runner).toContain('port.hostBinding ?? `0.0.0.0::${port.containerPort}`');
    expect(runner).toContain('dockerArgs.push(image, "sleep", "infinity")');
  });

  it("requires two successful preview probes before handoff", () => {
    expect(runner).toContain("probePreview(previewUrl");
    expect(runner).toContain('"preview.ready"');
    expect(runner).toContain("probeCount");
  });

  it("pushes, creates a review, and reports waiting_for_review", () => {
    expect(runner).toContain("repoProvider.pushBranch");
    expect(runner).toContain("repoProvider.createReview");
    expect(runner).toContain('status: "waiting_for_review"');
    expect(runner).toContain("issue: task.issue.reference");
    expect(runner).toContain("reviewResult");
    expect(runner).toContain("agentExecution: direct.agentExecution");
  });

  it("retains successful and failed sandboxes but cleans cancellation and timeout", () => {
    expect(runner).toContain('retentionPolicy: "retain_for_preview"');
    expect(runner).toContain('retained: true');
    expect(runner).toContain('const reason = executionTimedOut ? "timeout" : "cancel"');
    expect(runner).toContain("sandboxProvider.stop(sandboxSession, reason");
  });

  it("registers config-derived capacity and eligibility", () => {
    expect(runner).toContain("maxConcurrency: config.concurrency");
    expect(runner).toContain("staleAfterSeconds: config.staleAfterSeconds");
    expect(runner).toContain("eligibleProjectIds: config.eligibleProjectIds");
    expect(runner).toContain("eligibleRuntimeProviders: config.eligibleRuntimeProviders");
  });

  it("supports bounded concurrency and configured polling", () => {
    expect(runner).toContain("const activeSessions = new Map<string, Promise<void>>()");
    expect(runner).toContain("activeSessions.size < config.concurrency");
    expect(runner).toContain("await Promise.race");
    expect(runner).toContain("config.pollIntervalSeconds * 1000");
  });
});
