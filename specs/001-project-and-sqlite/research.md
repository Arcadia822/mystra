# Research: Project Abstraction + SQLite Persistence

## Decision: Project Is The Stable Task Configuration Owner

**Rationale**: Remote MCP and HTTP callers should submit `projectId`, `branchName`, and `prompt` without repeating repo/baseBranch/agent/image. This keeps platform capabilities separate from per-project configuration and makes multi-project operation practical.

**Alternatives considered**:

- Keep repo/baseBranch/agent/image on every task: rejected because it repeats configuration and makes callers responsible for platform defaults.
- Keep a config file seed only: rejected because operators need API/MCP-driven Project CRUD.

## Decision: Tasks Store Resolved Snapshots

**Rationale**: Historical tasks must remain explainable after Project edits. Store `project_id` for traceability and also store resolved repo/baseBranch/agent fields on logical task records in the SQLite `jobs` table.

**Alternatives considered**:

- Query live Project for every task display: rejected because Project edits would rewrite history.
- Store only a JSON spec: rejected because it weakens relational queries and duplicates the current local-store shape.

## Decision: No Transaction Wrapper Around Project Lookup + Task Insert For MVP

**Rationale**: Task records store a snapshot, not a live reference. Current single-machine SQLite path has modest concurrency, and Project mutation after lookup does not corrupt the created task.

**Alternatives considered**:

- Strict transaction around project lookup, job insert, and run insert: deferred unless tests expose a concrete race.
- DB-level lock strategy for future Postgres: deferred to `SupabaseRdbProvider`.

## Decision: RdbProvider Returns Domain Types Only

**Rationale**: Future PG/Supabase must be a new provider implementation, not an interface rewrite. The interface must not expose `lastInsertRowid`, raw SQL, SQLite statement handles, or SQLite row shapes.

**Alternatives considered**:

- Export helper functions around `better-sqlite3`: rejected because it would leak dialect into routes.
- Wrap local-store API exactly: rejected because local-store concepts are in-memory records, not durable provider contracts.

## Decision: Use better-sqlite3 For Local MVP

**Rationale**: The MVP runs on a private high-capacity server and benefits from simple synchronous SQLite calls. WAL mode supports the single-writer/multiple-reader pattern and avoids a premature ORM.

**Alternatives considered**:

- ORM: rejected for MVP because it adds abstraction before the provider contract is stable.
- Async SQLite wrapper: rejected because current control-plane route handlers do not need connection-pool complexity.

## Decision: Project.runtime.image Is Runtime Truth

**Rationale**: Different GitLab/GitHub projects may need different runtime images. A runner-global `MYSTRA_RUNNER_IMAGE` prevents per-project isolation, and top-level `Project.image` is no longer the public/runtime contract.

**Alternatives considered**:

- Keep runner-global image and add overrides later: rejected because it preserves the wrong contract.
- Validate image on Project creation: deferred because registry access and auth would add nonessential MVP complexity.

## Decision: Prewarm Is Stored But Not Automatically Triggered By Bare Docker

**Rationale**: Prewarm belongs to the sandbox provider capability. Bare Docker MVP does not support automatic prewarm lifecycle. Project stores `prewarmConfig` for future providers and manual operator scripts.

**Alternatives considered**:

- Trigger prewarm on Project create/update: rejected because it couples control-plane CRUD to runner/sandbox behavior too early.
- Remove prewarmConfig: rejected because future sandbox providers need a durable config place.
