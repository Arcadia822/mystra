# Feature Specification: Product Surface Positioning

**Feature Branch**: `021-product-surface-positioning`  
**Created**: 2026-05-18  
**Status**: Implemented; final verification follow-up remains for baseline-constrained checks  
**Dependency Note**: This feature narrows 021 into a terminology-migration specification. It aligns durable wording across 5xP, historical specs, core object names, public contracts, and core function names, while explicitly removing page information architecture, current-page changes, and object-structure definition from this round. The current review decision is a direct hard cut for `Job* -> Task*` naming on current repository surfaces, with no compatibility window because the project is not yet launched.  
**Input**: User description: "将 specs/021-product-surface-positioning 收敛为全量术语迁移的 spec：移除页面能力内容；不做对象结构定义；覆盖 5xP、历史 specs、历史代码/public contracts/核心函数命名/核心对象命名中的术语迁移；当前 MVP intake 仍以纯文本 job submission 为准；区分需要统一替换的对外/核心命名与可机械迁移的内部命名，并评估迁移风险与批次。后续决定：项目未上线，`Job* -> Task*` 对当前仓库表面直接硬切，不做兼容层。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintainers Can Read One Canonical Migration Scope (Priority: P1)

As a documentation or contract maintainer, I want one authoritative specification for terminology migration scope, so that future updates stop drifting between 5xP, historical specs, core object names, and code-facing names.

**Why this priority**: The current repository already has contradictory wording across durable docs, the draft 021 spec, and exported code surfaces. Without a canonical migration scope, later edits will keep reintroducing the same conflict under different names.

**Independent Test**: Read this specification alone and verify that a reviewer can identify the included migration surfaces, the explicitly excluded surfaces, and the current terminology conflicts that justify the work.

**Acceptance Scenarios**:

1. **Given** a reviewer inspects the feature scope, **When** they read this spec, **Then** they can identify that 5xP, historical specs, core object names, public contracts, and core function names are in scope.
2. **Given** the reviewer inspects the exclusions, **When** they read this spec, **Then** they can identify that page IA, page capability inventory, current-page changes, and object-structure definition are explicitly out of scope for this round.

---

### User Story 2 - Contract Owners Can Separate Deliberate Renames From Mechanical Renames (Priority: P1)

As a maintainer of APIs, MCP tools, shared schemas, or cross-package core functions, I want terminology migration to distinguish outward or core names from internal implementation names, so that risky contract changes are planned deliberately while safe internal cleanup can be batched mechanically.

**Why this priority**: The repository currently exposes job-centric naming through shared schemas, API routes, MCP tools, CLI commands, and database/provider methods. Those surfaces cannot be renamed with the same strategy as local helper variables or file-internal symbols.

**Independent Test**: Review the naming classification rules and verify that a reviewer can place a sample name into either the outward/core bucket or the internal/mechanical bucket without guessing.

**Acceptance Scenarios**:

1. **Given** a reviewer sees exported names such as shared schema types, HTTP routes, MCP tool names, or provider interface methods, **When** they apply the classification rules, **Then** those names are treated as outward/core naming that needs explicit unified replacement planning.
2. **Given** a reviewer sees file-local helpers, private implementation variables, or test-only fixture names, **When** they apply the classification rules, **Then** those names are treated as internal/mechanical migration candidates unless they leak into a public or cross-package contract.

---

### User Story 3 - MVP Intake Semantics Stay Text-First During Terminology Migration (Priority: P1)

As a future agent or operator, I want terminology migration to preserve the current MVP intake assumption, so that naming cleanup does not accidentally introduce new intake requirements such as issue-id hydration.

**Why this priority**: Current naming conflicts are already broad. Expanding the feature into a different intake model would couple terminology cleanup to a product-boundary change and make the migration harder to reason about.

**Independent Test**: Read the migration requirements and confirm that the MVP intake path still assumes pure-text submission through the current job-submission flow, with issue-id-based intake deferred.

**Acceptance Scenarios**:

1. **Given** the reviewer inspects the MVP intake assumptions, **When** they read this spec, **Then** they see that current submission remains plain-text and attributable to the submitted request content.
2. **Given** the reviewer inspects future intake options, **When** they read this spec, **Then** they see that issue-id-based hydration is optional future work rather than a requirement for this feature.

---

### Edge Cases

