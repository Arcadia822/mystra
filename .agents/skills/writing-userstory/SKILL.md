---
name: writing-userstory
description: Write and review user stories before PRDs or Spec-Kit specs. Use when shaping requirements, discussing feature intent, preparing PRDs, or converting vague ideas into actor-centered stories with acceptance criteria.
---

# Writing User Stories

Use this skill before writing PRD-like specs unless user stories are completely
unsuitable for the work. The goal is to help the owner react to actors,
situations, motivations, outcomes, and acceptance criteria before requirements
are frozen.

## Core Rule

Do not treat a PRD/spec as ready until the owner has reviewed the user stories,
or until you have recorded why technical scenarios are more appropriate.

User stories are not decorative. They are a compact test of whether the feature
has a real actor, a real motivation, and a useful outcome.

## Standard Format

Prefer this form:

```text
As a [actor/persona],
I want to [action/capability],
so that [outcome/benefit].
```

For Jobs-to-be-Done style discussion, use:

```text
When I [situation],
I want to [motivation],
so I can [expected outcome].
```

Add acceptance criteria in owner-readable terms:

```text
Given [initial state],
When [action],
Then [observable result].
```

## Workflow

1. Identify the real actors.
   - Examples: owner, operator, maintainer, future agent, reviewer, internal caller, provider implementer, end user.
   - Avoid fake personas. "System" is not an actor. "Developer" is acceptable only when the developer experience is the product surface.

2. Draft a small story set.
   - Keep it to 2-5 stories unless the owner asks for more.
   - Order by priority: P1 first useful slice, then P2/P3 follow-ons.
   - Each story should be independently testable.

3. Discuss before PRD/spec.
   - Present the stories before writing or finalizing a PRD-like spec.
   - Ask the owner to accept, reject, merge, split, or rewrite them.
   - If the owner is moving quickly, make the discussion short, not invisible.

4. Attach acceptance criteria.
   - Write 1-3 Given/When/Then scenarios for each story.
   - Acceptance criteria must be observable without reading the implementation.

5. Convert to requirements only after agreement.
   - Use accepted stories as the basis for Spec-Kit scenarios, requirements, and success criteria.
   - Preserve story language where it clarifies actor value.

## Quality Checklist

- [ ] Actor is concrete and relevant.
- [ ] The story says what the actor wants, not how the system is built.
- [ ] The outcome explains why the capability matters.
- [ ] The story is small enough to test independently.
- [ ] Acceptance criteria are observable.
- [ ] Edge cases and failure states are represented somewhere in the story set.
- [ ] The owner has reviewed the stories before they become requirements.

## When User Stories Do Not Fit

Use technical scenarios only when user stories would obscure the work, such as
low-level protocol compatibility, schema migration mechanics, or internal
algorithm changes with no meaningful actor-facing flow.

Even then, keep the same discipline:

```text
Scenario: [capability]
Actor: [specific operator/maintainer/caller]
Situation: [starting context]
Goal: [what must become true]
Validation: [how to prove it independently]
```

Record the rationale for skipping user stories before proceeding to PRD/spec.

## Common Failure Modes

- Writing "As a user" when the real actor is an operator or future agent.
- Writing implementation tasks as stories, such as "I want a database table".
- Hiding the outcome behind vague words like "better" or "easier".
- Creating one giant story that cannot be delivered or tested independently.
- Treating acceptance criteria as internal implementation notes.
- Writing the PRD first and inventing stories afterward. This produces very convincing archaeology.
