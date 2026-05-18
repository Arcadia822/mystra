# Contract: Repository-Local LSP Collaboration

## Command Surface

The repository exposes one stable TypeScript LSP startup command from the repo
root:

```text
pnpm lsp:typescript
```

The command contract is:

- starts the TypeScript language server via stdio
- uses repository-managed dependencies
- is intended for local symbol navigation rather than runtime execution

## Routing Contract

| Question shape | Primary tool | Why |
|---|---|---|
| Go to definition, find references, local diagnostics, rename preparation | LSP | These are symbol-local TypeScript questions |
| Execution flow, impacted callers, blast radius, review risk | GitNexus | These are graph-aware repository questions |
| Simple text lookup or non-TypeScript surface | `rg` / `view` | These do not require LSP or graph tooling |

## Collaboration Rule

LSP and GitNexus are complementary:

1. Start with LSP when the question is local to a TypeScript symbol or file.
2. Escalate to GitNexus when the question becomes cross-package, flow-aware, or
   impact-sensitive.
3. Do not replace required GitNexus impact analysis with LSP-only navigation.