- What happens when durable docs and exported code disagree in opposite directions, such as `workspace` meaning tenancy in 5xP while runtime surfaces also use `workspace` for execution context? The spec must classify the conflict and require one canonical replacement direction instead of treating both as acceptable.
- What happens when a public contract already mixes terms, such as `JobSpec` carrying `taskId`? The spec must treat mixed terminology as migration evidence and assign it to a risk-reviewed batch rather than normalizing it ad hoc.
- What happens when an internal name appears private at first but is consumed across package boundaries, tests, or tooling scripts? The classification rules must promote it into the outward/core bucket if callers depend on it.
- What happens when a future intake path wants issue-id hydration? The spec must allow that as later work without making it a prerequisite for the current text-first MVP submission path.
- What happens when a direct hard cut renames agent-facing or operator-facing names in one step? The spec must require a complete repository-wide rename and regression verification so the repo does not end up in mixed `Job*` / `Task*` semantics.
- What happens when draft wording, helper names, or tests lag behind the hard cut? The spec must treat leftover `Job*` naming on current repository surfaces as migration defects rather than deferred cleanup.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The specification MUST define the migration scope as terminology and naming alignment across durable project docs, specifically the 5xP files and other top-level public documentation that currently carry product terminology.
- **FR-002**: The specification MUST define the migration scope to include historical Spec-Kit artifacts whose wording still shapes product, contract, or workflow language for future work.
- **FR-003**: The specification MUST define the migration scope to include historical code surfaces that expose or centralize terminology, including core object names, shared public contracts, exported schema/type names, route names, MCP tool names, CLI command names, and core cross-module function names.
- **FR-003A**: The active migration scope MUST cover all current repository surfaces that still expose job-centric naming in docs, code, or contracts, and it MUST treat those surfaces as direct rename candidates in this feature.
- **FR-004**: The specification MUST explicitly classify page capability definitions, page inventory, page IA, current-page implementation changes, and object-structure or ownership-model definition as out of scope for this round.
- **FR-005**: The specification MUST explicitly state that this round does not freeze or redefine product object structure, parent-child ownership, or entity cardinality.
- **FR-005A**: The direct hard cut MUST rename current repository surfaces in one coordinated pass and MUST NOT rely on compatibility aliases, dual naming, or staged transport windows.
- **FR-006**: The specification MUST identify the current cross-surface conflict that durable docs still use `workspace` as a tenancy term, while runtime-facing wording and the prior 021 draft expect a separate runtime `workspace` meaning.
- **FR-007**: The specification MUST identify the current cross-surface conflict that durable docs and code are still job-centric, while the prior 021 draft introduced broader terminology changes such as `Task` without yet reconciling exported contracts and core function names.
- **FR-008**: The specification MUST distinguish outward/core naming from internal/mechanical naming using repository-applicable rules rather than ad hoc examples.
- **FR-009**: Outward/core naming MUST include at least core object names, exported shared schemas and types, public API and MCP names, CLI-facing names, persisted or operator-visible contract labels, and cross-module core function names such as provider methods that other packages or processes call directly.
- **FR-010**: Internal/mechanical naming MUST include only implementation-local names whose replacement can be performed mechanically once outward/core naming is settled, such as file-local helpers, private variables, and test-only fixtures that do not define a public or cross-package contract.
- **FR-011**: The specification MUST define migration batches and risk levels for the named surfaces, with a higher-risk batch for outward/core naming and a separate lower-risk mechanical batch for internal naming that does not leak contracts, while making the current decision explicit that outward/core names are hard-cut rather than compatibility-migrated.
- **FR-012**: The specification MUST record representative current evidence for the outward/core migration surface, including job-centric core object names, shared types or schemas, job-named API or MCP surfaces, and core provider methods that still use `Job` naming.
- **FR-013**: The specification MUST record representative current evidence for durable-document conflicts, including workspace-as-tenancy wording in 5xP and the broader object/page expansion in the prior 021 draft.
- **FR-014**: The specification MUST preserve the current MVP intake assumption that submission is text-first, while allowing the public/core naming of that path to move from `Job*` to `Task*` in one direct rename.
- **FR-015**: The specification MUST state that issue-id-based hydration or other non-text intake sources MAY be added later but MUST NOT be required for this terminology-migration feature.
- **FR-016**: The specification MUST require direct code, contract, and route renames on current repository surfaces as a later implementation task, and it MUST explicitly reject compatibility-shim design for this migration.
- **FR-017**: The resulting requirements MUST be specific enough that a later planning phase can derive migration order, blast-radius review targets, and verification commands without relying on issue comments or chat history.

### Key Entities *(include if feature involves data)*

- **Terminology Surface**: A repository surface whose wording shapes future behavior or understanding, such as a 5xP file, historical spec, core object name, shared contract, API/MCP name, CLI command, or core exported function name.
- **Outward/Core Naming**: A terminology surface that is public, persisted, operator-visible, cross-package, or otherwise depended on by callers and therefore requires deliberate migration planning.
- **Internal/Mechanical Naming**: A terminology surface that stays implementation-local and can be migrated mechanically only after outward/core names are settled.
- **Migration Batch**: A grouped set of terminology changes ordered by dependency and risk, used to separate contract-sensitive renames from lower-risk internal cleanup.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reviewer can read the spec and identify the included migration surfaces and explicit exclusions without consulting issue comments or prior chat history.
- **SC-002**: A reviewer can classify representative names such as `Job`, `JobSpec`, `/api/jobs`, `mystra_create_job`, `createJob`, and file-local helper names into the correct migration bucket using the rules in the spec.
- **SC-003**: The spec contains no remaining requirements for page capability inventory, page IA, or product object-structure definition.
- **SC-003A**: The spec requires a single direct-cut naming model on current repository surfaces, with no mixed `Job*` / `Task*` public naming left behind after implementation.
- **SC-004**: The spec records at least one high-risk outward/core migration batch and one lower-risk internal/mechanical batch, with the reason for the separation stated plainly.
- **SC-005**: The MVP intake assumptions in the spec remain text-first and do not require issue-id-based intake as a condition of this feature.
