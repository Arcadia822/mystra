# Tasks: Control-Plane Design System

**Input**: Design documents from `/specs/011-control-plane-design-system/`
**Prerequisites**: `plan.md`, `spec.md`

## Phase 1: Foundations

- [x] T001 Define Codex-inspired design goals and theme-system constraints in `specs/011-control-plane-design-system/spec.md`
- [x] T002 Define implementation scope and verification path in `specs/011-control-plane-design-system/plan.md`

## Phase 2: Theme System

- [x] T003 [US2] Define the config-driven theme model and token derivation in `apps/control-plane/app/theme-system.ts`
- [x] T004 [US2] Add runtime theme selection and persistence in `apps/control-plane/app/page.tsx`
- [x] T005 [US2] Replace one-off color usage with semantic tokens and theme variants in `apps/control-plane/app/globals.css`

## Phase 3: Layout Refresh

- [x] T006 [US1] Refresh the control-plane shell, rail, panel, and control styling in `apps/control-plane/app/globals.css`
- [x] T007 [US1] Add the theme-system UI affordance and updated workspace framing in `apps/control-plane/app/page.tsx`

## Phase 4: Verification

- [x] T008 [US1] Run `pnpm --filter @mystra/control-plane typecheck`
- [x] T009 [US1] Run `pnpm --filter @mystra/control-plane test`
- [x] T010 [US1] Run `pnpm --filter @mystra/control-plane build`

## Phase 5: Documentation Hardening

- [x] T011 [US3] Expand `specs/011-control-plane-design-system/spec.md` into a global Mystra design-system reference
- [x] T012 [US3] Expand `specs/011-control-plane-design-system/plan.md` with theme contract, token families, component boundary, and adoption rules
