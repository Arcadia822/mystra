# Mystra Constitution

## Core Principles

### I. Specification Owns Product Boundaries

Mystra changes must preserve the documented MVP boundary unless the boundary is explicitly amended first. GitHub connection methods are deployment-aware: self-hosted Mystra supports explicit PAT connections behind `SecretProvider`; the platform-operated Mystra GitHub App is hosted-only. The open-source tree may retain hosted App code and tests, but self-hosted entry points must report a stable unavailable capability and fail closed. Hosted OAuth verifies that an authenticated actor may bind an installation to a Team; App installation tokens remain short-lived; PAT plaintext stays behind a protected SecretProvider boundary. Durable relational state may store only non-secret connection metadata, opaque references, and authenticated encryption envelopes whose per-secret DEK is wrapped by a KEK held outside RDB. Every Project binds one exact connection and connection modes never silently fall back. Mystra's MVP is a flexible software factory: standardized requirements enter as Tasks, Providers execute under a program-owned Standard Execution Prompt, optional Agent Context supplies lower-priority behavior guidance, and reviewable results leave the factory. Task owns a Mystra productionStatus distinct from external Issue status and Session execution state. Feature 051 separates `mystra`, the Control Plane management CLI, from `mystra-agent`, the workload-local attempt CLI. The latter uses a short-lived execution code to retrieve minimum sufficient Task/Project/Issue-reference/Workspace context and request allowlisted Task-status transitions without accepting arbitrary Task IDs. In the first self-use path the executing Provider uses the host user's authenticated `linctl` to read Linear and authenticated `gh` to publish a PR; Mystra does not proxy, credential, fall back, query, or verify those operations. Agent-authored PR and self-test notes are unverified. A thin Harness attempt freezes an optional selected Agent snapshot and associates one goal/autopilot Session without introducing a parallel production state machine. Do not introduce a general-purpose logs API, arbitrary stdout/stderr persistence, retry API, arbitrary callbacks, quality-gate fix loops, webhooks, Issue write-back, a general-purpose Integration management catalog, Claude CLI, Kubernetes sandbox workloads, cross-runner shared caches, arbitrary per-repository secret management, standing orders, arbitrary triggers, or general workflow automation as incidental work. A Team-authorized, typed, schema-validated, bounded and redacted Harness/Session event history is permitted for production truth; it does not authorize cross-Task global search, a general activity feed, or a log product. Self-hosted Mystra provides single-node human username/password authentication and Owner/Admin/Member Team RBAC as in-scope capabilities; registration grants each human User an initial Team they own, every User always belongs to at least one Team, and Team is the top-level tenant boundary (feature 043 owns this contract). Self-host identity introduces no email dependency and no long-lived Agent/workload identity. Hosted multi-tenant caller identity federation, caller-login OAuth (SSO/social), managed platform secrets, hosted Team administration, public multi-tenancy, and installation lifecycle handling remain prerequisites owned by explicit hosted phases, not capabilities that self-hosted code may assume already exist. PostgreSQL and user-configured Supabase-backed PostgreSQL are approved RDB deployment targets, but they do not authorize public multi-tenancy, managed database provisioning, or hosted Team administration.

### II. Typed Contracts at Service Boundaries

Control-plane APIs, CLI payloads, Runner protocol payloads, MCP tools and Integration capabilities must use explicit TypeScript and Zod contracts. Team is the tenant boundary: Agent, Task, Project, Harness, and Session are distinct Team-scoped objects. Agent and Task do not belong to Project. Task owns productionStatus: pending, in_progress, blocked, waiting_for_review, done, or canceled. Start, with omitted/null or an explicit active Team Agent ID, atomically moves pending to in_progress and creates one thin Harness attempt in a short RDB transaction; after commit it requests Workspace preparation, and Workspace readiness idempotently leads to the attempt's one goal/autopilot Session. The attempt-scoped workload may only report blocked, resume in_progress, or declare waiting_for_review through a dedicated scoped transition contract; Human owns done and canceled. Every transition is allowlisted, revision-safe, idempotent and append-only audited. Harness freezes all Agent identity fields or none but owns no parallel production lifecycle. Session state changes never automatically mutate Task status. Session belongs to neither Task nor Project as an ownership parent; it remains a Team-scoped execution object and MAY reference its driving Harness plus optional Task/Project context. Session launch resolves Runtime, Provider, optional Agent Context and execution Context, composes the immutable program-owned Standard Execution Prompt with lower-priority optional Agent Context, and atomically persists the Session, frozen effective prompt evidence, ready Task Workspace attachment, and first user message before Runtime/Provider I/O. Mystra defines no Turn business object; message identity is only command idempotency and SessionEvent correlation. Features 048/049/050 provide the underlying Task Workspace, Session launch/continuation and observation contracts; feature 051 adds the thin Task production attempt above them; feature 052 replaces mandatory Agent assignment without introducing a default/sentinel Agent or a second Workspace type. Workspace preparation claim/lease is materialization fencing, not Session Runtime capacity, slot or execution occupancy.

