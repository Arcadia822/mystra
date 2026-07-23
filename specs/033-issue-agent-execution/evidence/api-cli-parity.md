# API and CLI Parity Evidence

Date: 2026-07-23

The accepted Job was inspected both through `GET /api/jobs/{jobId}` and:

```text
pnpm operator:cli -- runs wait 2a0adae4-fc42-47bd-9fa4-d23e3d91b7b7 \
  --timeout-seconds 30 --json
```

Both surfaces returned:

- state/result `waiting_for_review`;
- Issue `STU-55`;
- branch `codex/stu-55-mystra-demo-2`;
- commit `69f2e4de5d3c0921dba25c41db2488a52c32dd3e`;
- passed `npm run test` and `npm run build`;
- preview `http://127.0.0.1:32769`, probe count 2;
- GitHub PR #2;
- retained Docker container;
- Copilot `1.0.69-0`, autopilot, cap 10, exit 0.

`GET /api/runners` reported `activeRunCount: 0` and `maxConcurrency: 1`.
The CLI uses only HTTP; it did not read SQLite, Linear credentials or runner state.
