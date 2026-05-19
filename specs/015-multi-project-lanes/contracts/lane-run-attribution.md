# Contract: Lane Run Attribution

## Purpose

Define the submitted-lane snapshot carried by canonical job reads so run
inspection remains honest after project edits or concurrent overlap.

## Required Semantics

The canonical job snapshot must carry a frozen submitted-lane view that includes:

- selected project identity (`projectId`, `projectSlug`)
- selected repo/base branch/default agent
- resolved runtime contract used for the run
- selected context bundle refs and prewarm config
- workflow hint captured at submission time, when present
- timestamp or equivalent durable submission marker

## Rules

1. This view is frozen at job creation and does not change when the project is
   edited later.
2. It complements, but does not replace, the current project-backed view in the
   snapshot.
3. It must stay consistent with `run.runtime` and must not become a second
   runtime-truth object.
4. Workflow observation from run events stays separate and may add more truth
   later than the submission-time hint.

## Example Shape

```json
{
  "projectId": "2f4e4b03-7cf0-47d7-a035-9fa5cb0c5f1a",
  "projectSlug": "mystra",
  "repo": "local/mystra",
  "baseBranch": "main",
  "defaultAgent": "codex",
  "runtime": {
    "environment": {
      "provider": "docker",
      "image": "mystra-runner:mystra"
    },
    "mounts": []
  },
  "contextBundleRefs": [
    {
      "slug": "agent-skills",
      "required": true,
      "accessMode": "read-only"
    }
  ],
  "prewarmConfig": {
    "manager": "pnpm"
  },
  "workflow": {
    "provider": "local",
    "blueprintName": "mvp.coding",
    "blueprintVersion": "1.0.0"
  },
  "submittedAt": "2026-01-15T12:34:56.000Z"
}
```
