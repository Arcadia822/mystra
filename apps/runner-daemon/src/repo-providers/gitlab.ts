import { spawn } from "node:child_process";

import type { BranchDeliveryRequest, BranchDeliveryReceipt, ReviewRequest, ReviewResult } from "@mystra/shared";

import type { RepoDeliveryProvider } from "../repo-providers.js";
import {
  buildMergeRequestEventData,
  buildReviewCreatedEventData,
  type ReviewProjectionInput,
} from "../review-projections.js";

export type GitLabReviewProjectionInput = ReviewProjectionInput;

interface GitLabReviewMetadata {
  frontendPreviewUrl?: string | null;
  backendPreviewUrl?: string | null;
  previewContainer?: string | null;
  gitlabHttpBaseUrl?: string | null;
  qualityGate?: {
    status?: unknown;
    sequence?: unknown;
    logPath?: unknown;
  };
}

function gitLabApiContext(targetRepoUrl: string, gitlabHttpBaseUrl?: string | null): {
  projectPath: string;
  repoUrl: URL;
  mergeRequestsEndpoint: string;
} {
  const input = new URL(targetRepoUrl.includes("://") ? targetRepoUrl : `https://${targetRepoUrl}`);
  const repoUrl = input.protocol === "ssh:"
    ? new URL(input.pathname, new URL(gitlabHttpBaseUrl ?? ""))
    : input;
  const projectPath = repoUrl.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
  return {
    projectPath,
    repoUrl,
    mergeRequestsEndpoint: `${repoUrl.protocol}//${repoUrl.host}/api/v4/projects/${encodeURIComponent(projectPath)}/merge_requests`,
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

function gitLabPushMetadata(input: BranchDeliveryRequest): {
  localRepoPath?: string;
  gitlabHttpBaseUrl?: string | null;
} {
  const metadata = input.metadata as Record<string, unknown>;
  return {
    ...(typeof metadata.localRepoPath === "string" ? { localRepoPath: metadata.localRepoPath } : {}),
    ...(typeof metadata.gitlabHttpBaseUrl === "string" ? { gitlabHttpBaseUrl: metadata.gitlabHttpBaseUrl } : {}),
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

function gitLabAuthenticatedRepoUrl(targetRepoUrl: string, token: string, gitlabHttpBaseUrl?: string | null): {
  projectPath: string;
  branchUrlBase: string;
  authenticatedRepoUrl: string;
} {
  const { projectPath, repoUrl } = gitLabApiContext(targetRepoUrl, gitlabHttpBaseUrl);
  repoUrl.username = "oauth2";
  repoUrl.password = token;
  return {
    projectPath,
    branchUrlBase: `${repoUrl.protocol}//${repoUrl.host}/${projectPath}`,
    authenticatedRepoUrl: repoUrl.toString(),
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

function reviewMetadata(input: ReviewRequest): GitLabReviewMetadata {
  const metadata = input.metadata as Record<string, unknown>;
  const qualityGate = typeof metadata.qualityGate === "object" && metadata.qualityGate
    ? metadata.qualityGate as GitLabReviewMetadata["qualityGate"]
    : null;
  return {
    frontendPreviewUrl: typeof metadata.frontendPreviewUrl === "string" ? metadata.frontendPreviewUrl : null,
    backendPreviewUrl: typeof metadata.backendPreviewUrl === "string" ? metadata.backendPreviewUrl : null,
    previewContainer: typeof metadata.previewContainer === "string" ? metadata.previewContainer : null,
    gitlabHttpBaseUrl: typeof metadata.gitlabHttpBaseUrl === "string" ? metadata.gitlabHttpBaseUrl : null,
    ...(qualityGate ? { qualityGate } : {}),
  };
}

function qualityGateNote(metadata: GitLabReviewMetadata): string {
  return metadata.qualityGate?.status === "passed"
    ? "\n- Quality gate: passed (`test -> build`)"
    : "";
}

function buildPreviewDescription(metadata: GitLabReviewMetadata): string {
  if (!metadata.frontendPreviewUrl) {
    return "";
  }

  const backendNote = metadata.backendPreviewUrl
    ? "\n- Backend note: the backend port is reserved in the retained container. It may still require repository-specific DB/Redis environment before the backend process stays up."
    : "";
  return `\n\n---\n\nMystra preview:\n\n- Frontend: ${metadata.frontendPreviewUrl}\n- Backend: ${metadata.backendPreviewUrl || "not exposed"}\n- Container: ${metadata.previewContainer || "unknown"}\n- Preview login: \`preview@mystra.local\` / \`mystra-preview\`${qualityGateNote(metadata)}${backendNote}\n`;
}

export const gitlabRepoProvider: RepoDeliveryProvider = {
  providerName: "gitlab",
  supports(repository) {
    return repository.provider === "gitlab";
  },
  async pushBranch(input) {
    if (input.auth.provider !== "gitlab" || input.auth.kind !== "runner-env") {
      return branchFailure(
        input,
        "auth_invalid",
        "GitLab branch delivery requires runner-env GitLab auth",
      );
    }

    const token = process.env[input.auth.reference];
    if (!token) {
      return branchFailure(
        input,
        "auth_invalid",
        `Missing GitLab auth token in ${input.auth.reference}`,
      );
    }

    const metadata = gitLabPushMetadata(input);
    if (!metadata.localRepoPath) {
      return branchFailure(
        input,
        "push_failed",
        "GitLab branch delivery requires localRepoPath metadata",
      );
    }

    let repoContext: ReturnType<typeof gitLabAuthenticatedRepoUrl>;
    try {
      repoContext = gitLabAuthenticatedRepoUrl(
        input.target.repository.cloneUrl,
        token,
        metadata.gitlabHttpBaseUrl,
      );
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
        branchUrl: `${repoContext.branchUrlBase}/-/tree/${encodeURIComponent(input.branchName)}`,
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
    if (input.auth.provider !== "gitlab" || input.auth.kind !== "runner-env") {
      return reviewFailure(
        input,
        "auth_invalid",
        "GitLab review creation requires runner-env GitLab auth",
        "auth_invalid",
      );
    }

    const token = process.env[input.auth.reference];
    if (!token) {
      return reviewFailure(
        input,
        "auth_invalid",
        `Missing GitLab auth token in ${input.auth.reference}`,
        "auth_invalid",
      );
    }

    const metadata = reviewMetadata(input);
    let apiContext: ReturnType<typeof gitLabApiContext>;
    try {
      apiContext = gitLabApiContext(
        input.target.repository.cloneUrl,
        metadata.gitlabHttpBaseUrl,
      );
    } catch (error) {
      return reviewFailure(
        input,
        "review_create_failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    const description = `${input.body}${buildPreviewDescription(metadata)}`;
    const body = new URLSearchParams({
      source_branch: input.branch.branchName,
      target_branch: input.target.defaultBaseBranch,
      title: input.title,
      description,
      remove_source_branch: "false",
    });

    const response = await fetch(apiContext.mergeRequestsEndpoint, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": token,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const text = await response.text();
    if (!response.ok) {
      return reviewFailure(
        input,
        "review_create_failed",
        `GitLab MR create failed ${response.status}: ${text}`,
      );
    }

    const mergeRequest = JSON.parse(text) as { iid: number; web_url: string };

    if (metadata.frontendPreviewUrl) {
      const noteBody = new URLSearchParams({
        body: `Mystra preview status:\n\n- Frontend: ${metadata.frontendPreviewUrl}\n- Backend port: ${metadata.backendPreviewUrl || "not exposed"}\n- Login: preview@mystra.local / mystra-preview${metadata.qualityGate?.status === "passed" ? "\n- Quality gate: passed (test -> build)" : ""}\n\nThe task container is intentionally kept running for review. Backend may still require repository-specific DB/Redis environment before the process stays up.`,
      });
      try {
        const noteResponse = await fetch(`${apiContext.mergeRequestsEndpoint}/${mergeRequest.iid}/notes`, {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": token,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: noteBody,
        });
        if (!noteResponse.ok) {
          console.warn(
            `[mystra-runner] GitLab preview note failed ${noteResponse.status}: ${await noteResponse.text()}`,
          );
        }
      } catch (error) {
        console.warn(
          "[mystra-runner] GitLab preview note request failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return {
      status: "review_created",
      branch: input.branch,
      review: {
        provider: "gitlab",
        url: mergeRequest.web_url,
        number: mergeRequest.iid,
        displayId: `!${mergeRequest.iid}`,
      },
      metadata: {
        ...input.metadata,
        repo: apiContext.projectPath,
        targetBranch: input.target.defaultBaseBranch,
        frontendPreviewUrl: metadata.frontendPreviewUrl ?? null,
        backendPreviewUrl: metadata.backendPreviewUrl ?? null,
      },
    };
  },
};

export const repoProviders = {
  gitlab: gitlabRepoProvider,
} as const;

export function buildGitLabReviewCreatedEventData(input: GitLabReviewProjectionInput): {
  provider: string;
  reviewUrl: string | undefined;
  reviewNumber: number | undefined;
  displayId: string | undefined;
} {
  return buildReviewCreatedEventData(input);
}

export function buildGitLabMergeRequestEventData(input: GitLabReviewProjectionInput): {
  mrUrl: string | undefined;
  mrIid: number | undefined;
} {
  return buildMergeRequestEventData(input);
}
