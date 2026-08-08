# Engineering Review: 046 Agent Definition

**Date**: 2026-08-08
**Branch**: `046-agent-definition`
**Decision**: APPROVED — IMPLEMENTED AND VERIFIED

## Step 0 — Existing system and scope pressure

- Existing seams are sufficient: Team RBAC, shared Zod schemas, `RdbProvider`, dual Prisma clients, Route Handlers, MCP JSON-RPC and operator CLI.
- No new service layer, queue, worker or package is justified.
- The change spans more than eight files because one business contract must be usable and verified through five existing boundaries. Reducing it to database-only would violate SC-007; adding UI would be overbuild.
- The apparent broader problem—redesign all Session/Task/Project persistence—is an ocean and explicitly excluded. 046 must expose the Agent resolver seam without pretending to own Session.

## Architecture review

```text
shared contract
     |
     +--> canonical HTTP route --> RdbProvider --> Prisma
     |
     +--> MCP adapter -----------> RdbProvider
     |
     +--> CLI request -----------> HTTP route
```

Approved because validation and authorization have one semantic source. MCP may invoke RdbProvider directly inside the same control-plane process, but it must parse the same shared schemas and permissions.

## Data and concurrency review

- One current-state Agent row is sufficient; revision history belongs in future Session snapshots, not a second table.
- Prompt updates require `expectedRevision`; `updateMany` predicate prevents lost updates.
- Rename-only does not increment revision. This is deliberate because revision is execution semantics, not generic ETag.
- Archive uses the same expected revision, preventing update/archive races.
- Cross-Team lookup returns not found, avoiding object-existence disclosure.

## Failure mode review

| Failure | Detection | Stable result | Partial write? |
| --- | --- | --- | --- |
| blank/oversized prompt | shared Zod schema | `INVALID_AGENT` | no |
| missing/cross-Team ID | Team-filtered lookup | `AGENT_NOT_FOUND` | no |
| archived update/resolve | status check | `AGENT_ARCHIVED` | no |
| stale expected revision | conditional update count=0 | `AGENT_REVISION_CONFLICT` | no |
| DB unique/relation/availability error | existing normalization | safe RDB error | transaction rollback |
| MCP malformed params | shared schema parse | JSON-RPC `-32602` | no |
| CLI transport failure | existing CLI envelope | transport exit code | unknown; response absent |

## Security and tenancy review

- Public bodies never accept Team ID.
- All reads use active Team plus `team.resource.access`.
- All mutations additionally require `team.settings.manage`.
- Prompt is ordinary Team-visible configuration and must not contain or cause serialization of secrets.
- Strict schemas reject hidden configuration fields and mass-assignment attempts.

## Test coverage map

```text
schema unit tests
  -> field whitelist / limits / Provider terminology

provider contract (SQLite + PostgreSQL)
  -> CRUD / tenancy / pagination / revisions / archive / snapshot

HTTP route tests
  -> auth / permission / status mapping / Team derivation

MCP tests
  -> tool discovery / shared validation / permission / errors

CLI tests
  -> argv / request / output / exit codes

parity + typecheck + build
  -> generated clients / cross-dialect schema / integration surface
```

## Performance review

- List is bounded to 100 rows and uses `(teamId, status, id)` index.
- Get/resolve uses primary key plus Team/status predicates.
- Update performs one read and one conditional update inside a transaction; conflict diagnosis may add one read only on failure.
- No prompt history fan-out or N+1 relation loading.

## Terminology migration review

Provider keys in pre-0.1 public contracts must be directly renamed. Keeping aliases would allow both `agentId` and `agent="codex"` to coexist, exactly the ambiguity 046 removes. Adapter symbol renames and stale Project default removal are part of the contract correction; Session persistence remains untouched.

## Sequential implementation recommendation

1. RED shared Agent schemas and Provider terminology tests.
2. GREEN shared contracts and direct Provider rename.
3. RED RdbProvider contract and Prisma parity/migration tests.
4. GREEN Agent persistence and resolver.
5. RED/GREEN HTTP API.
6. RED/GREEN MCP tools.
7. RED/GREEN CLI commands.
8. Full regression, terminology audit, GitNexus changed-flow review.

No open engineering decision blocks task generation. Outside-voice review was not used: the local skill evidence, refreshed GitNexus graph and existing project seams are sufficient, and no subagent delegation was authorized.

## Final implementation review

- **Correctness**: Team isolation, strict request fields, prompt revision behavior,
  concurrent prompt conflict, archive/read/resolve behavior and detached snapshots
  are covered by shared, provider, HTTP, MCP and CLI tests.
- **Architecture**: Agent remains a Team-owned RDB object. Session persistence was
  not introduced; the only forward seam is `resolveActiveAgent` plus shared
  composition schemas.
- **Security**: Team ID is derived from the authenticated active Team; reads and
  mutations use separate existing permissions; public payloads cannot mass-assign
  Team, Project, Provider, Runtime, Context, skills, tools or model fields.
- **Performance**: list operations are capped at 100 and use the
  `(teamId, status, id)` index. No relation fan-out or N+1 query was introduced.
- **Review fixes**: update/archive revisions now reject JSON strings rather than
  coercing them; stale `--agent copilot` documentation was corrected; the
  obsolete Project create CLI that still sent rejected Agent/Runtime defaults
  was removed; the generated GitNexus fallback instruction was restored to the
  repository-local runner that works in this checkout.

**Verdict**: APPROVE. The only unavailable gate is the live PostgreSQL provider
contract, deliberately skipped because `MYSTRA_TEST_POSTGRES_URL` is not set.
