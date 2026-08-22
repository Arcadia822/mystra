# Feedback Iteration

## Source Precedence

1. Mystra product boundaries and stored UX meta-language.
2. Explicit current user correction.
3. Named source implementation, active Spec-Kit artifacts, and verified browser evidence.
4. Existing shipped UI as drift evidence.
5. Vague taste notes.

## Classification

- **One-off:** one screen or temporary experiment; keep local.
- **Local pattern:** reusable within a component/page family; store with its boundary.
- **Meta-language:** improves repeatable Mystra decisions across the product; store globally.
- **Conflict:** contradicts an existing rule; record the winner, scope, reason, and superseded guidance.

## Iteration Loop

1. Restate the issue as a reusable pattern question.
2. Map it to the smallest reference file.
3. Verify the named source and current Mystra implementation.
4. Pressure-test expanded/collapsed shell, desktop/mobile, loading/empty/full/error/disabled states, keyboard use, localization, and dark-tech token meaning.
5. Update only stable rules and record boundaries.
6. Validate the skill and apply the rule to a real current surface.

One shipped screen does not silently override the system. One explicit user correction can, provided the conflict is recorded rather than cosmetically erased.

## Current Baseline Decision

- **Scope:** global Mystra layout design and shared component geometry.
- **Winner:** the owner correction recorded on 2026-08-17: 300px sidebar, 8px page padding and section gaps, 44px Section Header/Footer rows, 28px default rows and inline forms, 12px body/small-heading/annotation/medium-heading text, 16px icons, 24px large titles, 4px grouped inline gaps, and 8px ungrouped inline gaps.
- **Superseded guidance:** 16/12/12/32px page-frame insets, 12px primary layout gaps, 10–11px metadata/annotations, 14px compact headings, 12px generic modal/content insets, 28px Section chrome, and 20px inline forms.
- **Retained exceptions:** 24px compact controls, 32px actions, 36px stacked fields, and 24/16px reading-body insets remain valid only when an owning component/page-family role explicitly names them.
- **Reason:** the prior rules mixed several historical density systems and produced silent geometric drift across prototypes and production surfaces.
