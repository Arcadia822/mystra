import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { BranchDeliveryRequest, BranchDeliveryReceipt, ReviewRequest, ReviewResult } from "@mystra/shared";

import type { RepoDeliveryProvider } from "../repo-providers.js";

interface GitHubPushMetadata {
  localRepoPath?: string;
  githubHttpBaseUrl?: string | null;
}

interface GitHubReviewMetadata {
  frontendPreviewUrl?: string | null;
  backendPreviewUrl?: string | null;
  previewContainer?: string | null;
  githubHttpBaseUrl?: string | null;
  qualityGate?: {
    status?: unknown;
    sequence?: unknown;
    logPath?: unknown;
  };
}

interface GitHubRepoContext {
  apiBaseUrl: string;
  branchUrlBase: string;
  remoteUrl: string;
  repoPath: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeRepoPath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/, "").replace(/\/+$/, "");
}

function parseGitHubTarget(targetRepoUrl: string): { host: string; repoPath: string } {
  const sshMatch = /^git@([^:]+):(.+)$/.exec(targetRepoUrl);
  if (sshMatch?.[1] && sshMatch[2]) {
    return {
      host: sshMatch[1],
      repoPath: normalizeRepoPath(sshMatch[2]),
    };
  }

  const input = new URL(targetRepoUrl.includes("://") ? targetRepoUrl : `https://${targetRepoUrl}`);
  if (!input.hostname) {
    throw new Error(`Invalid GitHub repository URL: ${targetRepoUrl}`);
  }

  const repoPath = normalizeRepoPath(input.pathname);
  if (!repoPath) {
    throw new Error(`Invalid GitHub repository URL: ${targetRepoUrl}`);
  }

  return {
    host: input.hostname,
    repoPath,
  };
}

function gitHubRepoContext(targetRepoUrl: string, githubHttpBaseUrl?: string | null): GitHubRepoContext {
  const { host, repoPath } = parseGitHubTarget(targetRepoUrl);
  const apiBaseUrl = trimTrailingSlash(githubHttpBaseUrl || (host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`));
  return {
    apiBaseUrl,
    branchUrlBase: `https://${host}/${repoPath}`,
    remoteUrl: `https://${host}/${repoPath}.git`,
    repoPath,
  };
}

function runCommand(command: string, args: string[], options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}`));
    });
  });
}

async function withGitHubCredentials<T>(
  token: string,
  action: (env: NodeJS.ProcessEnv) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "mystra-github-"));
  const askpassPath = path.join(directory, "askpass.sh");
  await writeFile(
    askpassPath,
    [
      "#!/usr/bin/env bash",
      "case \"$1\" in",
      "  *Username*) printf '%s\\n' \"x-access-token\" ;;",
      "  *Password*) printf '%s\\n' \"$MYSTRA_GITHUB_ASKPASS_TOKEN\" ;;",
      "  *) exit 1 ;;",
      "esac",
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  try {
    return await action({
      ...process.env,
      GIT_ASKPASS: askpassPath,
      GIT_TERMINAL_PROMPT: "0",
      MYSTRA_GITHUB_ASKPASS_TOKEN: token,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runCommandCapture(command: string, args: string[], options: {
  cwd?: string;
} = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errorChunks.push(chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8").trim());
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}: ${Buffer.concat(errorChunks).toString("utf8")}`));
    });
  });
}

function pushMetadata(input: BranchDeliveryRequest): GitHubPushMetadata {
  const metadata = input.metadata as Record<string, unknown>;
  return {
    ...(typeof metadata.localRepoPath === "string" ? { localRepoPath: metadata.localRepoPath } : {}),
    ...(typeof metadata.githubHttpBaseUrl === "string" ? { githubHttpBaseUrl: metadata.githubHttpBaseUrl } : {}),
  };
}

