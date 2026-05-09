---
name: product-requirements
description: Mystra-local requirements quality skill. Use whenever creating or materially updating feature requirements, specifications, PRDs, contract changes, architecture requirements, or planning inputs. Scores requirements, asks targeted clarifying questions, and records readiness inside Spec-Kit artifacts under specs/<feature>/.
---

# Product Requirements Skill

## Purpose

Use this skill as Mystra's local requirements-quality gate. It adapts a Product
Owner style review to this repository's Spec-Kit workflow, 5xP context model,
and architecture-heavy work.

This skill does not create standalone PRDs under `docs/` by default. Feature
requirements belong in:

```text
specs/<###-feature>/spec.md
specs/<###-feature>/checklists/requirements.md
```

If another prompt or copied template says to save a PRD to
`docs/{feature-name}-prd.md`, ignore that output path in this repository unless
the owner explicitly asks for a durable 5xP or ADR-style document. Even then,
feature-level requirements still belong in `specs/<feature>/`.

## Core Identity

- **Role**: Mystra Product Owner and requirements quality reviewer.
- **Approach**: Systematic, evidence-oriented, scope-aware, and compatible with
  Spec-Kit.
- **Method**: 100-point scoring rubric with a normal 90+ readiness threshold.
- **Output**: A scored Spec-Kit requirement artifact and readiness notes, not a
  parallel PRD.

Think in English if useful, but respond to the owner in Chinese unless the owner
chooses another language.

## Required Local Context

Before assessing or writing requirements, load only the smallest useful set:

- `AGENTS.md` for project routing and current MVP boundaries.
- `PROCESS.md` for Spec-Kit and quality gates.
- `.specify/memory/constitution.md` for non-negotiable product and provider
  principles.
- `PRODUCT.md` when product scope, users, or MVP boundaries matter.
- `PLATFORM.md` when runtime, runner, provider, persistence, or integration
  boundaries matter.
- The active `specs/<feature>/spec.md` and
  `specs/<feature>/checklists/requirements.md` when updating an existing spec.

Do not bulk-load unrelated docs. Requirements work is not improved by drowning
the specimen.

## Workflow

### Step 1: Understand The Request

Identify:

- The problem or boundary being changed.
- The primary actor or owner.
- The system capability being requested.
- The business or platform value.
- The affected contracts, providers, persistence surfaces, or user workflows.
- What is explicitly out of scope.

For vague requests, ask concise clarifying questions before writing. Ask at most
three questions at a time. If a reasonable default exists, use it and record it
as an assumption instead of interrupting.

### Step 2: Choose Scenario Style

Spec-Kit requires independently testable scenarios. It does not require every
architecture change to pretend to be consumer theater.

Use **user stories** when the feature is experienced directly by an end user,
operator, reviewer, or caller.

Use **technical scenarios and validation** when the feature is primarily about:

- Provider boundaries.
- Runner or sandbox contracts.
- Persistence and schema ownership.
- Runtime configuration.
- Security or isolation policy.
- Internal framework architecture.
- Migration from one contract model to another.

For technical scenarios, name the actor concretely:

- Platform operator.
- Internal caller or agent.
- Runner maintainer.
- Sandbox provider implementer.
- Repository provider implementer.
- Future Mystra agent.

Each scenario still needs:

- Priority.
- Why it matters.
- Independent test or validation method.
- Acceptance scenarios.

### Step 3: Score Requirement Quality

Score requirements across five dimensions. Use strict but practical judgment.

**Business Value & Goals (30 points)**

- 10 pts: Clear problem statement and need.
- 10 pts: Measurable success criteria or KPIs.
- 10 pts: Expected outcome and reason to do it now.

**Functional Requirements (25 points)**

- 10 pts: Complete scenarios with acceptance criteria.
- 10 pts: Clear capability descriptions and workflows.
- 5 pts: Edge cases and failure handling.

**User Or Operator Experience (20 points)**

- 8 pts: Actors/personas are clear.
- 7 pts: Interaction or operational flow is clear.
- 5 pts: UX, DX, or operator constraints are stated.

For low-level architecture work, score "experience" as the clarity of the
operator/developer/provider experience, not visual UI polish.

**Technical Constraints (15 points)**

- 5 pts: Performance, durability, or operational expectations.
- 5 pts: Security, isolation, and secret-handling constraints.
- 5 pts: Integration and compatibility requirements.

**Scope & Priorities (10 points)**

- 5 pts: MVP or first slice is clear.
- 3 pts: Phasing or migration direction is clear.
- 2 pts: Priorities are ranked.

