# Research: Project Issue Sources

## R1. Linear authentication

**Decision**: self-hosted connection sends a personal API key as raw `Authorization: <API_KEY>` to `https://api.linear.app/graphql`. OAuth Bearer semantics are not reused.

**Why**: Linear officially documents both API keys and OAuth, with different Authorization header formats. The owner selected API key for local deployment and deferred hosted OAuth.

**Source**: https://linear.app/developers/graphql

## R2. Linear Team as Issue scope

**Decision**: connection validation fetches viewer plus accessible Teams; Project persists exact Linear Team external ID. Issue listing applies a Team relationship filter, never a workspace-wide query.

**Why**: Linear filters support relationship filters, and Team is the owner-approved native scope. A key may see multiple Teams, so key identity alone is insufficient.

**Sources**:

- https://linear.app/developers/filtering
- https://linear.app/docs/teams

## R3. Cursor pagination and ordering

**Decision**: use Relay `first/after`, return opaque cursor, and request `orderBy: updatedAt`. Upstream cursor is wrapped with local scope identity before reaching the client.

**Why**: Linear documents cursor pagination and default page size 50; explicit page size and ordering make response behavior stable. Local wrapping prevents a cursor from one Project/source being replayed against another.

**Source**: https://linear.app/developers/pagination

## R4. GraphQL error handling

**Decision**: treat a non-empty GraphQL `errors` array as failure even with HTTP 200, and strictly validate `data`. Preserve existing timeout/401/403/429 mapping.

**Why**: Linear explicitly warns that GraphQL can partially succeed with HTTP 200. Silent partial lists would make scope and pagination unreliable.

**Source**: https://linear.app/developers/graphql

## R5. Rate limits

**Decision**: no eager Team/Issue background refresh and no hidden-provider fetch. UI requests only active provider pages and supports retryable rate-limit state.

**Why**: Linear applies request and complexity limits per authenticated user. Multiple keys for one user can still share quota, so connection count does not imply independent capacity.

**Source**: https://linear.app/developers/rate-limiting

## R6. Existing Mystra integration seams

**Decision**: reuse `IntegrationConnection`, SecretProvider transactions and provider failure mapping, but bypass the global env-configured Linear registry for Project-scoped requests.

**Why**: `defaultIntegrationRegistry` currently reads `LINEAR_API_KEY` and cannot express exact Team-owned connection selection. GitNexus marks it CRITICAL, with five direct API callers. Per-request Project resolution belongs in a new narrow service.

## Alternatives rejected

- Add `linearTeamId` directly to Project: rejected; it loses exact connection provenance and deletion protection.
- Persist GitHub as another ProjectIssueSource row: rejected; it duplicates existing repository binding and creates drift.
- One normalized Issue table response: rejected; it removes GitHub milestone/multiple assignees or Linear priority/cycle.
- Keep `LINEAR_API_KEY` fallback: rejected; it crosses Team/Project authorization boundaries.
- Use Linear Project as association: rejected by owner; MVP scope is Linear Team.
- Add a Mystra Issue detail API/page: rejected; not part of approved UI/product boundary.
