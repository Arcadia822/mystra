# Implementation Plan: Control Plane UI Optimization

**Branch**: `006-control-plane-ui` | **Date**: 2026-05-15 | **Spec**: `/specs/006-control-plane-ui/spec.md`
**Input**: Feature specification from `/specs/006-control-plane-ui/spec.md`

**Note**: Retroactive placeholder plan created after `spec-kit-doctor` identified a missing artifact. This captures the intended scope in current Spec Kit format but should be refreshed before implementation resumes.

## Summary

Improve the control plane dashboard so operators can see platform health, inspect task details, submit tasks, and discover MCP/skill integration information from the UI without dropping to raw APIs.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 24 assumptions  
**Primary Dependencies**: Next.js 16, React 19, Zod 4, existing Mystra shared contracts  
**Storage**: SQLite through the control-plane `RdbProvider` abstraction  
**Testing**: Vitest 4 plus existing control-plane route and UI validation coverage  
**Target Platform**: Browser UI served from `apps/control-plane`  
**Project Type**: Web application  
**Performance Goals**: Dashboard remains readable and responsive while polling live runner/task state  
**Constraints**: Must preserve current MVP boundaries and existing control-plane APIs  
**Scale/Scope**: Single-page operator dashboard plus supporting panels/forms in `apps/control-plane/app/`

## Constitution Check

- Stays within MVP boundaries by improving existing operator surfaces rather than adding caller auth or hosted multi-tenant behavior.
- Reuses existing control-plane APIs and shared schemas instead of creating parallel contracts.
- Needs refreshed planning against any newer design-system work before implementation starts.

## Project Structure

### Documentation (this feature)

```text
specs/006-control-plane-ui/
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/control-plane/app/
├── page.tsx
├── globals.css
├── layout.tsx
└── api/

packages/shared/src/
```

**Structure Decision**: Keep the work scoped to `apps/control-plane/app/` UI surfaces and the shared contracts they already consume.

## Complexity Tracking

No constitution exceptions currently justified. Refresh this section if the feature is revived with broader architectural changes.