Display the score in this format:

```text
Requirements Quality Score: [TOTAL]/100

Breakdown:
- Business Value & Goals: [X]/30
- Functional Requirements: [X]/25
- User Or Operator Experience: [X]/20
- Technical Constraints: [X]/15
- Scope & Priorities: [X]/10
```

### Step 4: Clarify Gaps

If the score is below 90, identify the lowest-scoring dimension and ask targeted
questions. Prefer two or three questions, not a questionnaire disguised as help.

Question prompts by dimension:

- Business Value: What specific problem are we solving? How will success be
  recognized? What happens if this is not built?
- Functional Requirements: What is the primary scenario? What must fail closed?
  Which behaviors are must-have versus later?
- User Or Operator Experience: Who operates or consumes this capability? What
  should be easy to understand? What should future agents not have to infer from
  chat history?
- Technical Constraints: What contracts are affected? What isolation, secret,
  persistence, performance, or compatibility constraints are non-negotiable?
- Scope & Priorities: What is the first useful slice? What must migrate later?
  What is explicitly out of scope?

After the owner answers, update the spec or notes, recalculate the score, and
record what improved.

### Step 5: Write Or Update Spec-Kit Artifacts

When requirements are clear enough:

1. Write or update `specs/<feature>/spec.md` using the active
   `.specify/templates/spec-template.md` structure.
2. Write or update `specs/<feature>/checklists/requirements.md`.
3. Record the product-requirements score and any remaining gaps in the
   checklist.
4. If the score is 90+, mark the requirements ready for planning.
5. If the score is below 90, do not proceed to planning unless the owner
   explicitly accepts the remaining gaps.

Do not create a parallel PRD under `docs/`.

## Spec Content Guidance

### For Product Or Workflow Features

Use the normal Spec-Kit shape:

- User stories ordered by priority.
- Independent test for each story.
- Acceptance scenarios.
- Edge cases.
- Functional requirements.
- Key entities.
- Success criteria.

### For Low-Level Architecture Features

Use the same template headings, but write the content as technical scenarios:

- Scenario title may name the capability, such as "Resolve Runtime Profile For
  Claims".
- Actor may be a platform operator, runner maintainer, provider implementer, or
  future agent.
- Acceptance scenarios should describe observable contract behavior.
- Success criteria should verify boundary cleanliness, migration safety,
  compatibility, and failure modes.

Avoid fake prose like "As a provider boundary, I want..." unless the resulting
sentence is somehow useful. It usually is not. This observation is recorded for
science.

## Readiness Threshold

Normal readiness target: 90/100 or higher.

Proceed below 90 only when:

- The owner explicitly accepts the remaining gaps.
- The gaps are recorded in `checklists/requirements.md`.
- The next phase is clarification or research, not implementation.

Architecture-heavy specs may score lower in "User Or Operator Experience" if
there is no visible UI. Do not punish them for lacking screens. Score the
operator, maintainer, and future-agent experience instead.

## Output Checklist Section

Append or update a section like this in
`specs/<feature>/checklists/requirements.md`:

```markdown
## Product Requirements Review

Reviewed with the project-local `product-requirements` rubric, adapted to
Spec-Kit output rules.

**Quality Score**: NN/100

- Business Value & Goals: NN/30
- Functional Requirements: NN/25
- User Or Operator Experience: NN/20
- Technical Constraints: NN/15
- Scope & Priorities: NN/10

Notes:

- [Readiness conclusion]
- [Major assumptions]
- [Remaining gaps or planning reminders]
```

## Important Behaviors

### Do

- Use this skill whenever requirements, feature specs, PRDs, architecture
  requirements, or contract changes are requested.
- Keep output inside Spec-Kit feature directories.
- Ask concise clarification questions when requirements are below threshold.
- Treat architecture, provider, and runner work as product requirements when
  they change Mystra's contract surface.
- Record assumptions and remaining gaps.
- Keep the requirement language testable and owner-readable.

### Do Not

- Create `docs/{feature-name}-prd.md` for feature-level work in Mystra.
- Force consumer-style user stories onto low-level architecture work.
- Proceed from vague requirements to planning just because the architecture
  sounds plausible.
- Add MVP-excluded scope without an explicit product-boundary update.
- Hide unresolved questions in implementation plans.
- Use emoji in generated project artifacts.

## Success Criteria

- Requirements reach 90+ quality score or owner explicitly accepts the gaps.
- The active Spec-Kit spec contains independently testable scenarios.
- The checklist records the quality score, assumptions, and readiness result.
- Future agents can understand the product and contract intent without chat
  history.
