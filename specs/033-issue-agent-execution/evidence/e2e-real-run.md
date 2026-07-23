# Real Linear to Copilot to GitHub Run

Date: 2026-07-23

## Accepted run

| Fact | Value |
|---|---|
| Linear Issue | `STU-55` |
| Job | `2a0adae4-fc42-47bd-9fa4-d23e3d91b7b7` |
| Run | `cd1166d2-0ad0-492e-8bd7-333c1c24ef21` |
| Database | `/tmp/mystra-033-e2e.db` |
| Image | `mystra-copilot-runner:1.0.69-0` |
| Container | `mystra-cd1166d2-0ad0-492e-8bd7-333c1c24ef21` |
| Branch | `codex/stu-55-mystra-demo-2` |
| Commit | `69f2e4de5d3c0921dba25c41db2488a52c32dd3e` |
| Pull request | https://github.com/Arcadia822/mystra-agent-demo-033/pull/2 |
| Preview | `http://127.0.0.1:32769` |
| Final state | `waiting_for_review` |

The CLI selected and dispatched the real read-only Linear Issue. The runner cloned
the private GitHub repository inside Docker, mounted the frozen execution spec,
started Copilot CLI `1.0.69-0` in autopilot with maximum continuation count `10`,
and changed only `src/rca.js`.

Independent runner quality results:

```text
test:  passed, npm run test
build: passed, npm run build
```

The retained preview returned HTTP 200 twice from the host. GitHub reported PR #2
OPEN, base `main`, head `codex/stu-55-mystra-demo-2`. The runner reported active
capacity `0` after handoff while the container remained retained for review.
The disposable accepted-run record was corrected after a persistence review so
`waiting_for_review` has no `failureReason`; a focused persistence regression test
now enforces that invariant.

## Diagnostic run

An earlier run reached preview, push and PR #1, then strict result validation rejected
an internal `logPath` field nested in the quality payload. The boundary was corrected
to publish only canonical QualityPhaseResult fields. Its exact local container was
stopped and removed; its SQLite database and sidecars were moved to the explicit
`/tmp/mystra-033-e2e.failed-run.db*` diagnostic names. No recursive deletion occurred.

No credential values, authorization headers or credential-bearing URLs are recorded
in this evidence.
