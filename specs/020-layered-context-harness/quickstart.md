# Quickstart: Layered Context Harness

This quickstart describes the documentation-level contract that should be visible
after the feature is implemented.

## 1. Start In A Collaborative Workspace

- Requirements, review notes, and discussion may keep changing.
- The collaborative workspace is the place where approval happens, not the place
  where sandbox agents read live chat.

## 2. Submit Work To Mystra

- Job submission freezes the approved spec into an execution-facing artifact.
- That frozen artifact becomes the run's execution contract.
- Later edits in the collaborative workspace do not mutate the accepted run.

## 3. Inspect The Execution Workspace Contract

Expected documentation outcome:

- Context Bundle semantics describe the frozen spec artifact as an injected input.
- Runner-facing docs describe sandbox agents as consuming injected artifacts rather
  than collaborative chat history.
- Review-facing docs describe how outputs remain attributable to the frozen spec
  used for execution.

## 4. Review The Completed Run

Expected review outcome:

- A reviewer can identify which frozen spec version produced the artifact.
- If the collaboration space has a newer revision, the docs make clear that a new
  job is required instead of mutating the completed run.