### III. Providers Are Replaceable Boundaries

Mystra uses Open Agents as a source-authoritative framework baseline but owns its provider and execution boundaries. RDB, Issue, sandbox, repository, and Agent integrations must sit behind explicit Mystra-owned contracts. SQLite, PostgreSQL, and Supabase-backed PostgreSQL are selectable RDB deployments behind the same `RdbProvider`; Supabase is a PostgreSQL deployment profile rather than a separate domain contract. GitHub supplies the active remote RepoProvider and repository-scoped IssueProvider; Linear supplies a read-only IssueProvider. Runtime is a first-class, replaceable execution backend that advertises which Provider capabilities (agent CLI / protocol families) it can run, expressed source-agnostically so a host-discovered Runtime and a future image-declared Runtime share one contract. A host-bound Runtime enrolled by the TypeScript `mystra-runner` — covering registration, Provider discovery plus availability confirmation, and heartbeat/status — is in MVP scope; single-machine Docker is one such sandbox provider rather than the sole execution model, and host worktree direct execution is the intended default execution direction. Feature 047 owns Task context and exact Issue intake, feature 048 owns Task Workspace preparation, feature 049 owns Task-bound Session launch/continuation and typed event history, feature 051 owns Task productionStatus, `mystra-agent` context/status surfaces, a thin Harness attempt and exactly one goal/autopilot Session, and feature 052 owns the Standard Execution Prompt plus optional Agent Context contract. The platform core must not define a general WorkflowProvider, user-configurable workflow blueprint, workflow node graph or workflow DSL outside this slice. Harness-owned heartbeat/event subscriptions, multiple Session coordination, generic Artifact/Delivery contracts, platform-proxied external CLIs, PR/self-test verification and Production Recipes require explicit follow-up specifications.

### IV. Runner Isolation and Secret Hygiene

Runner hosts connect outbound to the control plane; the control plane must not require inbound access to a runner host. A host-bound Runtime advertises the Provider CLIs it has discovered and confirmed available without baking their credentials or login state into the platform. Feature 051 additionally assumes host-local `linctl` and `gh` are installed and authenticated for the same OS user as the executing Provider; their credentials remain owned by those tools and are never returned by `mystra-agent`. The `MYSTRA_EXECUTION_CODE` is a separate, short-lived, revocable attempt capability and must not appear in prompts, ordinary logs, status notes, or plaintext persistence. Where a provider uses containers, runner daemons may use the host Docker socket while task containers must not mount it; this Docker-socket allowance is provider-specific, not a universal runner assumption. Secrets are injected at runtime through environment variables or read-only files and must not be committed or baked into images.

### V. Verification And Documentation Before Delivery

Every non-trivial change needs evidence. Contract changes need focused tests. Broad changes need `pnpm typecheck` and relevant `pnpm test` coverage. Runner and delivery changes need runtime or integration evidence when practical. Documentation is part of delivery: feature specs, plans, tasks, module docs, tests, and runtime behavior must be reconciled before completion.

## Additional Constraints

- TypeScript and pnpm remain the default implementation stack.
- Open Agents is a source-authoritative baseline and reference architecture, not an assumed packaged SDK.
- Cloud services are provider implementations, not product architecture assumptions.
- GitHub and Linear are the enabled MVP Integrations: GitHub provides remote
  repositories and repository-scoped Issues; Linear provides read-only Issues.
- Platform-mediated GitHub repository discovery and RepoDeliveryProvider
  delivery MUST use the exact App or PAT connection bound by the Project.
  Feature 051's explicit self-use exception lets the Agent invoke host-local
  `gh` under that OS user's existing authentication; Mystra MUST NOT inject,
  reuse, proxy, verify, or fall back to the Project connection for this path.
  OAuth user tokens are verification-only and
  MUST not be persisted; installation access tokens are short-lived and MUST
  NOT appear in durable state, logs, public responses, or evidence. PAT
  plaintext and the KEK MUST remain behind `SecretProvider` and MUST NOT enter
  RDB, public responses, URLs, logs, or evidence. RDB may persist only the
  authenticated encryption envelope and wrapped per-secret DEK. App and PAT modes never silently fall
  back to each other.
