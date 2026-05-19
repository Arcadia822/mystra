# Implementation Plan: Product Surface Positioning

**Branch**: `021-product-surface-positioning` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-product-surface-positioning/spec.md`

## Summary

Complete `021` as a documentation and terminology-alignment slice. The landed
scope is not a runtime or API redesign; it is a durable object-model cleanup so
future specs, docs, and UI planning stop conflating tenancy with execution
workspace semantics.

The closeout scope is:

1. Treat **Team** as the tenancy and ownership root.
2. Reserve **workspace** for the run-scoped working directory and execution
   context.
3. Keep the management surface hierarchy explicit: `API -> skill/MCP -> CLI -> UI`.
4. Restore the missing Spec-Kit planning/task artifacts so the completed feature
   is no longer tracked as partially undocumented.

## Technical Context

- **Language/Version**: Markdown documentation, TypeScript-adjacent repository conventions, Node.js 24 runtime assumptions
- **Primary Dependencies**: 5xP files, `specs/021-product-surface-positioning/spec.md`, `specs/025-webui/`, current management-surface docs
- **Storage**: Durable repository docs only; no runtime persistence change
- **Testing**: Terminology consistency review plus `spec-kit-status` / `spec-kit-doctor`
- **Constraints**: No API rename, no workflow/runtime rewrite, no UI implementation work in this slice

## Constitution Check

- **Specification Owns Product Boundaries**: PASS. This slice clarifies object ownership and terminology without expanding MVP scope.
- **Typed Contracts at Service Boundaries**: PASS. No service boundary changes land here.
- **Verification And Documentation Before Delivery**: PASS. Delivery is documentation-first and verified through Spec-Kit health/status plus terminology consistency across 5xP.

## Planned Touch Points

```text
PRODUCT.md
PLATFORM.md
PROCESS.md
AGENTS.md
docs/LOCAL-USAGE.md
specs/021-product-surface-positioning/
specs/025-webui/
```

## Implementation Order

1. Re-read `021` spec and keep the object/term boundaries explicit.
2. Correct 5xP tenancy wording so `workspace` is no longer used as the hosted tenancy term.
3. Preserve the management surface hierarchy in durable docs.
4. Restore `021` Spec-Kit `plan.md` and `tasks.md`, then refresh status/doctor output.

## Verification Checkpoints

| Check | Evidence |
|---|---|
| Tenancy wording corrected | `PRODUCT.md`, `PLATFORM.md`, `PROCESS.md`, `AGENTS.md` use `Team` for tenancy and `workspace` for execution context |
| Surface hierarchy preserved | durable docs still state `API -> skill/MCP -> CLI -> UI` |
| Feature artifacts restored | `specs/021-product-surface-positioning/plan.md` and `tasks.md` exist |
| Spec-Kit health updated | `spec-kit-status` and `spec-kit-doctor` reflect the restored artifacts |
