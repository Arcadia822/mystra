# Data Model: Repository-Local LSP Collaboration

## Entities

### RepoLocalLspCommand

- **Purpose**: The repository-owned command surface that launches the TypeScript
  language server with local dependencies.
- **Fields**:
  - `name`: stable command name exposed from the repo root
  - `entrypoint`: underlying executable and startup mode
  - `scope`: TypeScript workspace symbol navigation
  - `prerequisite`: installed workspace dependencies
  - `failureMode`: loud command failure when dependency installation is missing

### NavigationDecision

- **Purpose**: The routing rule that maps a code-understanding task to the
  correct tool.
- **Fields**:
  - `questionShape`: symbol-local, graph-aware, or raw-text investigation
  - `preferredTool`: LSP, GitNexus, or direct search
  - `fallbackTool`: next tool when the preferred surface is unavailable
  - `notes`: limits or escalation guidance

### ToolCollaborationModel

- **Purpose**: The durable explanation of how LSP and GitNexus cooperate.
- **Fields**:
  - `lspRole`: definitions, references, diagnostics, rename preparation
  - `gitnexusRole`: impact analysis, process tracing, blast radius, review risk
  - `sharedRule`: use both when a local symbol question grows into a
    cross-package or cross-flow question

## Relationships

- **RepoLocalLspCommand** enables one or more **NavigationDecision** routes for
  TypeScript symbol-local work.
- **NavigationDecision** refers to one **ToolCollaborationModel** to determine
  whether LSP, GitNexus, or direct search is the correct primary tool.
