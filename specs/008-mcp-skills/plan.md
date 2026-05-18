# Implementation Plan: MCP Companion Skills

**Branch**: `008-mcp-skills` | **Date**: 2026-05-15 | **Spec**: `/specs/008-mcp-skills/spec.md`
**Input**: Feature specification from `/specs/008-mcp-skills/spec.md`

**Note**: This plan now reflects the implemented first slice: repo-local companion skills under `.agents/skills/` that wrap `mystra_create_task` and `mystra_get_task`, plus quickstart/discovery documentation for the local skill-pack layout used by this repository.

## Summary

Provide installable companion skills that wrap Mystra MCP task submission and task status flows so agents can work at the level of user journeys and implementation requests instead of raw MCP payloads. The implemented slice keeps the wrappers repo-local, stores blueprint hints in task metadata rather than inventing a new MCP field, and documents the skill-pack discovery path in `quickstart.md`.

## Technical Context

**Language/Version**: Markdown/skill metadata plus TypeScript-backed Mystra MCP surfaces  
**Primary Dependencies**: Mystra remote MCP contracts, repo-local skill packaging under `.agents/skills/`, shared schemas from `packages/shared`  
**Storage**: N/A for the skill wrappers themselves; they call existing Mystra APIs/MCP tools  
**Testing**: Manual invocation plus any MCP route tests already present in the control plane  
**Target Platform**: Agent skill environments (Copilot, Codex, Claude-style integrations)  
**Project Type**: Integration/skill package feature  
**Performance Goals**: Fast validation and clear failure messages; no hidden retries or hanging MCP calls  
**Constraints**: Stay inside existing Mystra MCP tool contracts and MVP boundaries  
**Scale/Scope**: A small skill set plus discovery/installation metadata

## Constitution Check

- Must reuse Mystra-owned MCP contracts rather than inventing parallel APIs.
- Must keep skill inputs explicit and validated at the boundary.
- Should remain documentation and wrapper oriented unless the underlying MCP contract changes.

## Project Structure

### Documentation (this feature)

```text
specs/008-mcp-skills/
├── plan.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
.agents/skills/
├── mystra-submit-user-journey/
├── mystra-submit-implementation-request/
└── mystra-check-task-status/

apps/control-plane/app/api/mcp/
packages/shared/src/
```

**Structure Decision**: Keep skill manifests/wrappers repo-local and build on top of the existing MCP route and shared schemas. Do not widen the MCP contract for this slice; when workflow blueprint context is useful, carry it in `metadata.workflow` plus the generated prompt text.

## Complexity Tracking

No justified exceptions yet. Refresh if implementation requires new packaging, publishing, or contract surfaces.
