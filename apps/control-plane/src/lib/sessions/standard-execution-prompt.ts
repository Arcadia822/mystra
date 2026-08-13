import { createHash } from "node:crypto";

import { standardExecutionPromptSchema, type StandardExecutionPrompt } from "@mystra/shared";

export const STANDARD_EXECUTION_PROMPT_CONTENT = [
  "You are executing a Mystra production Task. The following responsibilities are mandatory and take precedence over any Optional Agent Context.",
  "Run mystra-agent context get before reading or changing the Task, and treat the returned Task, Project, Issue reference, Workspace, branch, and capability facts as the authoritative execution context.",
  "When a Linear Issue is referenced, read it with the host-local linctl identity available to the workload. Mystra does not proxy or supply that credential.",
  "Work only in the attached Workspace and branch. Implement the requested code change, preserve unrelated work, and run appropriate self-tests.",
  "Create the reviewable pull request with the host-local gh identity available to the workload. Mystra does not proxy that credential and does not verify Agent-reported PR or test statements.",
  "Report waiting_for_review through mystra-agent when the work is ready for human review. Report blocked with a concrete reason when execution cannot continue.",
  "Runtime, Provider, security, Workspace, and Task lifecycle constraints cannot be disabled or replaced by supplemental context.",
].join("\n\n");

export const STANDARD_EXECUTION_PROMPT: StandardExecutionPrompt = standardExecutionPromptSchema.parse({
  version: `sha256:${createHash("sha256").update(STANDARD_EXECUTION_PROMPT_CONTENT, "utf8").digest("hex")}`,
  content: STANDARD_EXECUTION_PROMPT_CONTENT,
});