function reviewMetadata(input: ReviewRequest): GitHubReviewMetadata {
  const metadata = input.metadata as Record<string, unknown>;
  const qualityGate = typeof metadata.qualityGate === "object" && metadata.qualityGate
    ? metadata.qualityGate as GitHubReviewMetadata["qualityGate"]
    : null;
  return {
    frontendPreviewUrl: typeof metadata.frontendPreviewUrl === "string" ? metadata.frontendPreviewUrl : null,
    backendPreviewUrl: typeof metadata.backendPreviewUrl === "string" ? metadata.backendPreviewUrl : null,
    previewContainer: typeof metadata.previewContainer === "string" ? metadata.previewContainer : null,
    githubHttpBaseUrl: typeof metadata.githubHttpBaseUrl === "string" ? metadata.githubHttpBaseUrl : null,
    ...(qualityGate ? { qualityGate } : {}),
  };
}

function qualityGateNote(metadata: GitHubReviewMetadata): string {
  return metadata.qualityGate?.status === "passed"
    ? "\n- Quality gate: passed (`test -> build`)"
    : "";
}

function buildPreviewDescription(metadata: GitHubReviewMetadata): string {
  if (!metadata.frontendPreviewUrl) {
    return "";
  }

  const backendNote = metadata.backendPreviewUrl
    ? "\n- Backend note: the backend port is reserved in the retained container. It may still require repository-specific DB/Redis environment before the backend process stays up."
    : "";
  return `\n\n---\n\nMystra preview:\n\n- Frontend: ${metadata.frontendPreviewUrl}\n- Backend: ${metadata.backendPreviewUrl || "not exposed"}\n- Container: ${metadata.previewContainer || "unknown"}${qualityGateNote(metadata)}${backendNote}\n`;
}

function buildPreviewCommentBody(metadata: GitHubReviewMetadata): string | null {
  if (!metadata.frontendPreviewUrl) {
    return null;
  }

  return `Mystra retained preview status:\n\n- Frontend: ${metadata.frontendPreviewUrl}\n- Backend: ${metadata.backendPreviewUrl || "not exposed"}\n- Container: ${metadata.previewContainer || "unknown"}${qualityGateNote(metadata)}\n\nThe task container is intentionally kept running for review. Backend may still require repository-specific DB/Redis environment before the process stays up.`;
}

function branchFailure(
  input: BranchDeliveryRequest,
  errorCode: string,
  errorMessage: string,
): BranchDeliveryReceipt {
  return {
    status: "failed",
    branchName: input.branchName,
    errorCode,
    errorMessage,
  };
}

function reviewFailure(
  input: ReviewRequest,
  errorCode: string,
  errorMessage: string,
  status: ReviewResult["status"] = "review_failed_after_push",
): ReviewResult {
  return {
    status,
    branch: input.branch,
    errorCode,
    errorMessage,
    metadata: { ...input.metadata },
  };
}

function safeGitHubErrorBody(body: string, token: string): string {
  return body.replaceAll(token, "[REDACTED]").slice(0, 1_000);
}

