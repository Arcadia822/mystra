# ADR-0001: Public Control Plane With Private Pull-Based Runners

## Status

Superseded by ADR-0004 for provider boundary. The pull-based runner and Docker isolation parts remain relevant.

## Context

`mystra` needs to execute coding-agent jobs on private bare-metal infrastructure without exposing the runner host to the public internet. The supplied plan used `10.106.2.127` as the concrete host, but the implementation should treat the runner as a configurable single-host target.

Vercel Open Agents is a useful reference because it separates web UI, durable agent workflow, and sandbox VM. The important part to preserve is lifecycle separation: the sandbox is execution infrastructure, not the control plane.

Stripe Minions-style practice suggests deterministic workflow nodes around agentic coding loops: clone, test, build, branch push, merge request or pull request creation, and final status should be controlled by code rather than left entirely to prompts. The MVP includes a single deterministic `test -> build` gate before push/MR/PR creation, but defers automatic fix loops after gate failure.

## Decision

Use a control plane backed by the configured `RdbProvider` as the source of truth and private runner daemons that register, heartbeat, pull jobs, append structured events, and publish results over outbound connections.

ADR-0004 and ADR-0005 change the first provider choices to local SQLite for RDB state and a Mystra-owned local workflow implementation for orchestration, while treating Open Agents as a source-authoritative baseline rather than an assumed packaged SDK. Vercel Workflow and hosted databases are future provider implementations, not MVP requirements.

Use Docker runner containers on a configurable single runner host for the first implementation. The runner protocol starts with outbound long polling. The MVP code-host integrations are GitLab and GitHub using runtime-injected user tokens, and the first supported agent adapters are Codex CLI and GitHub Copilot. Claude CLI is not part of the MVP adapter surface. Mystra exposes its own Streamable HTTP MCP endpoint from the control-plane app for job control. Stronger sandbox providers, including Kubernetes sandbox workloads, remain future replacements behind a runner/runtime interface.

The runner daemon owns local prewarm caches: repo mirror/worktree seeds keyed by repo and base branch, plus pnpm store and uv caches. These caches are performance hints only. Task containers may receive controlled cache mounts, but they must not mount the host home directory or Docker socket.

The MVP intentionally does not provide control-plane caller auth, logs API, retry API, callback URL, or quality-gate fix loops. It does include a single deterministic `test -> build` quality gate before branch push and MR/PR creation. Branch naming, MR/PR title, and MR/PR body remain task/repository responsibilities.

## Consequences

Positive:

- No inbound public networking is required on private runner hosts.
- The configured runner host can change without modifying MCP/API or repository-provider integrations.
- The control plane can provide idempotency, auditability, cancellation, structured events, and status APIs.
- Workflow providers can be replaced later without rewriting runner protocol or job state.

Negative:

- Long-poll runner protocol must be implemented and operated.
- Control-plane availability becomes critical for dispatch and log ingestion.
- Docker isolation is acceptable for internal MVP but not sufficient for untrusted public multi-tenant workloads.
- The task container receives GitLab/GitHub authority in MVP, which is a deliberate trusted-infrastructure tradeoff.
- Lack of persisted logs and quality-gate fix loops makes early debugging and MR quality more dependent on retained container workspaces, structured events, and final results.

## Verification

The decision is validated when an integration test can:

1. Create a job through the control plane.
2. Register a fake runner.
3. Claim the job through outbound runner polling.
4. Append structured events back to the control plane.
5. Complete, cancel, or timeout the run with the expected persisted state.