- GitHub App capability MUST be derived from trusted server deployment policy,
  not from client input or the mere presence of App environment variables.
  Self-hosted App management, callback, token minting, discovery, and delivery
  entry points MUST fail closed. Hosted OAuth transactions MUST be one-time,
  time-bounded, and bound to an authenticated actor and exact Team.
- GitLab is not an enabled/default Integration or control-plane RepoProvider.
  Its existing runner-side RepoDeliveryProvider may remain as a replaceable
  delivery implementation.
- Every Project binds one IntegrationConnection plus a provider-stable remote repository external ID and a
  Mystra-owned configured `repositoryBaseBranch`. This is ordinary provider-neutral Project repository configuration,
  not a cached observation of the Provider's current default branch. Remote branch enumeration, symbolic `HEAD`
  inspection and exact branch resolution use standard Git protocol rather than Integration-specific RepoProvider
  methods. Other mutable repository metadata is not Project persistence; its retrieval/cache requires a separate
  specification.
  Task persists Mystra-owned title/description and immutable optional Project/exact Issue references, but no
  external Issue/Repository snapshot. Future Integration cache design owns current external information. Local
  paths and caller-supplied clone URLs are invalid Project inputs.
- Mystra remote MCP is the primary submission path for other agents and skills.
- Web API is the canonical management implementation; CLI and MCP are thin adapters over the same contracts.
- `mystra` is the Control Plane management CLI. `mystra-agent` is a separate
  workload-local adapter whose short-lived execution code addresses only the
  current attempt; it MUST NOT accept arbitrary Task IDs or expose external
  credentials.
- Web UI is a secondary client. Its demo shell exposes New, Search, Inbox, and
  Issues, followed by Projects and Team-scoped Tasks with latest-Session
  status icons. Existing Task, Session, Runner, and Project object routes remain
  directly reachable. `/automations` remains directly addressable as a Coming
  soon placeholder, is not a primary menu entry, and does not create a general
  automation catalog. Task assignment and productionStatus remain Task surfaces.
- Runner output may become a typed SessionEvent only after shared-schema
  validation, size limits and redaction. Team-authorized Session-scoped history
  is in scope; cross-Session/global activity timelines, arbitrary stdout/stderr
  storage and a general-purpose log API remain out of scope.
- Agent-authored PR URLs, commit identifiers, test commands and results are
  unverified status-note content in feature 051; they are never platform
  evidence merely because the Agent submitted them.
- Runner caches improve performance only and must never be treated as source-of-truth state.
- Optional Agent plugin/hooks may extend Agent behavior, but they must remain removable packages and cannot become required platform orchestration.

## Amendment Notes

- 2026-08-12: Feature 052 replaced mandatory Agent assignment with canonical
  Start plus optional Agent Context. Every Session receives the immutable,
  content-addressed Standard Execution Prompt; an explicitly selected active
  Team Agent contributes a transaction-frozen name/revision/system-prompt
  snapshot at lower priority. Omitted/null means no Agent, invalid explicit
  selection fails closed, and default/sentinel Agents or `/assign` aliases are
  prohibited. This directly supersedes the Agent-required portions of 046,
  049, and 051 under the pre-0.1 replacement policy.

- 2026-08-11: Named the feature 051 workload client `mystra-agent` and reserved
  `mystra` for Control Plane management. Added attempt-scoped execution-code
  context retrieval, host-local `linctl`/`gh` responsibility, no credential or
  delivery fallback, and the short Assign/Start transaction followed by
  asynchronous Workspace preparation and idempotent Session creation. This is
  an MVP boundary amendment because the original 051 clause exposed only Task
  status and platform delivery previously assumed RepoDeliveryProvider.

- 2026-08-11: Amended feature 051 to add the thin Task production state machine
  and a scoped Agent Task-status CLI. Task now owns pending, in_progress,
  blocked, waiting_for_review, done and canceled; Session state is independent,
  Harness owns no parallel lifecycle, and only Human actors may complete or
  cancel. Agent-reported PR/self-test notes are explicitly unverified. This
  supersedes 047's no-Task-lifecycle clause without copying or writing external
  Issue status. Generic Artifacts, verification, multi-Session orchestration,
  heartbeat/event subscriptions and Production Recipes remain deferred.

