# Research: Repository-Local LSP Collaboration

## Decision 1: Use `typescript-language-server` as the repo-local LSP bridge

- **Decision**: Add `typescript-language-server` as a dev dependency and expose
  it through a root workspace command.
- **Rationale**: The project's official README documents a thin LSP interface on
  top of TypeScript intelligence and shows `typescript-language-server --stdio`
  as the startup command. That fits Mystra's need for one repo-local,
  editor-agnostic LSP surface.
- **Sources**:
  - https://github.com/typescript-language-server/typescript-language-server
- **Alternatives considered**:
  - Document `tsserver` directly as the primary user-facing surface. Rejected
    because `tsserver` is not itself the standardized LSP bridge that agents and
    editors expect.
  - Depend on global installs only. Rejected because repository-local tooling is
    more reproducible and aligns with Mystra's durable-doc expectations.

## Decision 2: Keep TypeScript as the underlying intelligence engine

- **Decision**: Continue using the existing repository `typescript` dependency as
  the `tsserver` provider underneath the LSP bridge.
- **Rationale**: The official TypeScript package exports `tsserver` in its `bin`
  field, so the repo already carries the underlying TypeScript server surface.
  The feature only needs to add the LSP bridge.
- **Sources**:
  - https://github.com/microsoft/TypeScript/blob/main/package.json
- **Alternatives considered**:
  - Vendor or wrap a different TypeScript intelligence runtime. Rejected because
    the repo already depends on `typescript`, and this slice should stay small.

## Decision 3: Document LSP and GitNexus as collaborative layers

- **Decision**: Describe LSP as the first layer for local TypeScript symbol
  navigation and GitNexus as the required layer for graph-aware impact and
  execution-flow work.
- **Rationale**: Mystra already treats GitNexus as mandatory for impact
  analysis. LSP improves local navigation but does not replace process, caller,
  or blast-radius reasoning.
- **Alternatives considered**:
  - Present LSP as a universal replacement for repository intelligence.
    Rejected because that would conflict with existing GitNexus rules and
    overstate symbol-local tooling.
  - Leave the relationship implicit. Rejected because tool ambiguity is the
    primary risk of introducing LSP into the repo.
