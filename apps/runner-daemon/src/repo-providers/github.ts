import { spawn } from "node:child_process";

import type { BranchDeliveryRequest, BranchDeliveryReceipt, ReviewRequest, ReviewResult } from "@mystra/shared";

import type { RepoProvider } from "../repo-providers.js";

interface GitHubPushMetadata {
  localRepoPath?: string;
  githubHttpBaseUrl?: string | null;
}

interface GitHubRepoContext {
  apiBaseUrl: string;
  authenticatedRepoUrl: string;
  branchUrlBase: string;
  repoPath: string;
}

function isGitHubRepoUrl(repoUrl: string): boolean {
  return repoUrl.includes("github.com");
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

function gitHubRepoContext(targetRepoUrl: string, token: string, githubHttpBaseUrl?: string | null): GitHubRepoContext {
  const { host, repoPath } = parseGitHubTarget(targetRepoUrl);
  const apiBaseUrl = trimTrailingSlash(githubHttpBaseUrl || (host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`));
  return {
    apiBaseUrl,
    authenticatedRepoUrl: `https://x-access-token:${encodeURIComponent(token)}@${host}/${repoPath}.git`,
    branchUrlBase: `https://${host}/${repoPath}`,
    repoPath,
  };
}

function runCommand(command: string, args: string[], options: {
  cwd?: string;
} = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
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

export const githubRepoProvider: RepoProvider = {
  providerName: "github",
  supports(target) {
    return target.hostKind === "github" || isGitHubRepoUrl(target.repoUrl);
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
      repoContext = gitHubRepoContext(input.target.repoUrl, token, metadata.githubHttpBaseUrl);
    } catch (error) {
      return branchFailure(
        input,
        "push_failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    try {
      await runCommand("git", ["remote", "set-url", "origin", repoContext.authenticatedRepoUrl], {
        cwd: metadata.localRepoPath,
      });
      await runCommand("git", ["push", "-u", "origin", input.branchName], {
        cwd: metadata.localRepoPath,
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

    const metadata = input.metadata as Record<string, unknown>;

    let repoContext: GitHubRepoContext;
    try {
      repoContext = gitHubRepoContext(
        input.target.repoUrl,
        token,
        typeof metadata.githubHttpBaseUrl === "string" ? metadata.githubHttpBaseUrl : null,
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
        body: input.body,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return reviewFailure(
        input,
        "review_create_failed",
        `GitHub pull request create failed ${response.status}: ${text}`,
      );
    }

    const pullRequest = JSON.parse(text) as { number: number; html_url: string };
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
      },
    };
  },
};

export const repoProviders = {
  github: githubRepoProvider,
} as const;
