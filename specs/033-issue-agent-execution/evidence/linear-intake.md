# Linear Intake Evidence

Date: 2026-07-23

## Automated contracts

```text
fnm exec --using 24.14.0 corepack pnpm --filter @mystra/control-plane test
Test Files  6 passed (6)
Tests       97 passed (97)

fnm exec --using 24.14.0 corepack pnpm --filter @mystra/control-plane typecheck
PASS
```

The focused Issue/Integration/route suite contributed 48 passing tests. It
covers list/get, cursor forwarding, identifier lookup, missing key, HTTP
401/403/429/5xx, timeout, GraphQL errors with partial data, malformed payloads,
missing capability, route errors, immutable dispatch snapshot, validation,
atomic failure, and duplicate dispatch.

## Redacted live read

The control plane started at `http://127.0.0.1:3101` with the inherited
`LINEAR_API_KEY` and an exact disposable target:

```text
MYSTRA_DB_PATH=/tmp/mystra-033-linear-live-20260723.db
```

Observed through direct Web API:

```json
{"apiListCount":2,"firstIdentifier":"STU-55"}
{"apiGetIdentifier":"STU-55","provider":"linear"}
```

Observed through the thin CLI calling the same API:

```json
{"count":3,"identifier":"STU-55","state":"Todo","hasNextPage":true}
{"identifier":"STU-55","state":"Todo","provider":"linear","urlHost":"linear.app"}
```

No dispatch was performed. The read-only routes did not initialize SQLite, so
the disposable database and sidecar files did not exist after shutdown. No
Linear authorization value, raw header, or token was printed or written to this
evidence.
