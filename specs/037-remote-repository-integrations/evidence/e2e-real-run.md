# Real E2E evidence

**Executed**: 2026-07-25/26 (America/Los_Angeles)
**Control plane**: `http://127.0.0.1:3100`
**Runner**: `mystra-037-e2e`, Docker executor, concurrency 1

No existing repository was used. Linear was queried read-only and was not
modified. Secret values were supplied only through process environment
variables and are not recorded here.

## Fresh GitHub fixture

- Repository:
  `Arcadia822/mystra-remote-e2e-20260726-052555`
- Visibility: private
- Default branch: `main`
- Initial commit:
  `1e41001a732a6c8ede489856b3945c420a2d1a47`
- Issue:
  `https://github.com/Arcadia822/mystra-remote-e2e-20260726-052555/issues/1`
- Project created through CLI:
  `mystra-remote-e2e-cli`
- Equivalent Project created through Web:
  `mystra-remote-e2e-web`

Both Projects resolved the same GitHub repository external ID, full name,
clone URL, default branch, visibility, and provider.

## Provider smoke checks

Real CLI/API calls verified:

- Integration descriptors: GitHub exposes `repositories, issues`; Linear
  exposes `issues`.
- GitHub repository get for the fresh repository.
- GitHub Issue get for Issue 1 with explicit repository scope.
- Linear Issue list using the existing local authorization, read-only.

## Standard execution

- Job: `61c14855-dca1-4892-86c2-31abbcbe8f17`
- Run: `1ac13895-ae21-4e6e-b2e9-af309a8a0ab5`
- Repository snapshot:
  `github / Arcadia822/mystra-remote-e2e-20260726-052555`
- Agent: Copilot CLI `1.0.69-0`
- Mode: autopilot, maximum continuation count 10
- Changed source/test files: 3
- Test: `npm run test`, passed
- Build: `npm run build`, passed
- Preview probes: 2, passed
- Preview: `http://127.0.0.1:32770`
- Delivered commit:
  `671dbc84449a0fe5b1754ff5367afb2d6d7e19bc`
- Branch: `codex/remote-e2e-review-ready`
- Pull request:
  `https://github.com/Arcadia822/mystra-remote-e2e-20260726-052555/pull/2`
- Final run state: `waiting_for_review`

The retained Docker sandbox
`mystra-1ac13895-ae21-4e6e-b2e9-af309a8a0ab5` remained running with host port
32770 mapped to container port 3000. Two additional host requests returned the
required text:

```text
Mystra remote execution is review ready
```

The remote branch SHA and open PR head SHA both matched the structured run
result. After handoff, the runner reported `activeRunCount: 0` of concurrency
1.

## Browser verification

The real Web surface was used to:

1. observe the Project repository picker transition from loading to 46 remote
   repositories;
2. create and read the Web Project bound to the fresh repository;
3. open the Tasks list and select the real Job;
4. inspect the task detail, Issue snapshot, all execution events, quality
   results, retained preview, PR link, Agent version, and autopilot cap.

The accessibility snapshot contained named navigation, form controls, headings,
status filters, and review links. At the live 1280 x 720 viewport, document
width matched viewport width. Browser logs contained development-only React/HMR
messages and no error or warning entries.

Loading, empty, error, validation, selection, and double-submit component states
are additionally covered by
`app/projects/_components/project-create-model.test.ts`; route errors and empty
provider results are covered by control-plane route/provider tests. The current
in-app browser surface does not expose device emulation, so smaller responsive
breakpoints are verified by CSS/component inspection and build tests rather than
misreported as browser-emulated evidence.
