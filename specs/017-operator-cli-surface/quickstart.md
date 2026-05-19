# Quickstart: Operator CLI Surface

## Prerequisites

1. Start the control plane:

```sh
pnpm dev:control-plane
```

2. Set a custom control-plane URL only if needed:

```sh
export MYSTRA_CONTROL_PLANE_URL=http://localhost:3000
```

## Core Commands

List projects:

```sh
pnpm operator:cli -- projects list
```

Inspect one project:

```sh
pnpm operator:cli -- projects inspect mystra
```

List runs:

```sh
pnpm operator:cli -- runs list
```

Inspect one run:

```sh
pnpm operator:cli -- runs inspect <job-id>
```

Retrieve the final result:

```sh
pnpm operator:cli -- runs result <job-id>
```

Retrieve failure context:

```sh
pnpm operator:cli -- runs failure <job-id>
```

## JSON Mode

Every command supports `--json`:

```sh
pnpm operator:cli -- runs inspect <job-id> --json
```

## Expected Behavior

- Missing project or job ids return management-error-derived failures.
- `runs result` distinguishes not-ready from unavailable.
- `runs failure` only succeeds for failure-shaped terminal outcomes.
- Project inspection shows current lane / runtime / workflow/context facts.
- Run inspection shows current project facts plus frozen submission-time lane data when present.