export const githubRepoProvider: RepoDeliveryProvider = {
  providerName: "github",
  supports(repository) {
    return repository.provider === "github";
  },
  async pushBranch(input) {
    if (input.auth.provider !== "github" || input.auth.kind !== "runner-env") {
      return branchFailure(
        input,
        "auth_invalid",
        "GitHub branch delivery requires runner-env GitHub auth",
      );
    }

    const token = process.env[input.auth.reference];
    if (!token) {
      return branchFailure(
        input,
        "auth_invalid",
        `Missing GitHub auth token in ${input.auth.reference}`,
      );
    }

    const metadata = pushMetadata(input);
    if (!metadata.localRepoPath) {
      return branchFailure(
        input,
        "push_failed",
        "GitHub branch delivery requires localRepoPath metadata",
      );
    }

    let repoContext: GitHubRepoContext;
    try {
      repoContext = gitHubRepoContext(
        input.target.repository.cloneUrl,
        metadata.githubHttpBaseUrl,
      );
    } catch (error) {
      return branchFailure(
        input,
        "push_failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    try {
      await runCommand("git", ["remote", "set-url", "origin", repoContext.remoteUrl], {
        cwd: metadata.localRepoPath,
      });
      await withGitHubCredentials(token, async (env) => {
        await runCommand("git", ["push", "-u", "origin", input.branchName], {
          ...(metadata.localRepoPath ? { cwd: metadata.localRepoPath } : {}),
          env,
        });
      });
      const commitSha = await runCommandCapture("git", ["rev-parse", "HEAD"], {
        cwd: metadata.localRepoPath,
      });
      return {
        status: "pushed",
        branchName: input.branchName,
        branchUrl: `${repoContext.branchUrlBase}/tree/${encodeURIComponent(input.branchName)}`,
        ...(commitSha ? { commitSha } : {}),
      };
    } catch (error) {
      return branchFailure(
        input,
        "push_failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
  async createReview(input) {
    if (input.auth.provider !== "github" || input.auth.kind !== "runner-env") {
      return reviewFailure(
        input,
        "auth_invalid",
        "GitHub review creation requires runner-env GitHub auth",
        "auth_invalid",
      );
    }

    const token = process.env[input.auth.reference];
    if (!token) {
      return reviewFailure(
        input,
        "auth_invalid",
        `Missing GitHub auth token in ${input.auth.reference}`,
        "auth_invalid",
      );
    }

    const metadata = reviewMetadata(input);

    let repoContext: GitHubRepoContext;
    try {
      repoContext = gitHubRepoContext(
        input.target.repository.cloneUrl,
        metadata.githubHttpBaseUrl,
      );
    } catch (error) {
      return reviewFailure(
        input,
        "review_create_failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    const response = await fetch(`${repoContext.apiBaseUrl}/repos/${repoContext.repoPath}/pulls`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        head: input.branch.branchName,
        base: input.target.defaultBaseBranch,
        body: `${input.body}${buildPreviewDescription(metadata)}`,
      }),
    });

    const text = await response.text();
    let pullRequest: { number: number; html_url: string };
    let reused = false;
    if (response.ok) {
      pullRequest = JSON.parse(text) as { number: number; html_url: string };
    } else if (response.status === 422) {
      const owner = repoContext.repoPath.split("/")[0];
      const query = new URLSearchParams({
        state: "open",
        head: `${owner}:${input.branch.branchName}`,
        base: input.target.defaultBaseBranch,
      });
      const existingResponse = await fetch(
        `${repoContext.apiBaseUrl}/repos/${repoContext.repoPath}/pulls?${query}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/vnd.github+json",
          },
        },
      );
      const existing = existingResponse.ok
        ? await existingResponse.json() as Array<{ number: number; html_url: string }>
        : [];
      const match = existing[0];
      if (!match) {
        return reviewFailure(
          input,
          "review_create_failed",
          `GitHub pull request create failed ${response.status}: ${safeGitHubErrorBody(text, token)}`,
        );
      }
      pullRequest = match;
      reused = true;
    } else {
      return reviewFailure(
        input,
        "review_create_failed",
        `GitHub pull request create failed ${response.status}: ${safeGitHubErrorBody(text, token)}`,
      );
    }
    let contextCommentStatus: "published" | "failed" | undefined;
    const commentBody = buildPreviewCommentBody(metadata);

    if (commentBody) {
      try {
        const commentResponse = await fetch(
          `${repoContext.apiBaseUrl}/repos/${repoContext.repoPath}/issues/${pullRequest.number}/comments`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              accept: "application/vnd.github+json",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              body: commentBody,
            }),
          },
        );

        if (commentResponse.ok) {
          contextCommentStatus = "published";
        } else {
          contextCommentStatus = "failed";
          console.warn(
            `[mystra-runner] GitHub preview comment failed ${commentResponse.status}: ${safeGitHubErrorBody(await commentResponse.text(), token)}`,
          );
        }
      } catch (error) {
        contextCommentStatus = "failed";
        console.warn(
          "[mystra-runner] GitHub preview comment request failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return {
      status: "review_created",
      branch: input.branch,
      review: {
        provider: "github",
        url: pullRequest.html_url,
        number: pullRequest.number,
        displayId: `#${pullRequest.number}`,
      },
      metadata: {
        ...input.metadata,
        repo: repoContext.repoPath,
        targetBranch: input.target.defaultBaseBranch,
        ...(reused ? { reused: true } : {}),
        ...(contextCommentStatus ? { contextCommentStatus } : {}),
      },
    };
  },
};

export const repoProviders = {
  github: githubRepoProvider,
} as const;
