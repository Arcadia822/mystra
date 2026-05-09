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

  it("injects agent-skills as a required whole-lifecycle instruction", () => {
    expect(runner).toContain("/mystra/skills/agent-skills/SKILL.md");
    expect(runner).toContain("available directly under /mystra/skills");
    expect(runner).toContain("entire research and development workflow");
    expect(runner).toContain("MYSTRA_SKILLS_DIR=/mystra/skills");
  });

  it("tells task agents not to fetch Linear context from inside containers", () => {
    expect(runner).toContain("Mystra issue context boundary:");
    expect(runner).toContain("Linear issue IDs, titles, and requirements are already supplied");
    expect(runner).toContain("Do not start, authenticate to, or query Linear, Linear MCP, mcp-remote");
    expect(runner).toContain("note the missing context in your final summary instead of accessing Linear");
  });

  it("does not mount host copilot config into task containers", () => {
    expect(runner).toContain('dockerArgs.push("-e", "COPILOT_GITHUB_TOKEN");');
    expect(runner).not.toContain("config.copilotConfigDir");
    expect(runner).not.toContain(":/root/.copilot");
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
