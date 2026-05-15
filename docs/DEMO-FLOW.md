# Mystra Demo Flow

This document is the working script for a live Mystra demo.

It is intentionally scoped to the path that exists today:

- **local execution is real**
- **chat and Linear orchestration live outside Mystra**
- **Mystra is reached through skill + MCP**
- **repository result checks can stay outside Mystra for now**

The goal is not to imply that every future seam already has multiple implementations. The goal is to show one working path clearly, then show where the platform expands next.

Another important framing rule:

> Mystra should be presented as a **headless execution system** with a first-class single-node path today and a shared-nothing clustered direction later. The local demo is only one deployment shape, not the product boundary.

Also keep one important nuance explicit:

> Shared-nothing does **not** mean no execution state. Mystra still keeps durable truth for jobs, runs, and artifacts; the scaling goal is to minimize shared mutable hot-path state, not to forget what happened.

## Demo message

**Mystra is the execution and orchestration layer for coding agents.**

In the demo, an external agent coordinates the request, while Mystra owns:

- project-backed execution
- workflow orchestration
- sandboxed runtime configuration
- structured run state
- repository delivery artifacts
- a headless control-plane and runner model that can later scale into a shared-nothing clustered deployment

If you need one architecture sentence for narration:

> Mystra is a headless control plane with pull-based runners, closer to Jenkins, Salt, or Nomad than to a pure file-driven local tool.

Short version:

> The chat agent coordinates. Mystra executes. The repository proves the result.

## Scope for this demo

### In scope

- group chat issue intake
- external agent creates a Linear issue
- external agent submits a Mystra job through skill + MCP
- Mystra runs the local workflow
- Mystra exposes run state and result snapshots
- external agent reports progress back to the group
- repository output or PR link is shown at the end

### Explicitly out of scope

- native chat integration inside Mystra
- native Linear integration inside Mystra
- Mystra-owned review approval logic
- non-local provider implementations

Those can be mentioned as future seams, but should not be presented as already delivered product behavior.

## Cast

| Role | Responsibility in the demo |
| --- | --- |
| User in group chat | Reports the issue and `@` mentions the agent |
| External agent | Creates the Linear issue, calls Mystra through MCP, polls status, posts updates |
| Linear | Holds the planning/issue record |
| Mystra | Accepts the task, resolves the project/runtime/workflow path, runs execution, stores state, returns structured results |
| Repository host | Shows the final code artifact, branch, or PR |

## Recommended live flow

### 1. Open in the group chat

Start with a short user message that looks real rather than staged.

Example:

> `@agent` the project creation form still accepts an invalid runtime config. Please file it, fix it, and send me the PR when it is ready.

What the audience should understand:

- work starts from a natural collaboration surface
- the coordinating agent is not Mystra itself
- Mystra is the execution backend the agent chooses to use

### 2. Let the external agent create the Linear issue

Show the agent turning the chat request into a structured issue.

The important beat is not the Linear UI itself. The important beat is:

- the request is normalized
- ownership becomes explicit
- the issue now has a durable tracking record

Suggested narration:

> The coordinating agent takes the chat request, writes the issue, and then hands execution to Mystra.

### 3. Submit the Mystra job through skill + MCP

Show the agent calling Mystra instead of pretending the work happens magically.

The MCP submission should make it obvious that Mystra is receiving:

- the target project
- the task prompt
- the branch/task identifier
- the repository destination

Suggested narration:

> The agent is still coordinating, but Mystra now owns execution. This is where project policy, runtime config, and workflow selection start to matter.

### 4. Switch to the Mystra control plane

This is the main product shot.

Show the parts that prove Mystra is doing real work:

- active runner/session presence
- selected project
- runtime image
- context bundles attached to the project
- run state transitions
- workflow provider / blueprint / node progress
- result summary and output link

The audience should leave this step with one clear model:

> Mystra is not a chat toy. It is a control plane with state, workflow, and runtime boundaries.

If useful, add one short sentence here:

> This UI is just an observation surface. The system itself is headless and should keep the same contracts in single-node and clustered forms.

### 5. Let the external agent post milestone updates

Do not overdo the number of updates. Four milestones are enough:

1. issue created
2. Mystra job submitted
3. workflow running / artifact created
4. result ready with repository link

This keeps the story readable and makes the polling model feel intentional rather than noisy.

### 6. End on the repository artifact

Finish with the concrete output:

- branch name
- PR or MR URL if available
- short result summary

If review status is still handled by the external agent, say so plainly.

Suggested narration:

> Mystra produced the execution result and repository artifact. Review status can still be checked by the coordinating agent outside Mystra.

## Final product tour

Do not compress this into five seconds. Treat it as a short second act.

Recommended length: **20 to 40 seconds**.

The goal is to show the platform surface after the story lands:

- agent providers
- sandbox providers
- context bundles
- workflow provider and orchestration
- headless shared-nothing architecture direction

This section should be framed as:

> Here is the working local path, and here are the extension seams around it.

### 0. Headless architecture framing

Before walking the provider lists, give one explicit architectural frame:

| Property | Status | Notes |
| --- | --- | --- |
| Headless control plane | Available now | HTTP and MCP are the primary product surfaces |
| Pull-based runner model | Available now | Execution does not depend on an interactive shell |
| Single-node deployment | Available now | Current proof path |
| Durable run state | Available now | Jobs, runs, and artifacts remain explainable beyond transient memory |
| Shared-nothing clustered deployment | Coming soon | Same contracts across independently scalable control-plane and worker capacity |
| Broader cloud-native realization | Coming soon | Operational packaging on top of the same headless contracts |

Narration:

> Mystra should behave like infrastructure. The local demo proves the contracts, and the long-term direction is a shared-nothing clustered system built from the same headless control-plane and runner boundaries.

Add this if someone asks about state:

> Headless does not mean UI-free and forgetful. Shared-nothing does not mean no database. It means the hot path should avoid unnecessary shared mutable coordination, while run truth stays durable.

## Suggested UI sequence for the final tour

### 1. Agent providers

Show a small list or table.

| Option | Status | Notes |
| --- | --- | --- |
| Codex | Available now | Current implemented adapter |
| Copilot | Available now | Current implemented adapter |
| Claude | Coming soon | Example future adapter |
| OpenHands-style agent | Coming soon | Example future adapter |
| Custom MCP-backed agent | Coming soon | Example future adapter |

Narration:

> Today the local path supports the current adapters. The interface boundary is broader than the currently shipped list.

### 2. Sandbox providers

| Option | Status | Notes |
| --- | --- | --- |
| Docker sandbox | Available now | Current local runtime path |
| Podman sandbox | Coming soon | Common local alternative |
| Firecracker / microVM sandbox | Coming soon | Stronger isolation option |
| Remote VM sandbox | Coming soon | Hosted or pooled execution direction |
| Kubernetes-backed sandbox | Coming soon | Future multi-node execution option |

Narration:

> The demo uses the local Docker path. Other runtime shapes are future provider work, not hidden functionality.

### 3. Context bundles

This view should answer one question:

> What extra operating context does a project bring into the run?

Show a list that mixes real project context with future examples.

| Context bundle | Status | Notes |
| --- | --- | --- |
| Repo instructions / `AGENTS.md` | Available now | Mounted project context |
| Skill pack | Available now | Mounted task guidance |
| Project notes / runbook | Available now | Shared operator context |
| Language or framework template | Coming soon | Common reusable bundle |
| Security policy bundle | Coming soon | Compliance-oriented bundle |
| Team playbook bundle | Coming soon | Organization-specific context |

Narration:

> Context is a first-class project surface. The point is not only the model choice; it is also what guidance and constraints enter the run.

### 4. Workflow provider and orchestration

This is the most important panel in the final tour.

Show:

- workflow provider
- blueprint name and version
- node timeline or node list
- deterministic vs agentic steps if available

Suggested status table:

| Workflow option | Status | Notes |
| --- | --- | --- |
| Mystra local workflow provider | Available now | Current implementation path |
| Additional workflow providers | Coming soon | Alternate orchestration backends |
| Project-specific workflow variants | Coming soon | Per-project workflow shaping |
| Approval or review gates | Coming soon | Human checkpoints or policy nodes |
| Retry or repair loops | Coming soon | Future automation path |

Narration:

> The product is not one fixed script. The durable thing is the workflow execution boundary and the visibility around it.

## Speaker notes

### What to emphasize

- Mystra is the execution backend, not the chat frontend
- the local path is real today
- the local UI is an observation surface, not the product boundary
- the architecture is intended to stay headless, with single-node first and shared-nothing clustering later
- shared-nothing is about scaling boundaries, not eliminating durable run truth
- workflow, runtime, repository, and context are separate surfaces
- the demo shows a working path first, then extension seams second

### What not to imply

- do not imply native multi-provider support is already shipped everywhere
- do not imply Mystra owns chat or Linear orchestration today
- do not imply review approval is part of the current Mystra core
- do not say "agent-neutral" or "sandbox-neutral" as if the implementation matrix already exists
- do not imply the control-plane UI is required for Mystra to function

Safer phrasing:

- "implemented locally today"
- "provider seam exists"
- "coming soon"
- "future adapter"
- "future workflow variant"

## Practical prep checklist

Before recording or presenting:

1. confirm the local control plane and runner are both up
2. confirm the target demo project already exists
3. confirm the project runtime image and context bundles are visible
4. confirm one known-good prompt can produce a repository artifact
5. confirm the external agent can submit the job and poll status through MCP
6. confirm the result view shows the link or artifact you want to end on

## One-line ending

Use a short closing sentence after the final product tour:

> Mystra already runs the local execution path end to end. What comes next is expanding the provider matrix around the same platform seams.
