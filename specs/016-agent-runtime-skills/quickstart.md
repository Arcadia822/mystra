# Quickstart: Agent Runtime Skills

## Goal

Verify that the first local Mystra coordinating skill surface can submit work
and inspect job status without hand-writing raw MCP payloads, while still
remaining aligned with the canonical management truth from `014` and `015`.

## Skill Inventory

The current skill surface lives under:

```text
.agents/skills/
├── mystra-submit-user-journey/
├── mystra-submit-implementation-request/
└── mystra-check-job-status/
```

Verify discovery:

```sh
find .agents/skills -maxdepth 2 -name SKILL.md | grep 'mystra-'
```

## Verification Sequence

1. Rebuild shared contracts:

   ```sh
   pnpm --filter @mystra/shared build
   ```

2. Reconfirm control-plane route and MCP behavior:

   ```sh
   pnpm --filter @mystra/control-plane test
   ```

3. Reconfirm workspace typing if route/shared code changed:

   ```sh
   pnpm typecheck
   ```

## Fixture-Backed Drift Check

`016` does not parse markdown examples to detect drift. Instead, the repository
keeps explicit implementation-request, user-journey, and status fixtures in
`apps/control-plane/app/api/routes.test.ts`, then validates those fixtures
against the live `mystra_create_job` / `mystra_get_job` contract.

## Manual MCP Validation

1. Confirm the MCP endpoint is alive:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}'
   ```

2. Submit one job through the same underlying MCP contract used by the local
   implementation-request skill:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"implementation-submit",
       "method":"tools/call",
       "params":{
         "name":"mystra_create_job",
         "arguments":{
           "taskId":"fixture-implementation-task",
           "source":"mcp",
           "projectId":"<project-id>",
           "branchName":"mystra/fixture-implementation-task",
           "agent":"codex",
           "prompt":"Implement the requested scope in the target project.\n\nSpec reference: specs/016-agent-runtime-skills/spec.md\nPlan reference: specs/016-agent-runtime-skills/plan.md\nTask scope: Keep the local skill wrapper aligned with canonical MCP semantics.\nWorkflow blueprint hint: mvp.coding\n\nConstraints:\n- Stay inside the current MCP contract.",
           "metadata":{
             "submissionKind":"implementation-request",
             "specReference":"specs/016-agent-runtime-skills/spec.md",
             "planReference":"specs/016-agent-runtime-skills/plan.md",
             "workflow":{"blueprintName":"mvp.coding"}
           }
         }
       }
     }'
   ```

3. Inspect the same job through the status path:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"job-status",
       "method":"tools/call",
       "params":{
         "name":"mystra_get_job",
         "arguments":{"jobId":"<job-id>"}
       }
     }'
   ```

## Manual Expectations

1. Submission returns a created job identifier and current run state.
2. Status inspection returns the canonical durable job snapshot shape, and the
   status skill summarizes only fields that actually exist there.
3. Missing-input and missing-job cases remain explicit rather than collapsing
   into one generic error.
4. Transport failures are reported as connection problems, not business success.
5. Project-backed jobs continue to reflect `project.lane` as current truth and
   `lane` as frozen submission-time truth when relevant.

## Extension Check

When adding a future local Mystra skill, confirm:

1. it packages an existing canonical action instead of inventing a second truth
2. it documents required inputs before transport use
3. it preserves canonical failure meaning
4. it uses the existing local skill-pack layout under `.agents/skills/`
