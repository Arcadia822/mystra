# Runtime Contract Checklist

**Feature**: [Runtime Config Resolution and Context Bundles](../spec.md)

## First-Version Contract

- [x] Do not keep a top-level `Project.image` compatibility field.
- [x] Require `Project.runtime.image` for Docker Projects.
- [x] Persist Project runtime config as structured runtime JSON.
- [x] Persist `Run.resolvedRuntime` so runner claims use a stable snapshot.
- [x] Return resolved runtime from runner claim responses.
- [x] Update runner daemon to consume `runtime.environment.image`.
- [x] Remove remaining plan/spec language that implies legacy image migration.
- [x] Document that MVP implements one Project default runtime while reserving future named runtime profiles.
- [x] Validate Project runtime and task runtime override explicitly at HTTP API and MCP boundaries.
- [x] Keep task runtime override constrained to MVP-allowed fields; mounts, secrets, cache, and ports require a later management model.
- [x] Resolve effective mounts from system-managed, Project-managed, and runtime/image-declared inputs without treating Castrel-specific mounts as universal system mounts.
- [x] Replace hard-coded runner prompt/context sections with resolved context bundle rendering.
- [x] Provide minimal context bundle creation/listing through HTTP API and MCP without expanding into full operator CRUD.

## Verification

- [x] Shared schemas require Project runtime config.
- [x] Control-plane DB tests cover Project runtime create/update/read.
- [x] Runner claim route tests assert `runtime.environment.image`.
- [x] Runner daemon tests assert Docker image selection does not read `project.image`.
- [x] API/MCP route tests reject top-level `image`, malformed runtime config, and MVP-forbidden override fields.
- [x] Mount ownership tests prove Project/runtime mounts do not replace true system execution mounts.
