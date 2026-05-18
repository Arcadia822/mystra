# Implementation Plan: Repository-Local LSP Collaboration

**Branch**: `022-lsp-navigation` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-lsp-navigation/spec.md`

## Summary

Add a repository-local TypeScript language-server entrypoint and document a
clear collaboration model where LSP handles symbol-local navigation while
GitNexus remains the graph-aware tool for execution-flow and impact work. The
implementation should stay scoped to repository tooling and durable workflow
guidance, with no Mystra runtime or product-contract changes.

## Technical Context

**Language/Version**: TypeScript 5.9 with Node.js 24 runtime assumptions  
**Primary Dependencies**: existing `typescript`, new `typescript-language-server`,
pnpm workspace scripts, AGENTS.md, local Spec-Kit workflow skill  
**Storage**: N/A  
**Testing**: `pnpm install`, `pnpm typecheck`  
**Target Platform**: Local agent and maintainer sessions running from the
repository root  
**Project Type**: TypeScript pnpm monorepo with durable 5xP docs and Spec-Kit
workflow artifacts  
**Performance Goals**: Start the language server from the repository root
without introducing extra workspace bootstrap steps beyond normal dependency
installation  
**Constraints**: Preserve GitNexus as the required tool for impact analysis;
keep implementation to repository-local tooling and documentation; avoid
editor-specific committed settings; prefer one command surface that works in CLI
and agent sessions  
**Scale/Scope**: One repo-local LSP dependency, one startup command, one feature
spec directory, and aligned routing guidance in AGENTS plus the local
`spec-kit-workflow` skill, with directly related platform docs updated as needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Specification Owns Product Boundaries**: PASS. The feature changes
  repository tooling and workflow guidance only; it does not add out-of-scope
  product or runtime behavior.
- **Typed Contracts at Service Boundaries**: PASS. No API, MCP, runner, or
  persistence contract is widened.
- **Providers Are Replaceable Boundaries**: PASS. The plan does not alter
  provider seams or hardcode runtime behavior.
- **Runner Isolation and Secret Hygiene**: PASS. No secrets, container changes,
  or runner execution paths are introduced.
- **Verification And Documentation Before Delivery**: PASS. Delivery includes
  Spec-Kit artifacts, durable docs, dependency installation, and focused
  verification through repo commands.

## Project Structure

### Documentation (this feature)

```text
specs/022-lsp-navigation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── lsp-collaboration.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
pnpm-lock.yaml
README.md
PLATFORM.md
AGENTS.md
.agents/skills/spec-kit-workflow/SKILL.md
```

**Structure Decision**: Keep the implementation in root tooling and durable
workflow docs. The only code-like change is the repository startup command and
dependency declaration in `package.json`; the rest of the work belongs in 5xP
and feature-local Spec-Kit artifacts.

## Complexity Tracking

No constitution violations require justification.

## Phase 0 Research Summary

Detailed decisions live in [research.md](./research.md).

Key conclusions:

1. The official `typescript-language-server` project documents `--stdio` as the
   required startup mode, making it suitable for a repo-local language-server
   command.
2. The TypeScript package itself ships `tsserver`, so the repo can continue to
   rely on its existing `typescript` dependency while adding the LSP bridge as a
   dev dependency.
3. Mystra should document LSP as the first stop for symbol-local TypeScript
   navigation, while GitNexus remains the required tool for graph-aware impact
   and execution-flow questions.

## Phase 1 Design Summary

Generated artifacts:

- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/lsp-collaboration.md](./contracts/lsp-collaboration.md)

The first implementation slice for 022 should be:

1. Add `typescript-language-server` as a repository dev dependency and expose a
   root command that runs it with `--stdio`.
2. Update durable docs so `AGENTS.md` and `spec-kit-workflow` describe LSP and
   GitNexus as complementary layers with non-overlapping strengths.
3. Update directly related repository docs so maintainers can discover the new
   command and understand its prerequisites and fallback behavior.

### Collaboration Diagram

```text
TypeScript symbol question
  -> repo-local LSP
     -> definition / references / diagnostics / rename prep

Cross-package flow or blast-radius question
  -> GitNexus
     -> process map / impact / ownership / review risk

Unstructured or non-TypeScript question
  -> rg / view / direct source inspection
```

## Code Evidence

- Root `package.json` already includes `typescript`, so the feature only needs
  the LSP bridge dependency and a repo-local startup command.
- The repository currently has no committed LSP startup surface or LSP routing
  guidance in durable docs.
- `AGENTS.md` and the local `spec-kit-workflow` skill already define GitNexus as
  the graph-aware code-intelligence layer, making them the correct places to add
  collaboration guidance rather than replacement wording.

## Implementation Order

1. Add the repo-local LSP dependency and startup command.
2. Document the collaboration model in `AGENTS.md` and
   `.agents/skills/spec-kit-workflow/SKILL.md`.
3. Reconcile directly related platform docs (`PLATFORM.md`, `README.md`) so the
   startup command is discoverable outside the feature artifact.
4. Run dependency installation and focused verification.

## Verification Plan

| Surface | Evidence |
|---|---|
| Repo-local LSP startup | `pnpm install` followed by `pnpm lsp:typescript --help` |
| Workspace type safety after dependency change | `pnpm typecheck` |
| Durable workflow guidance | Source inspection of `AGENTS.md`, `PLATFORM.md`, `README.md`, and `.agents/skills/spec-kit-workflow/SKILL.md` against the spec |

## Risks And Mitigations

- **Risk**: LSP wording could imply GitNexus is optional for impact work.  
  **Mitigation**: Keep GitNexus's required impact-analysis role explicit in
  AGENTS and workflow guidance.
- **Risk**: The repo could accidentally commit editor-specific settings.  
  **Mitigation**: Use a repo-local CLI command instead of IDE config.
- **Risk**: The LSP feature could grow into multi-language tooling work.  
  **Mitigation**: Scope this slice to the TypeScript monorepo only.
