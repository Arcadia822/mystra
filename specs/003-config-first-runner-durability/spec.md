# Feature Specification: Config-First Headless Runner Durability

**Feature Branch**: `003-config-first-runner-durability`
**Created**: 2026-05-10
**Status**: Implemented; closure verified
**Input**: User-approved direction: "Keep runner durability simple and config-first, closer to headless VictoriaMetrics-style components than a complete scheduler. Runner behavior should come from local configuration; the control plane should store desired and observed state; cancellation and timeout cleanup should be runner-local; stale runners should be explainable from durable state without a central capacity scheduler."

## User Scenarios & Testing *(mandatory)*

This is platform reliability work, but the first slice is intentionally small.
The scenarios are written as technical scenarios because fake consumer stories
would obscure the real actors: runner operators, runner maintainers, internal
callers, and future Mystra agents.

### Technical Scenario 1 - Runner Runs From Local Config (Priority: P1)

A runner operator can start a headless runner whose concurrency, polling,
execution timeout, cancellation check interval, cleanup timeout, and eligible
work scope are declared in local runner configuration.

**Why this priority**: Mystra does not need a central scheduler to understand
every slot in the MVP. It needs a runner that can declare what it is willing to
do and then do only that.

**Independent Test**: Start a runner with a local config that allows one project
and two concurrent Docker tasks, submit eligible and ineligible work, and verify
the runner only claims eligible work up to its configured local concurrency.

**Acceptance Scenarios**:

1. **Given** a runner config declares `concurrency = 2`, **When** multiple eligible runs are queued, **Then** the runner claims at most two active runs at a time.
2. **Given** a runner config limits eligible project ids or runtime providers, **When** work outside that scope is queued, **Then** the runner does not claim it.
3. **Given** a runner config declares poll and watchdog intervals, **When** the runner starts, **Then** those local settings govern polling, cancellation checks, timeout checks, and cleanup timing.

---

### Technical Scenario 2 - Control Plane Stores Desired And Observed State (Priority: P1)

The control plane records durable job/run desired state and runner observations,
without becoming a complex live scheduler.

**Why this priority**: The control plane should be the fact store. It should not
pretend to be an omniscient brain coordinating every container heartbeat. That
would be ambitious. Ambition has a failure rate.

**Independent Test**: Submit, claim, cancel, complete, timeout, and stale-mark
runs while restarting runner or control-plane processes; verify state remains
explainable from durable records.

**Acceptance Scenarios**:

1. **Given** an internal caller requests cancellation, **When** the request is accepted, **Then** the desired state records that cancellation has been requested.
2. **Given** a runner observes a run transition, **When** it reports claimed, running, cleanup, cancelled, timed out, failed, or completed, **Then** the control plane records the observation durably.
3. **Given** a control-plane restart occurs, **When** state is inspected after restart, **Then** queued, claimed, running, cancelled, timed-out, completed, failed, and stale states remain explainable without runner process memory.

---

### Technical Scenario 3 - Runner Owns Local Timeout And Cleanup (Priority: P1)

The runner handles timeout, cancellation detection, container stop, and cleanup
locally according to its config, then reports the observed outcome to the
control plane.

**Why this priority**: Cleanup is closest to the process that started the
container. A central scheduler issuing precise cleanup orders would be a
beautiful source of disappointment.

**Independent Test**: Run a task that exceeds timeout and another task cancelled
during execution; verify the runner stops the local container, performs cleanup,
and reports a durable outcome.

**Acceptance Scenarios**:

1. **Given** a running task exceeds the configured execution timeout, **When** the runner watchdog evaluates it, **Then** the runner stops execution, performs cleanup, and reports a timed-out outcome.
2. **Given** cancellation is requested for a running task, **When** the runner's cancellation check observes it, **Then** the runner stops execution, performs cleanup, and reports a cancelled outcome.
3. **Given** cleanup exceeds the configured cleanup timeout, **When** the runner reports the outcome, **Then** the control plane records an operator-readable cleanup failure or failed terminal state.

---

### Technical Scenario 4 - Stale Runner State Is Marked, Not Magically Rescheduled (Priority: P2)

The control plane can mark runs associated with non-reporting runners as stale
or orphaned based on durable timestamps and runner config, without introducing
automatic retry or rebalance behavior in the MVP.

**Why this priority**: The MVP needs honest state, not heroic state. If a runner
dies, marking affected work as stale is enough for the first durability slice.

**Independent Test**: Let a runner claim a run and then stop reporting; verify
the control plane marks the runner/run stale after the configured window and
does not automatically create a retry or assign the run elsewhere.

