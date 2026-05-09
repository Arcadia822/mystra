# Mystra Product

## Purpose

Mystra is an internal bare-metal coding-agent platform for running multiple AI development tasks in isolated runner containers. It reuses the Open Agents project as the framework foundation and replaces cloud-first infrastructure providers with local-first providers for the initial implementation.

The first useful outcome is simple: an internal caller or remote MCP client can create a job for a GitLab or GitHub project, Mystra assigns it to a private runner on a high-capacity server, the runner executes Codex CLI or GitHub Copilot CLI in Docker, and the platform returns a reviewable branch plus merge request or pull request.

## Users

- Internal platform operators who provision and observe runners.
- Internal engineers or agents that submit coding tasks through HTTP or Mystra remote MCP.
- Reviewers who inspect the produced GitLab/GitHub branches and merge requests or pull requests.

Mystra is not a public multi-tenant product in the MVP.

## Product Boundaries

In scope for the MVP:

- Open Agents framework reuse.
- Next.js control plane.
- RdbProvider interface with SQLite implementation for local dev; interface designed for PG/Supabase compatibility (production target). Schema covers projects, jobs, runs, runner sessions, events, results, and artifacts.
- Dummy local workflow provider for the first lifecycle orchestration path.
- Pull-based private bare-metal runner daemon over outbound long polling.
- Docker task containers on the runner host.
- Project-owned runtime configuration for Docker image, context bundles, mounts, ports, caches, and secret references.
- Codex and GitHub Copilot agent execution.
- GitLab branch and merge request delivery.
- GitHub branch and pull request delivery.
- Remote MCP server entrypoint for other agents and skills to submit user journeys and implementation requests.
- Structured lifecycle events and final run results.
- Deterministic `test -> build` quality gate before branch/MR/PR delivery.

Explicitly out of scope for the MVP:

- Control-plane caller authentication.
- Logs API or log persistence.
- Retry API.
- Callback URLs.
- Quality-gate fix loops.
- Claude CLI adapter.
- Kubernetes sandbox workloads.
- Cross-runner shared caches.
- Per-repository secret management.
- Hosted RDB provider implementation (PG/Supabase SqliteRdbProvider is MVP; SupabaseRdbProvider is post-MVP, but the interface must not leak SQLite dialect).
- Cloud workflow provider as an MVP requirement.

## Success Measures

- A fake runner can complete the full queued-to-terminal lifecycle through the control plane.
- The local SQLite provider can persist and recover job/run state without cloud services.
- The RdbProvider interface does not leak SQLite-specific semantics; a future PG implementation is a new class, not a rewrite.
- The dummy workflow provider can drive the MVP lifecycle deterministically on one machine.
- A real runner on the provided high-capacity server can claim a job, run a container task, push a GitLab/GitHub branch, and create a merge request or pull request.
- Job/run state remains explainable from structured database records, without relying on transient container logs.
- Platform capabilities stay separate from per-job project configuration.
- Project runtime image configuration is explicit under `Project.runtime.image`; runner execution uses a resolved runtime contract.
- Other agents and skills can send work through Mystra remote MCP without needing direct runner or sandbox access.
- Documentation remains good enough for future agents to continue work from repository artifacts alone.

## Source Documents

- `README.md`
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/ADR-0004-open-agents-local-provider-boundary.md`
- `docs/RUNNER-ENVIRONMENT.md`
