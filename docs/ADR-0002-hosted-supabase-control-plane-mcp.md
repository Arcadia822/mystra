# ADR-0002: Control-Plane MCP Endpoint and Replaceable RDB

## Status

Accepted for MCP placement; RDB selection is governed by ADR-0004.

## Decision

Expose Mystra MCP from `apps/control-plane` over HTTP so MCP, REST, CLI, and Web
share the same `RdbProvider`, Zod contracts, and business logic. Do not add a
separate bridge.

Use local SQLite first. A hosted PG/Supabase adapter may be added later without
changing Task, Session, or Runner contracts.

Runner enrollment uses a shared registration secret. The control plane returns
a rotated Runner-specific bearer credential for heartbeat, Session claim,
internal-fact submission, and completion.

MCP exposes Task, Session, Runner, and health tools. Caller authentication,
public logs, retry tools, and public activity timelines remain excluded.

## Verification

1. REST and MCP create/read the same Task and Session records.
2. Runner enrollment and Session protocol use rotated credentials.
3. No separate MCP process or compatibility tool is required.
