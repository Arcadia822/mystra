# Quickstart: Repository-Local LSP Collaboration

## Prerequisites

- Run `pnpm install` from the repository root.
- Use the existing repo-local TypeScript workspace.

## Start the language server

```sh
pnpm lsp:typescript
```

Expected behavior:

- starts the repo-local TypeScript language server over stdio
- uses the workspace dependency graph instead of a global install
- provides the symbol-local surface for definitions, references, and
  diagnostics

## Decide which tool to use

Use **LSP** when you need:

- go-to-definition
- find-references
- rename preparation
- local diagnostics for TypeScript files

Use **GitNexus** when you need:

- impact analysis before editing symbols
- execution-flow understanding
- cross-package ownership or dependency reasoning
- graph-aware PR review

Use **`rg` / direct source reads** when:

- the question is outside TypeScript language scope
- the LSP is unavailable
- the answer is a simple text lookup rather than a symbol or graph question

## Minimal validation

```sh
pnpm lsp:typescript --help
pnpm typecheck
```
