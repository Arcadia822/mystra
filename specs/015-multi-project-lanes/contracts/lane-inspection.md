# Contract: Lane Inspection

## Purpose

Define the current lane configuration that `GET /api/projects/{slug}` must expose
for one-host multi-project coordination.

## Required Semantics

The lane inspection payload must include:

- project identity (`id`, `name`, `slug`)
- repository identity (`repo`, `baseBranch`)
- execution defaults (`defaultAgent`, runtime config, prewarm config)
- context inputs (`runtime.contextBundleRefs`, runtime mounts where relevant)
- workflow hint from `metadata.workflow`, when present
- current metadata needed to distinguish lanes without the UI

## Rules

1. This is the **current** lane configuration, not a historical view.
2. Missing workflow hints are allowed and must not produce a 500.
3. The contract must not imply first-class workflow-registry storage that does
   not exist yet.
4. `mystra` and `skrya` must remain distinguishable even when they share the same
   host and runner fleet.

## Example Shape

```json
{
  "repo": "local/mystra",
  "baseBranch": "main",
  "defaultAgent": "codex",
  "runtime": {
    "provider": "docker",
    "image": "mystra-runner:mystra",
    "contextBundleRefs": [
      {
        "slug": "agent-skills",
        "required": true,
        "accessMode": "read-only"
      }
    ]
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
  }
}
```
