import {
  workspaceBranchDecisionSchema,
  type TaskIssueProvider,
  type WorkspaceBranchDecision,
} from "@mystra/shared";

export function issueWorkspaceBranchDecision(input: {
  provider: TaskIssueProvider;
  identifier: string;
  title: string;
  taskId: string;
}): WorkspaceBranchDecision {
  const prefix = `mystra/${input.provider}-${slug(input.identifier)}`;
  const task = slug(input.taskId).slice(0, 8);
  const titleBudget = 244 - Buffer.byteLength(`${prefix}--${task}`, "utf8");
  const title = truncateAscii(slug(input.title), Math.max(0, titleBudget));
  const branchName = title
    ? `${prefix}-${title}-${task}`
    : `${prefix}-${task}`;
  return workspaceBranchDecisionSchema.parse({
    branchName,
    strategy: `${input.provider}-issue-identifier-title-task-v1`,
    source: "issue-provider",
  });
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "issue";
}

function truncateAscii(value: string, maxBytes: number): string {
  return value.slice(0, maxBytes).replace(/-+$/gu, "");
}
