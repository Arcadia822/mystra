# Quickstart: Thin MCP Adapter

## Goal

Verify that Mystra's MCP route behaves as a thin transport adapter over the
canonical management contract instead of a second business surface.

## Verification Sequence

1. Rebuild shared contracts:

   ```sh
   pnpm --filter @mystra/shared build
   ```

2. Reconfirm control-plane route behavior:

   ```sh
   pnpm --filter @mystra/control-plane test -- --run app/api/routes.test.ts
   ```

3. Reconfirm control-plane typing:

   ```sh
   pnpm --filter @mystra/control-plane typecheck
   ```

## Manual MCP Validation

1. Confirm tool discovery still reflects the live adapter:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":"tools","method":"tools/list"}'
   ```

2. Submit one canonical create-project flow through MCP:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"create-project",
       "method":"tools/call",
       "params":{
         "name":"mystra_create_project",
         "arguments":{
           "name":"Thin MCP Adapter Check",
           "slug":"thin-mcp-adapter-check",
           "repo":"local/thin-mcp-adapter-check",
           "defaultAgent":"codex",
           "runtime":{"image":"mystra-runner:local"}
         }
       }
     }'
   ```

3. Repeat the same create-project flow with the same slug and confirm the result
   is a canonical business conflict, not a transport-level internal error.

4. Submit one canonical create-job flow through MCP:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"create-job",
       "method":"tools/call",
       "params":{
         "name":"mystra_create_job",
         "arguments":{
           "taskId":"thin-mcp-adapter-check",
           "source":"mcp",
           "projectId":"<project-id>",
           "branchName":"mystra/thin-mcp-adapter-check",
           "prompt":"Verify MCP remains a thin adapter."
         }
       }
     }'
   ```

5. Inspect the same job through `mystra_get_job`:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"get-job",
       "method":"tools/call",
       "params":{
         "name":"mystra_get_job",
         "arguments":{"jobId":"<job-id>"}
       }
     }'
   ```

6. Confirm the operational exception path is still live:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"health",
       "method":"tools/call",
       "params":{
         "name":"mystra_health",
         "arguments":{}
       }
     }'
   ```

7. Trigger one transport-local invalid-params failure:

   ```sh
   curl -sS "${MYSTRA_MCP_URL:-http://127.0.0.1:3000/api/mcp}" \
     -H 'content-type: application/json' \
     -d '{
       "jsonrpc":"2.0",
       "id":"bad-get-job",
       "method":"tools/call",
       "params":{
         "name":"mystra_get_job",
         "arguments":{}
       }
     }'
   ```

## Manual Expectations

1. `tools/list` advertises the current tool set and input schemas.
2. `mystra_create_project` returns the canonical `{ project }` wrapper used by
   HTTP for the same action.
3. A duplicate project slug returns a canonical business conflict instead of a
   transport-level internal error.
4. `mystra_create_job` returns the canonical job snapshot meaning inside the
   existing MCP wrapper.
5. `mystra_get_job` returns the canonical snapshot meaning, not a second MCP-only
   read model.
6. `mystra_health` remains an explicit MCP-owned operational exception instead of
   pretending to be part of the canonical management contract.
7. Invalid tool arguments remain JSON-RPC transport failures.
8. Valid business failures such as missing job remain canonical management
   business errors inside the MCP result payload.
