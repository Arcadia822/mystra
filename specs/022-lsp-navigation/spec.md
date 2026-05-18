# Feature Specification: Repository-Local LSP Collaboration

**Feature Branch**: `022-lsp-navigation`  
**Created**: 2026-05-18  
**Status**: Draft  
**Dependency Note**: This feature adds a repository-local symbol-navigation surface for the TypeScript monorepo and clarifies how that surface collaborates with GitNexus instead of replacing it.  
**Input**: User description: "为这个项目增加 lsp 并在 agents.md 和 /spec-kit-workflow 里说明如何使用。 lsp 和 gitnexus 应该是协作关系"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Starts A Repo-Local Symbol Navigation Surface (Priority: P1)

As an agent or maintainer working inside the Mystra repository, I want one
repository-local command that starts the project's language server, so that I
can inspect definitions, references, and diagnostics without depending on an
editor-specific setup.

**Why this priority**: Without a shared startup surface, every agent session
falls back to grep-only navigation or ad hoc local tooling, which makes symbol
navigation inconsistent and hard to explain.

**Independent Test**: From the repository root, start the documented LSP
command and verify that it launches successfully against the local workspace and
can be treated as the symbol-local navigation surface for the repo.

**Acceptance Scenarios**:

1. **Given** a contributor is at the repository root with dependencies
   installed, **When** they run the documented repo-local LSP command,
   **Then** the project starts a TypeScript language-server process using the
   repository's own toolchain.
2. **Given** the repository contains multiple TypeScript packages and apps,
   **When** the repo-local LSP command is used, **Then** it targets the
   workspace source tree rather than one editor-specific project file.

---

### User Story 2 - Agent Chooses LSP And GitNexus By Task Shape (Priority: P1)

As an agent navigating Mystra code, I want durable guidance on when to use LSP
and when to use GitNexus, so that symbol-local navigation and graph-level
impact analysis reinforce each other instead of competing.

**Why this priority**: The repo already treats GitNexus as mandatory for impact
and flow analysis. Adding LSP without routing guidance would create tool
confusion rather than better code understanding.

**Independent Test**: Read the updated workflow guidance and verify that an
agent can distinguish symbol-local tasks from cross-flow or blast-radius tasks
without asking for more explanation.

**Acceptance Scenarios**:

1. **Given** an agent needs go-to-definition, find-references, rename safety for
   a local TypeScript surface, **When** it reads the routing guidance,
   **Then** the guidance points it to the repo-local LSP as the first symbol
   navigation layer.
2. **Given** an agent needs execution-flow understanding, process discovery, or
   blast-radius analysis, **When** it reads the same guidance, **Then** it is
   directed to GitNexus rather than told to substitute LSP for graph-aware
   tooling.

---

### User Story 3 - Maintainer Can Discover And Recover The Tooling Surface (Priority: P2)

As a maintainer or future agent, I want the repository docs to explain how to
start, validate, and fall back from the LSP surface, so that the tool remains
usable even when the language server is unavailable or insufficient for a task.

**Why this priority**: Tooling that exists only as an undocumented dependency is
fragile. The repo needs a durable explanation of startup, prerequisites, and
fallback behavior.

**Independent Test**: Follow the quickstart and docs only, then verify that a
maintainer can start the language server and knows when to fall back to
GitNexus, `rg`, or direct file reads.

**Acceptance Scenarios**:

1. **Given** the language server is not installed yet, **When** the maintainer
   reads the setup guidance, **Then** the docs explain how the repo-local
   dependency is obtained and which command starts it.
2. **Given** the language server cannot answer a cross-package ownership or
   process question, **When** the maintainer reads the collaboration guidance,
   **Then** the docs direct them to GitNexus or direct file analysis instead of
   implying the LSP is sufficient for all investigation work.

---

### Edge Cases

- What happens when dependencies have not been installed yet? The documented
  LSP startup path should fail loudly and point maintainers toward repository
  installation rather than silently hiding the missing tool.
- What happens when a file or question falls outside TypeScript symbol
  navigation? The workflow guidance should direct agents to GitNexus, `rg`, or
  direct source inspection instead of overstating LSP coverage.
- What happens when GitNexus data is stale but local symbol navigation still
  works? The guidance should allow LSP for immediate local navigation while
  still requiring GitNexus refresh for graph-aware impact work.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a repo-local command that launches the
  TypeScript language server from the repository root.
- **FR-002**: The repo-local LSP startup path MUST use repository-managed
  dependencies rather than assuming a globally installed language server.
- **FR-003**: The repository documentation MUST describe the LSP surface as a
  symbol-local navigation tool for definitions, references, diagnostics, and
  other file- or symbol-scoped questions.
- **FR-004**: `AGENTS.md` MUST explain that LSP and GitNexus are collaborative
  tools with distinct jobs rather than substitutes.
- **FR-005**: The `spec-kit-workflow` skill guidance MUST explain when planning
  and implementation work should use LSP first, GitNexus first, or both
  together.
- **FR-006**: The guidance MUST preserve GitNexus as the required tool for
  graph-aware impact analysis, execution-flow exploration, and other
  blast-radius questions that exceed local symbol navigation.
- **FR-007**: The guidance MUST tell agents to prefer repo-local LSP for
  TypeScript go-to-definition, find-references, rename preparation, and
  workspace diagnostics before falling back to text search.
- **FR-008**: The repository docs MUST describe fallback behavior when the LSP
  is unavailable, insufficient, or outside its language scope.
- **FR-009**: The feature MUST stay within the existing MVP boundary and MUST
  NOT add hosted services, runtime-side execution changes, or replacement
  repository intelligence for GitNexus.

### Key Entities *(include if feature involves data)*

- **Repo-Local LSP Command**: The repository-owned startup surface that launches
  the TypeScript language server with workspace-local dependencies.
- **Navigation Decision**: The documented rule set that tells an agent whether a
  task is best served by LSP, GitNexus, or direct file inspection.
- **Tool Collaboration Model**: The durable explanation that LSP answers
  symbol-local questions while GitNexus answers graph-, process-, and
  blast-radius questions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor can start the repo-local language server from the
  repository root with one documented command.
- **SC-002**: `AGENTS.md` and `spec-kit-workflow` give non-conflicting guidance
  about when to use LSP, GitNexus, or both together.
- **SC-003**: A reviewer can read the updated guidance and correctly classify at
  least these task shapes without extra explanation: symbol-local navigation,
  diagnostics, execution-flow analysis, and impact analysis.
- **SC-004**: The feature lands without changing Mystra runtime contracts,
  persistence, or product-surface MVP scope.
