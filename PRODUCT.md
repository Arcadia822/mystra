# Mystra Product

## Purpose

Mystra is an internal bare-metal coding-agent platform for running multiple AI development tasks in isolated runner containers. It reuses the Open Agents project as the framework foundation and replaces cloud-first infrastructure providers with local-first providers for the initial implementation.

The first useful outcome is simple: an internal caller can create a job, Mystra assigns it to a private runner, the runner executes Codex CLI or GitHub Copilot CLI in Docker, and the platform returns a reviewable GitLab branch and merge request.

## Users

- Internal platform operators who provision and observe runners.
- Internal engineers or agents that submit coding tasks through HTTP or MCP.
- Reviewers who inspect the produced GitLab branches and merge requests.

Mystra is not a public multi-tenant product in the MVP.

## Product Boundaries

In scope for the MVP:

- Open Agents framework reuse.
- Next.js control plane.
- Local SQLite as the first RDB provider for jobs, runs, runner sessions, events, results, and artifacts.
- Dummy local workflow provider for the first lifecycle orchestration path.
- Pull-based private bare-metal runner daemon over outbound long polling.
- Docker task containers on the runner host.
- Codex and GitHub Copilot agent execution.
- GitLab branch and merge request delivery.
- Structured lifecycle events and final run results.
- Deterministic `test -> build` quality gate before branch/MR delivery.

Explicitly out of scope for the MVP:

- Control-plane caller authentication.
- Logs API or log persistence.
- Retry API.
- Callback URLs.
- Quality-gate fix loops.
- Claude CLI adapter.
- GitHub repository support.
- Kubernetes sandbox workloads.
- Cross-runner shared caches.
- Per-repository secret management.
- Hosted RDB provider as an MVP requirement.
- Cloud workflow provider as an MVP requirement.

## Success Measures

- A fake runner can complete the full queued-to-terminal lifecycle through the control plane.
- The local SQLite provider can persist and recover job/run state without cloud services.
- The dummy workflow provider can drive the MVP lifecycle deterministically on one machine.
- A real runner on `10.106.2.127` can claim a job, run a container task, push a GitLab branch, and create a merge request.
- Job/run state remains explainable from structured database records, without relying on transient container logs.
- Platform capabilities stay separate from per-job project configuration.

## Source Documents

- `README.md`
- `docs/SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION-PLAN.md`
- `docs/ADR-0004-open-agents-local-provider-boundary.md`
- `docs/RUNNER-ENVIRONMENT.md`
