# Mystra Submit User Journey Specification

## Intent

Package a concrete user journey as Task intent and one executable child Session.

## Scope

- In scope: actor, goal, acceptance criteria, optional context, Task + Session.
- Out of scope: requirements discovery, Issue write-back, retry orchestration.

## Trigger Context

- Trigger for a complete user journey intended for Mystra execution.
- Do not trigger when acceptance criteria are absent or for status checks.

## Runtime Contract

- Require Project, branch, actor, goal, and non-empty acceptance criteria.
- Create Task first, then create Session with the returned Task ID.
- Stop explicitly on validation, transport, or Task-creation failure.

## Validation

- Pass Agent Skills structural validation.
- Keep example payloads aligned with current MCP route tests.

## Maintenance

Update when user-journey inputs or Task/Session MCP contracts change.