- 2026-08-11: Reframed Mystra's product direction as a flexible software factory. Task is the
  production order, Agent is the responsible producer, Harness identifies one
  production attempt, Session is one multi-turn execution conversation, and
  Workspace is the production directory/context surface. Feature 051 is the
  explicit exception to the former blanket exclusion of platform-owned
  orchestration, limited to Assign/Start and scoped Task status transitions.
  General WorkflowProvider, workflow DSL,
  arbitrary triggers, standing orders, configurable Production Recipes,
  triage/review automation and mandatory quality gates remain deferred.

- 2026-08-10: Features 048/049/050 were narrowed to Task-bound Session delivery.
  Feature 048 owns one Runtime-affine Task Workspace and a strict ready
  `task/shared-mutable` attachment resolver；it does not create Session、initial
  turn、Provider execution、Session events or summary/detail UI. Feature 049 owns
  the atomic launch transaction：create Session，resolve all inputs，compose the
  system prompt and first user message，then start the selected Provider，without
  an initial `turnId` compatibility layer. Feature 050 consumes the setup/read
  and launch projections. Project-only and standalone Sessions are deferred. The
  Workspace contract remains singular, so future preparation for the deferred
  Session modes may change how a Workspace is prepared but may not create a
  parallel type. Preparation claims/leases remain materialization fencing and
  MUST NOT be treated as Session Runtime capacity、slots or execution occupancy.

- 2026-08-10: Feature 049 admitted Team-authorized, Session-scoped typed event
  history as a narrow execution-truth surface. It also fixed launch as one RDB
  transaction for Session, frozen system prompt and first user message, with
  Runtime/Provider I/O after commit; rejected a Turn business object; limited
  the first slice to Task-bound Sessions using feature 048 Workspace; deferred
  Project-only/standalone preparation while requiring future variants to reuse
  the same Workspace contract; and deferred Runtime capacity limits to a future Runtime capability. Cross-Session activity feeds and
  arbitrary stdout/stderr persistence remain excluded.

- 2026-08-08: Feature 047 replaced the obsolete Project-required Task row with a
  Team-owned Agent context container. Task stores title/description and immutable
  `0..1` Project context plus `0..1` exact Issue references; an Issue reference
  requires its exact Project source, and one exact Issue maps to at most one
  Task. `/new` creates manual Tasks without an Issue picker. Project Issue rows
  create or open their Task without navigation or external write-back. Task
  mutation has no Session-launch behavior or requirements state machine.

- 2026-08-08: Confirmed Team as the tenant boundary. Agent, Task, Project, and
  Session are Team-scoped siblings; Agent and Task do not belong to Project,
  and Session belongs to neither Task nor Project. Session may independently
  reference `0..1` Project and `0..1` Task while resolving Runtime, Provider,
  Agent, and Context as four execution inputs. Agent contributes only its system
  prompt to execution effect. Project-owned Agent/Task models, Task-owned
  Sessions, `MYSTRA_DEFAULT_AGENT`, and Project Agent filters are obsolete
  pre-0.1 directions.

- 2026-08-07: Brought host Runtime enrollment into the MVP execution boundary.
  Runtime is now a first-class, replaceable execution backend that advertises
  its Provider capabilities source-agnostically, and a host-bound Runtime
  enrolled by the TypeScript `mystra-runner` — registration (endpoint-configured,
  no MVP pairing/credential exchange), Provider discovery plus availability
  confirmation, and heartbeat/status — is in scope. This amends the prior blanket
  statement that the MVP sandbox provider is single-machine Docker: Docker becomes
  one sandbox provider rather than the sole execution model, host worktree direct
  execution is the intended default direction, and the Docker-socket allowance is
  reframed as provider-specific. It also amends the 2026-08-06 note that deferred
  all Runtime/Runner persistence: Runtime plus its available-Provider capability
  persistence is now owned by feature 044. Task dispatch, Context/worktree
  management, Agent configuration, and execution/Session persistence remain
  deferred to follow-up specifications. `mystra-runner` remains TypeScript
  (reusing `apps/runner-daemon`); no parallel Go runner is introduced.

- 2026-08-07: Brought self-hosted single-node human authentication and Team RBAC
  into the MVP boundary. Self-hosted Mystra now provides username/password human
  authentication (no email) and Owner/Admin/Member Team RBAC, where registration
  grants every human User an initial Team they own, every User always belongs to
  at least one Team, and Team is the top-level tenant. This amends the prior
  blanket exclusion that treated all caller
  authentication and Team authorization as hosted-only prerequisites. Hosted
  multi-tenant caller identity federation, caller-login OAuth (SSO/social),
  managed platform secrets, hosted Team administration, and public
  multi-tenancy remain out of the open-source self-hosted scope. Feature 043
  owns the identity/Team/RBAC contract; its implementation still waits for the
  040 Prisma RDB integration to land on `main`.