**Acceptance Scenarios**:

1. **Given** a runner has not reported within its stale window, **When** stale evaluation runs, **Then** the runner is marked stale.
2. **Given** a stale runner had active runs, **When** those runs are inspected, **Then** they are marked stale or failed with a durable reason.
3. **Given** stale work exists, **When** operators inspect state, **Then** they can see that automatic retry/rebalance is not part of this MVP slice.

### Edge Cases

- Runner config changes while the runner has active work.
- Runner stops after claiming work but before reporting `running`.
- Control plane restarts while cancellation is requested but not observed by the runner.
- Runner restarts after local cleanup but before reporting the outcome.
- A task ignores normal termination during cancellation or timeout cleanup.
- A stale runner later reports an old success, failure, cancellation, or timeout.
- Multiple runners are configured for overlapping project scopes.
- A run is eligible by project id but not by runtime provider.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Runner behavior MUST be driven by local runner configuration for concurrency, polling interval, execution timeout, cancellation check interval, cleanup timeout, eligible project scope, and eligible runtime providers.
- **FR-002**: Runner configuration MUST be readable at runner startup without requiring a central scheduler or hosted runner-management service.
- **FR-003**: The control plane MUST persist job/run desired state, including cancellation requests.
- **FR-004**: The control plane MUST persist runner observations such as claimed, running, cleanup started, cancelled, timed out, failed, completed, and stale.
- **FR-005**: Runner local concurrency MUST prevent a runner from claiming more active work than its configured capacity.
- **FR-006**: Runner claiming MUST respect locally configured eligibility constraints such as project id and runtime provider.
- **FR-007**: Timeout handling MUST be performed by the runner local watchdog according to runner configuration.
- **FR-008**: Cancellation cleanup MUST be performed by the runner after observing durable desired state from the control plane.
- **FR-009**: Runner cleanup MUST stop task execution and report a durable outcome for cancelled and timed-out work.
- **FR-010**: The control plane MUST mark inactive runner sessions and their active runs as stale or failed from durable timestamps and configured stale windows.
- **FR-011**: The MVP MUST NOT introduce a central capacity scheduler, queue priority system, cross-runner rebalance, public retry API, logs API, callback URLs, Kubernetes-style controller, or cross-runner shared cache.
- **FR-012**: Stale runner reports MUST NOT silently overwrite newer terminal or stale outcomes.
- **FR-013**: Operator-visible state MUST distinguish queued, claimed, running, cancellation requested, cleanup in progress, cancelled, timed out, stale, failed, and completed outcomes where those states occur.
- **FR-014**: Documentation MUST define the boundary between runner-local config, control-plane durable state, runner-local cleanup, and explicit MVP non-goals.

### Key Entities

- **Runner Config**: Local configuration file or equivalent startup input that
  declares runner id, local concurrency, poll interval, stale window,
  cancellation check interval, cleanup timeout, execution timeout, and
  eligibility scope.
- **Desired Run State**: Control-plane-owned durable state describing what should
  happen to a run, including cancellation requested.
- **Runner Observation**: Runner-reported durable event or state transition
  describing what the runner observed or did locally.
- **Local Watchdog**: Runner-local loop that checks timeout and cancellation
  conditions and initiates cleanup.
- **Stale Runner**: Runner session that has stopped reporting within the
  configured stale window.
- **Stale Run**: Active run formerly associated with a stale runner, marked for
  operator visibility rather than automatically retried in the MVP.

### Assumptions

- The first implementation targets single-machine Docker runners.
- Runner config is operator-managed local configuration, not a hosted runner
  fleet management product.
- The control plane remains the durable fact store for job/run state.
- Local runner concurrency is sufficient for the MVP; global scheduling,
  priorities, and rebalance are explicitly deferred.
- Automatic retry of stale work remains out of scope. Stale state should be
  visible and explainable first.
- This design borrows the operational shape of headless, configuration-driven
  service components, not VictoriaMetrics storage semantics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A runner configured with concurrency `N` never has more than `N` active claimed/running tasks.
- **SC-002**: Eligible work is claimable by a runner configured for its project/runtime scope; ineligible work is not claimed by that runner.
- **SC-003**: A cancelled running task is cleaned up by the runner and reaches a durable cancelled or failed outcome.
- **SC-004**: A timed-out running task is cleaned up by the runner and reaches a durable timed-out or failed outcome.
- **SC-005**: A non-reporting runner and its active work become stale or failed after the configured stale window without automatic retry or rebalance.
- **SC-006**: After process restart, run state remains explainable from durable control-plane records and runner observations.
