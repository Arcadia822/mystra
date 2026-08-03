# Research: Task / Session 业务模型迁移

## Decision 1: Use a complete contract cutover

**Decision**: Replace the old public types, tables, routes, tools and commands in one feature branch. Do not add compatibility aliases or translation adapters.

**Rationale**: The user explicitly authorizes a breaking migration and requires the old model to disappear. An adapter would turn a vocabulary migration into a permanent dual model and make Task/Session semantics depend on rejected attempt/connection concepts.

**Alternatives considered**:

- Temporary aliases: rejected because they preserve old entry points and test burden.
- Versioned `/v2` API: rejected because the MVP has no compatibility commitment and would keep two contracts.
- UI-only rename: rejected because persistence and runner behavior would remain semantically wrong.

## Decision 2: Task is a durable container without execution state

**Decision**: Task owns Project, immutable repository context, source/Issue identity, high-level objective and metadata. It may have zero Sessions and has no queued/running/completed state.

**Rationale**: A loose one-to-many relation means sibling Sessions are independent. Deriving Task state would quietly recreate orchestration and force ambiguous aggregation when Sessions disagree.

**Alternatives considered**:

- Aggregate Task state: rejected because concurrent sibling states have no canonical total order.
- Task equals first Session: rejected because it prevents empty Tasks and distinct child subtasks.
- Task completion flag: deferred until the product defines archive/completion semantics independently of execution.

## Decision 3: Session is the complete execution and review unit

**Decision**: Session owns child objective, Agent, branch, runtime, lifecycle state, optional Runner assignment, cancellation/failure details and review result. Explicit rerun creates a new Session.

**Rationale**: This provides immutable execution evidence without reintroducing attempts. It also allows a Task to contain implementation, investigation and verification Sessions with different goals.

**Alternatives considered**:

- Attempt rows below Session: rejected because the user explicitly does not want a renamed hidden Run model.
- Mutable Session rerun: rejected because it destroys audit/review evidence.
- Parent/child Session graph: deferred because it adds orchestration not required for loose ownership.

## Decision 4: Stable Runner identity is an upserted resource

**Decision**: Use a stable Runner row keyed by generated ID and unique `runnerName`. Registration requires the existing architecture's shared runner-registration secret, updates capabilities/capacity/eligibility and rotates an internal credential on the same row.

**Rationale**: Process restarts should not create new managed resources. Credentials and heartbeat are operational attributes; they do not justify a separate business object.

**Alternatives considered**:

- Preserve connection rows: rejected because they recreate `RunnerSession` as a managed concept.
- Stable ID supplied only by runner: rejected for MVP because the existing registration already has a unique runner name and control-plane-issued identity.
- Unauthenticated same-name upsert: rejected because it permits Runner takeover and contradicts the documented shared enrollment secret.
- Never rotate token: rejected because stale process credentials would remain valid indefinitely.

## Decision 5: Keep internal Session facts private

**Decision**: Persist internal `session_events` rows for transactional state explanation and runner ingestion, but do not export an event record schema from management contracts and do not provide a public collection or timeline.

**Rationale**: Execution correctness still benefits from append-only facts, while product semantics for activity projection, retention and stable IDs are explicitly deferred.

**Alternatives considered**:

- Remove event persistence entirely: rejected because state changes and failure diagnosis currently depend on structured facts.
- Rename and expose events publicly: rejected because it would decide the deferred timeline/API question.
- Store raw stdout/stderr: rejected by MVP boundary.

## Decision 6: Exact destructive SQLite reset

**Decision**: Detect the full current schema marker first. When absent, compare `sqlite_schema` against an exact allowlisted legacy Mystra table/column fingerprint. Only then, with foreign-key handling controlled outside an immediate transaction, drop enumerated legacy tables, create the new schema, run `foreign_key_check`, and commit. Unknown/mixed schemas fail closed.

**Rationale**: SQLite permits one writer at a time; an immediate transaction makes write ownership explicit. Foreign-key-aware `DROP TABLE` performs implicit deletes and can fail on dependency ordering, so reset logic must control foreign keys and still verify integrity before enabling the new schema. No database file deletion is needed.

**Alternatives considered**:

- Delete the SQLite file: rejected because path mistakes have a much larger blast radius and cannot distinguish unrelated databases.
- Rename/copy old tables: rejected because no data migration is required and it leaves legacy schema residue.
- Partial table-name matching: rejected because it can destroy an unrelated or mixed database.
- `PRAGMA writable_schema`: rejected because direct schema text editing is unnecessary and unsafe here.

**Primary references**:

- [SQLite transaction control](https://sqlite.org/lang_transaction.html)
- [SQLite foreign key behavior](https://www.sqlite.org/foreignkeys.html)
- [SQLite DROP TABLE](https://www.sqlite.org/lang_droptable.html)

## Decision 7: Atomic claim and dispatch use provider transactions

**Decision**: Issue dispatch and Session claim each execute selection, invariant validation, write and internal fact append within a single provider transaction. Network calls happen before or after, never inside the SQLite write critical section.

**Rationale**: SQLite supports only one simultaneous writer. Keeping transactions short prevents duplicated Task/Session creation and duplicated claims without adding queues or locks outside the database.

**Alternatives considered**:

- Read then write without transaction: rejected due race conditions.
- Application mutex: rejected because it does not protect multiple processes and duplicates database ownership.
- New queue service: rejected as unnecessary infrastructure for the local MVP.

## Decision 8: Branch conflicts are explicit

**Decision**: Resolve a concrete branch for every Session before queueing. Within one repository, two non-terminal Sessions cannot silently own the same branch; creation/claim returns a typed conflict unless the caller supplies a distinct branch.

**Rationale**: Loose sibling Sessions can execute concurrently. Sharing a working branch would make delivery results race and undermine independent Session evidence.

**Alternatives considered**:

- Auto-suffix every collision: rejected because it hides a caller-visible delivery decision.
- Allow branch sharing: rejected because concurrent commits/pushes are not isolated.
- Force one active Session per Task: rejected because it contradicts loose one-to-many concurrency.

## Decision 9: Existing adapters remain thin

**Decision**: HTTP remains canonical. CLI and MCP call the same management routes/contracts; runner protocol has separate authenticated internal routes. Web consumes the management contract.

**Rationale**: This follows the current constitution and prevents each adapter from inventing slightly different Task/Session semantics.

**Alternatives considered**:

- Direct CLI SQLite access: rejected because it bypasses provider/API behavior.
- MCP-specific persistence calls: rejected because it duplicates validation and error mapping.
