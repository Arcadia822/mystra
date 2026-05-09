import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(resolve(currentDir, "../assets/container-task.sh"), "utf8");
const runner = readFileSync(resolve(currentDir, "index.ts"), "utf8");

describe("container task quality gate", () => {
  it("runs the deterministic test-build gate before push and MR creation", () => {
    const gateIndex = script.indexOf("while true; do");
    const pushIndex = script.indexOf('git push -u origin "$MYSTRA_BRANCH_NAME"');
    const mrIndex = script.indexOf("GitLab MR create failed");

    expect(gateIndex).toBeGreaterThan(0);
    expect(pushIndex).toBeGreaterThan(gateIndex);
    expect(mrIndex).toBeGreaterThan(gateIndex);
  });

  it("runs a bounded quality-gate fix loop before final failure", () => {
    expect(script).toContain('errorCode === "quality_gate_failed"');
    expect(script).toContain('sequence: ["test", "build"]');
    expect(script).toContain('logPath: "/mystra/workspace/quality-gate.log"');
    expect(script).toContain("fixAttempts: Number(process.env.MYSTRA_QUALITY_FIX_ATTEMPTS_USED || 0)");
    expect(script).toContain('QUALITY_FIX_ATTEMPTS="${MYSTRA_QUALITY_FIX_ATTEMPTS:-2}"');
    expect(script).toContain("write_quality_fix_prompt()");
    expect(script).toContain('run_agent "$QUALITY_FIX_PROMPT"');
    expect(script).toContain("while true; do");
    expect(script).toContain("|| return $?");
    expect(script).toContain("Mystra will only create it after the quality gate passes");
    expect(runner).toContain("MYSTRA_QUALITY_FIX_ATTEMPTS");
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
