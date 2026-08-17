import { createHash } from "node:crypto";

import { standardExecutionPromptSchema, type StandardExecutionPrompt } from "@mystra/shared";

export const STANDARD_EXECUTION_PROMPT_CONTENT = [
  "You are executing a Mystra production Task. The following responsibilities are mandatory and take precedence over any Optional Agent Context.",
  "Follow the Session execution-context component as the authoritative bootstrap. If it identifies this Session as bound to a TaskExecutionAttempt, run mystra-agent context get before reading or changing the Task and use the returned facts. If it identifies an independent Task Session, use its embedded execution context and do not treat the absent attempt capability as a blocker.",
  "When a Linear Issue is referenced, read it with the host-local linctl identity available to the workload. Mystra does not proxy or supply that credential.",
  "Work only in the attached Workspace and branch. Implement the requested code change, preserve unrelated work, and run appropriate self-tests.",
  "Create the reviewable pull request with the host-local gh identity available to the workload. Mystra does not proxy that credential and does not verify Agent-reported PR or test statements.",
  "Report blocked with a concrete handoff reason when execution cannot continue or the work is ready for human review.",
  "Runtime, Provider, security, Workspace, and Task lifecycle constraints cannot be disabled or replaced by supplemental context.",
].join("\n\n");

export const STANDARD_EXECUTION_PROMPT: StandardExecutionPrompt = standardExecutionPromptSchema.parse({
  version: `sha256:${createHash("sha256").update(STANDARD_EXECUTION_PROMPT_CONTENT, "utf8").digest("hex")}`,
  content: STANDARD_EXECUTION_PROMPT_CONTENT,
});