- 2026-08-06: Replaced the node-local encrypted-file SecretProvider with an
  RdbProvider-backed envelope model. PAT plaintext remains confined to
  SecretProvider; each PAT uses a random DEK, the deployment KEK remains outside
  RDB, and connection reference changes share one database transaction with the
  envelope lifecycle. This permits PostgreSQL-backed self-hosted replicas without
  node affinity and preserves a future KMS wrapping seam.
- 2026-08-06: Limited the first Prisma persistence schema to
  IntegrationConnection, Project, and Task. Session, Runtime/Runner,
  ContextBundle, event, and artifact persistence require new specifications;
  mutable Issue and repository information belongs to a future Integration
  cache design rather than Project or Task snapshots.
- 2026-08-06: Expanded the approved RDB deployment boundary from local SQLite
  only to selectable SQLite, PostgreSQL, and Supabase-backed PostgreSQL. The
  amendment preserves `RdbProvider`, does not introduce public multi-tenancy,
  and requires provider-specific migration histories plus explicit runtime and
  migration connection configuration.
- 2026-08-06: Made the platform-operated Mystra GitHub App a hosted-only
  capability. Self-hosted Mystra supports PAT connections and may retain the
  hosted App implementation in source, but all App entry points fail closed by
  deployment policy. Hosted activation additionally requires caller identity,
  Team authorization, one-time server-side OAuth state, and platform-owned App
  secrets. Feature 041 owns the capability contract and phased architecture.
- 2026-08-06: Removed Automations from the primary menu while preserving
  `/automations` as a directly addressable Coming soon placeholder. This keeps
  unimplemented workflow orchestration out of the primary operator journey.
- 2026-08-06: Replaced the single-active-GitHub-App rule with multiple explicit
  GitHub App installation and PAT connections. Every Project binds one exact
  connection; GitHub App OAuth remains verification-only; PAT plaintext is a
  connection-scoped SecretProvider exception and never becomes RDB or Project
  state. Feature 041 owns migration from feature 039 without cross-connection
  fallback.
- 2026-08-05: Approved a narrow GitHub App installation connection exception
  for Project onboarding. OAuth is limited to installation-owner verification;
  repository discovery and Runner delivery share short-lived installation
  tokens without a personal-token fallback. Caller auth, webhooks, Issue
  write-back, and a general Integration management catalog remain excluded.
- 2026-08-05: Updated the 025 demo shell taxonomy to the then-approved
  Castrel-inspired menu and Project-grouped Task list. The 2026-08-08 Team-scope
  amendment supersedes that grouping because Task no longer belongs to Project;
  existing object routes remain reachable and platform-owned workflow
  automation remains excluded.
- 2026-08-03: Reconciled the durable MVP boundary with landed features 033,
  035, 036, and 037 and the remaining 025 UI work. Current intake uses GitHub
  and Linear Integrations, every Project repository is remote and
  provider-resolved, GitLab remains delivery-only, and the 025 shell is the
  sole unfinished MVP UI scope. Removed workflow/standing-order specs require
  no runtime migration because platform-owned orchestration is already absent.
- 2026-08-03: Replaced the former coupled execution model with Task intent,
  loose one-to-many child Sessions, and stable Runner identity. Compatibility
  aliases are intentionally absent; recognized local development schemas are
  rebuilt destructively. Public activity-timeline semantics remain undecided.
- 2026-07-23: Removed the WorkflowProvider/blueprint/node model from the product
  core. Mystra owns Issue intake, durable Task/Session state, sandbox allocation,
  direct Agent execution, repository delivery, and Review handoff.

## Development Workflow

Use 5xP files for durable project context and Spec-Kit for feature-level work.

1. Load `AGENTS.md` and the smallest relevant 5xP files.
2. Use `/speckit.specify` for non-trivial features or product/contract changes.
3. Use `/speckit.clarify` before planning when requirements are ambiguous.
4. Use `/speckit.plan` and `/speckit.tasks` before substantial implementation.
5. Implement in small slices and verify each slice.
6. Keep documentation, specs, tests, and runtime behavior aligned.
7. Add or update nearby submodule documentation when a change introduces new commands, configuration, contracts, or invariants.

## Governance

This constitution overrides casual prompt preferences when repository behavior is at stake. Amendments require a documented reason, a migration note for affected specs/templates, and verification that existing docs do not contradict the new rule.

**Version**: 2.13.0 | **Ratified**: 2026-05-09 | **Last Amended**: 2026-08-11
