---
name: agent-skills
description: Use this skill for the entire software development lifecycle inside a Mystra task container.
---

# Agent Skills

Use this skill for the entire research and development workflow, not only for final review.

This file is the bundled Mystra agent-skills entrypoint. The full skill directories are mounted directly under:

```text
/mystra/skills
```

Agents must use the relevant bundled skill files throughout the task lifecycle, including definition, planning, implementation, verification, review, and shipping.

## Required Lifecycle

1. Understand the request and repository context before editing.
2. Read `/mystra/skills/using-agent-skills/SKILL.md` and select the phase skill that applies.
3. Inspect existing code, scripts, tests, and local conventions.
4. Make the smallest coherent implementation that satisfies the task.
5. Run the relevant verification commands available in the repository.
6. Preserve useful diagnostics for failures instead of hiding them.
7. Summarize changed behavior, verification, and any remaining risks.

## Bundled Skill Group

The image includes the whole directory for each lifecycle skill directly under `/mystra/skills`, not only its `SKILL.md`:

- `using-agent-skills`
- `idea-refine`
- `spec-driven-development`
- `planning-and-task-breakdown`
- `context-engineering`
- `source-driven-development`
- `incremental-implementation`
- `test-driven-development`
- `debugging-and-error-recovery`
- `frontend-ui-engineering`
- `api-and-interface-design`
- `browser-testing-with-devtools`
- `code-review-and-quality`
- `security-and-hardening`
- `performance-optimization`
- `git-workflow-and-versioning`
- `ci-cd-and-automation`
- `documentation-and-adrs`
- `shipping-and-launch`

## Operating Rules

- Prefer existing project patterns over new abstractions.
- Keep deterministic work in scripts and code instead of relying on prompt memory.
- Do not write secrets into source, commits, logs, merge requests, or summaries.
- Do not create broad refactors unless they are necessary for the requested change.
- Treat failing tests, build errors, and quality-gate output as first-class task input.

## Mystra Contract

Mystra will run a deterministic `test -> build` quality gate after the agent finishes.
This skill does not implement a fix loop. If the gate fails, the current run stops and the
retained workspace contains `/mystra/workspace/quality-gate.log` for a later repair loop.
