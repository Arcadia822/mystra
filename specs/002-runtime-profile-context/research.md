# Research: Runtime Config Resolution and Context Bundles

## Decision: Project Runtime Config May Own Docker Image

**Rationale**: A Project is the durable configuration owner for repository work. If an operator creates a Project and specifies a Docker image, that is valid runtime configuration. The boundary problem is not "image exists on Project"; the problem is when the runner directly depends on an ad hoc top-level `project.image` field instead of consuming a resolved runtime contract.

**Alternatives considered**:

- Ban Project-level image configuration: rejected because it removes a legitimate operator configuration path and forces unnecessary indirection.
- Keep top-level `Project.image` as-is forever: rejected because it is Docker-specific and does not scale to context bundles, provider translation, or non-image providers.
- Move image into runner-global env config: rejected because multiple Projects need different runtime environments.

## Decision: Introduce A Typed `Project.runtime` Object

**Rationale**: A structured runtime object can hold provider family, Docker image, context bundles, mount/port/cache/secret policy, and override policy without scattering runtime fields across Project, TaskSpec, runner daemon, scripts, and docs.

**Alternatives considered**:

- Keep adding sibling fields such as `image`, `ports`, `mounts`, `skillsPath`: rejected because the contract becomes provider-specific and hard to validate.
- Store runtime config only in `metadata`: rejected because runtime config is a service-boundary contract and needs shared schemas.
- Require a separate runtime profile for every Project in the MVP: rejected because inline Project default runtime config is a simpler first slice and matches the operator workflow. Future Project-managed named runtime profiles remain part of the target model.

## Decision: MVP Uses One Default Runtime While Reserving Named Profiles

**Rationale**: Projects will eventually need multiple runtime profiles for work modes such as frontend development, backend development, documentation-only work, and testing. The first version should not implement that management surface before the default runtime path works. Task runtime override remains valid, but it is constrained by Project policy and applies on top of the Project default runtime in the MVP.

**Alternatives considered**:

- Implement full runtime profile CRUD now: rejected because it expands the first slice before Project default runtime and task submission are proven.
- Ban task runtime overrides: rejected because advanced callers need a controlled way to request allowed image or context changes.
- Allow arbitrary task runtime overrides: rejected because mounts, secrets, cache, and ports are safety-sensitive management surfaces.

## Decision: Mounts Have System, Project, And Runtime/Image Ownership

**Rationale**: Effective runner mounts should be a resolved merge of true Mystra system mounts, Project-managed mounts, and runtime/image-declared mounts. Castrel-specific image or context mounts are not automatically system mounts just because the current local runner used them first.

**Alternatives considered**:

- Treat all current default Docker mounts as system mounts: rejected because some are Castrel or image-contract artifacts.
- Let any runtime mount replace all defaults: rejected because a single Project mount could accidentally remove runner-required execution mounts.
- Defer mount ownership entirely: rejected because the resolved runtime contract would be difficult to debug and unsafe to extend.

## Decision: Runtime Resolver Owns Effective Runtime Resolution

**Rationale**: The control plane should combine Project runtime config, permitted task overrides, context bundle resolution, and runner compatibility into one resolved runtime contract. Runners execute the resolved contract; they do not invent how to find image or context.

**Alternatives considered**:

- Runner reads Project runtime fields and resolves bundles itself: rejected because it couples runner execution to control-plane business state and creates duplicate policy logic.
- Task stores only raw overrides and leaves defaults unresolved until runner start: rejected because invalid runtime config would fail too late.
- Return only Project runtime config in claim: rejected because the claim should be a run-specific snapshot after policy checks.

## Decision: Context Bundles Are Runtime Inputs With Policy

**Rationale**: Mystra should manage how context becomes available to a run, but concrete bundle contents such as skills, issue context, or project guidance are runtime inputs or release artifacts. Source-owned examples may exist, but they are not the authoritative Project runtime contents.

**Alternatives considered**:

- Bake all skills/context into `packages/runner-image`: rejected because it turns the platform repo into a runtime content repository.
- Inline context into runner-daemon prompt text: rejected because it makes context changes code changes and hides ownership.
- Let task agents fetch missing context from third-party tools: rejected for the MVP because container context boundaries should be explicit and auditable.

## Decision: Preserve Docker MVP Through Provider-Specific Translation

**Rationale**: The first provider remains single-machine Docker. The resolved runtime contract can contain Docker image information for Docker runs, while future provider families can interpret different environment references without changing Project/task envelope semantics.

**Alternatives considered**:

- Introduce Kubernetes or cloud sandbox now: rejected by MVP boundaries.
- Build a full generic sandbox abstraction before fixing contracts: rejected because the immediate contract problem is runtime config resolution.
- Keep Docker args hard-coded in runner daemon forever: rejected because mounts, ports, and context bundles need typed policy and tests.

## Decision: Do Not Keep Legacy `Project.image`

**Rationale**: This is the first implementation of the Project runtime contract, so there is no production compatibility burden for a top-level Project image field. Keeping both `Project.image` and `Project.runtime.image` would preserve the ambiguity the feature is meant to remove.

**Alternatives rejected**:

- Keep top-level `Project.image` as a compatibility input: rejected because it keeps Docker-specific runtime configuration outside the runtime object.
- Backfill `projects.image` into `projects.runtime.image`: rejected for the first version because no durable deployed data requires it.
- Keep both `image` and `runtime.image` permanently: rejected because ownership remains ambiguous.

## Decision: Runner Capabilities Include Provider And Required Runtime Features

**Rationale**: Claim assignment must not give a Docker-only run to an incompatible runner or a run requiring unsupported mounts/ports/context features to a runner that cannot honor them.

**Alternatives considered**:

- Match only by agent and executor: rejected because runtime config adds provider and feature requirements beyond agent name.
- Let runner fail after claim: rejected because it wastes capacity and creates noisy failures.
- Use free-form capabilities only: rejected because claim matching needs typed, testable behavior.
