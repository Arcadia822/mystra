# ADR-0001: Public Control Plane With Private Pull-Based Runners

## Status

Accepted for network topology and isolation; provider details are governed by
ADR-0004 and business objects by `specs/038-task-session-model/`.

## Decision

Use a control plane backed by `RdbProvider` and private Runner daemons that
enroll, heartbeat, claim Sessions, submit internal execution facts, and publish
terminal Session results over outbound connections.

Runner is a stable business object. Enrollment uses a shared registration
secret and rotates a Runner-specific credential. The first sandbox
implementation uses Docker on a configurable single host. Sandbox containers do
not mount the host Docker socket or host home.

The core lifecycle is direct and deterministic around the Agent: clone, Agent,
test, build, preview, branch delivery, and review creation. Automatic repair
loops remain excluded.

## Consequences

- Private Runner hosts require no inbound public networking.
- Control-plane availability is required for dispatch and claim.
- SQLite and Docker suit the private MVP, not untrusted public multi-tenancy.
- Cancellation, health, capacity, and review evidence remain durable without a
  public logs API.

## Verification

1. Create Task and Session through a canonical management surface.
2. Enroll a stable Runner and claim the Session.
3. Complete, cancel, or timeout the Session with expected durable state.
4. Confirm Runner capacity is released transactionally.
