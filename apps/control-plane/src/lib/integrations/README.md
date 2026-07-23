# Integrations

Integrations expose named capabilities. The first capability is
`IssueProvider`; Linear is its first implementation.

## Invariants

- Linear access is read-only: list and get use the native GraphQL API.
- Provider-specific payloads are normalized into shared Issue contracts.
- Provider errors are mapped to stable public codes without leaking credentials.
- Pagination cursors remain opaque.
- Dispatch always refetches the selected issue, stores an immutable snapshot,
  and uses a unique dispatch key to prevent duplicate jobs.
- The MVP Issue dispatch contract accepts Copilot only because its direct
  execution handoff is explicitly bounded autopilot. The Docker runner advertises
  only this implemented direct-execution capability when claiming jobs.
- The HTTP API is the canonical implementation. The operator CLI only calls
  those routes and does not import provider or persistence code.
- Environment variables are read by the control plane only; values are never
  included in API responses, events, evidence, or logs.
