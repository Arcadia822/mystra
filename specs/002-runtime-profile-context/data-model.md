# Data Model: Runtime Config Resolution and Context Bundles

## ProjectRuntimeConfig

Project-owned structured default runtime configuration. The MVP stores one
default runtime per Project. Future versions may add Project-managed named
runtime profiles for work modes such as frontend development, backend
development, documentation-only work, and testing.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `provider` | enum | yes | MVP value: `docker`; future providers must fit this envelope |
| `image` | string | yes for Docker | Docker image selected by the Project operator |
| `contextBundleRefs` | array | yes | Ordered bundle references and access requirements |
| `mounts` | array | yes | Project-managed mount intent; resolved with system and runtime/image mounts |
| `exposedPorts` | array | yes | Preview ports or named port intents |
| `cache` | object | yes | Cache intents; caches remain performance aids |
| `secretRefs` | array | yes | Secret reference names and injection modes, never values |
| `overridePolicy` | object | yes | Which job-level runtime fields may be overridden |
| `metadata` | object | yes | JSON object, defaults to `{}` |

Validation:

- Docker provider requires a non-empty `image`.
- Secret refs must not contain secret values.
- Mount entries must reject host home and host container runtime socket.
- Override policy defaults to no image override unless explicitly allowed.
- First version exposes this as the Project default runtime, not as a runtime
  profile collection.

## RuntimeProfile

Future Project-managed named runtime configuration.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `name` | string | yes | Example: `default`, `frontend-dev`, `backend-dev`, `docs`, `test` |
| `runtime` | ProjectRuntimeConfig | yes | Runtime config for the named work mode |
| `metadata` | object | yes | JSON object, defaults to `{}` |

MVP note:

- Runtime profile management is not implemented in the first slice.
- The contract should preserve a future path where jobs select a profile before
  applying allowed job overrides.

## JobRuntimeOverride

Optional job-level runtime override accepted only when allowed by Project runtime policy.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `provider` | enum | no | May be omitted unless provider override is allowed |
| `runtimeProfile` | string | no | Future profile selector; MVP rejects or ignores unless explicitly supported |
| `image` | string | no | Docker image override if Project policy allows it |
| `contextBundleRefs` | array | no | Additional or replacement context bundle refs |
| `metadata` | object | yes | JSON object |

Validation:

- Overrides must be explicitly allowed by Project runtime policy.
- MVP override scope is limited to provider/image/context bundle references and
  metadata. Mounts, secrets, cache, and ports remain Project/runtime-managed
  until their management model is designed.
- Overrides are captured in the run's resolved runtime snapshot and must not mutate Project defaults.
- Invalid overrides reject the job or fail resolution before agent execution.

## ContextBundle

Named package of context that can be attached to a run.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | string UUID | yes | Internal identifier |
| `slug` | string | yes | Stable identifier |
| `displayName` | string | yes | Human-readable name |
| `source` | object | yes | Bundle source reference, not necessarily repo-owned content |
| `accessMode` | enum | yes | Example: `read-only`, `job-scoped` |
| `mountPath` | string | no | Logical target path when mounted |
| `freshness` | object | yes | Version or freshness expectation |
| `failureMode` | enum | yes | `fail-run` for required bundles; `warn` only for optional bundles |
| `metadata` | object | yes | JSON object |
| `archivedAt` | ISO string or null | no | Null means active |
| `createdAt` | ISO string | yes | Application generated |
| `updatedAt` | ISO string | yes | Application generated |

Validation:

- Required context bundles must resolve before agent execution.
- Bundle sources must not be treated as trusted instructions unless runtime config permits them.
- Missing required bundles fail the run clearly before agent start.

## ResolvedRuntimeContract

Run-specific snapshot returned to compatible runners.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `provider` | enum | yes | MVP value: `docker` |
| `environment` | object | yes | Provider-ready environment reference; Docker includes image |
| `contextBundles` | array | yes | Resolved context bundle contracts |
| `mounts` | array | yes | Provider-ready effective mounts after system, Project, and runtime/image mount inputs are merged |
| `exposedPorts` | array | yes | Provider-ready preview ports |
| `cache` | object | yes | Provider-ready cache instructions |
| `secrets` | array | yes | Secret references and injection modes |
| `limits` | object | no | CPU/memory/time hints when applicable |

Validation:

- Contract must be fully resolved before runner claim response is returned.
- Contract must be compatible with the claiming runner capabilities.
- Contract must not include secret values.
- Mount resolution must keep ownership visible enough to debug whether a mount
  came from Mystra system needs, Project configuration, or a runtime/image
  contract.

## Runner Capabilities

Runner-declared execution abilities used for claim matching.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `agents` | array | yes | Existing supported agent list |
| `executor` | enum | yes | Existing MVP values: `docker`, `fake` |
| `providers` | array | yes | Example: `docker` |
| `contextBundleModes` | array | yes | Supported context delivery modes |
| `mountKinds` | array | yes | Supported logical mount kinds |
| `portExposure` | object | yes | Supported preview port behavior |
| `secretInjectionModes` | array | yes | Supported secret reference injection modes |

## Relationships

```text
Project 1 ── 1 default ProjectRuntimeConfig
Project 1 ── * future RuntimeProfile
ProjectRuntimeConfig or RuntimeProfile + JobRuntimeOverride ── resolved into ── ResolvedRuntimeContract
ProjectRuntimeConfig * ── * ContextBundle
Job 1 ── * Run 1 ── 1 ResolvedRuntimeContract snapshot
RunnerSession capabilities ── matched against ── ResolvedRuntimeContract requirements
```

## First-Version Notes

- The Project table stores runtime configuration in `projects.runtime`.
- Docker image is required at `Project.runtime.image`.
- Top-level `Project.image` is not part of the first-version contract.
- The normal claim response exposes the executable image at `runtime.environment.image`.
- Full runtime profile management, mount management, and secret management are
  future management surfaces. MVP contracts should not block them, but MVP
  execution should first prove the Project default runtime path.
