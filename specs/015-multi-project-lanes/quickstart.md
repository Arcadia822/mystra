# Quickstart: Multi-Project Lanes

## Goal

Verify that Mystra can expose `mystra` and `skrya` as distinct project lanes on
one host, and that job inspection remains honest after lane overlap or project
edits.

## Focused Verification Sequence

1. Run shared contract tests after any lane-schema change:

   ```sh
   pnpm --filter @mystra/shared test
   ```

2. Run control-plane route and provider tests after any lane projection or
   snapshot change:

   ```sh
   pnpm --filter @mystra/control-plane test
   ```

3. Run runner-daemon tests when workflow attribution or resolved runtime behavior
   is asserted through job snapshots:

   ```sh
   pnpm --filter @mystra/runner-daemon test
   ```

4. Run broad type safety after cross-package changes:

   ```sh
   pnpm typecheck
   ```

## Manual Lane Check

Before creating jobs, ensure any referenced required context bundles already
exist. If a lane references `runtime.contextBundleRefs` with
`required: true` and the bundle is missing, submission fails with
`RUNTIME_CONTEXT_BUNDLE_NOT_FOUND`, which is the intended control-plane guard.

Use one trusted local deployment with at least two configured projects:

```text
project 1: mystra
  repo: local/mystra
  baseBranch: main
  defaultAgent: codex
  workflow hint: metadata.workflow.blueprintName = "mvp.coding"

project 2: skrya
  repo: local/skrya
  baseBranch: develop
  defaultAgent: copilot
  workflow hint: metadata.workflow.blueprintName = "ops.hotfix"
```

Expected behavior:

1. `GET /api/projects/{slug}` returns the **current** lane configuration,
   including runtime/config/context/workflow-hint inspection facts.
2. `POST /api/jobs` captures a **submitted lane snapshot** that remains stable if
   the project is edited later.
3. `GET /api/jobs` and `GET /api/jobs/{id}` keep `mystra` and `skrya` runs
   distinguishable through frozen lane attribution, not just branch names.
4. Workflow observation remains additive: before workflow start, the lane hint is
   still inspectable; after workflow start, the workflow snapshot carries the
   observed provider/blueprint facts.
5. Existing runner eligibility still prevents cross-lane claiming when runner
   project or runtime filters are configured.

### Example current lane inspection payload

`GET /api/projects/mystra` should now expose a current lane view under
`project.lane`, for example:

```json
{
  "project": {
    "slug": "mystra",
    "repo": "local/mystra",
    "baseBranch": "main",
    "defaultAgent": "codex",
    "lane": {
      "repo": "local/mystra",
      "baseBranch": "main",
      "defaultAgent": "codex",
      "runtime": {
        "provider": "docker",
        "image": "mystra-runner:mystra"
      },
      "contextBundleRefs": [
        {
          "slug": "agent-skills",
          "required": true,
          "accessMode": "read-only"
        }
      ],
      "workflow": {
        "provider": "local",
        "blueprintName": "mvp.coding",
        "blueprintVersion": "1.0.0"
      }
    }
  }
}
```

### Example frozen submitted-lane snapshot

`GET /api/jobs/{id}` and `mystra_get_job` should now expose both the current
project-backed view and the frozen submission-time lane snapshot:

```json
{
  "project": {
    "slug": "mystra",
    "lane": {
      "repo": "local/mystra-v2",
      "baseBranch": "develop",
      "defaultAgent": "copilot",
      "workflow": {
        "blueprintName": "ops.hotfix",
        "blueprintVersion": "2.0.0"
      }
    }
  },
  "lane": {
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
    "workflow": {
      "provider": "local",
      "blueprintName": "mvp.coding",
      "blueprintVersion": "1.0.0"
    }
  }
}
```

## Edge Verification

- project edited after job submission
- concurrent `mystra` and `skrya` runs overlap
- missing or malformed `metadata.workflow`
- distinct context bundle refs per lane, with those referenced bundles created before submission
- distinct runtime image or provider defaults per lane
- archived lane does not block unrelated active lane

## Trust Boundary

This slice extends the same **private-ops** management surface frozen in `014`.
It is intended for localhost or a trusted internal network until caller auth
exists.
