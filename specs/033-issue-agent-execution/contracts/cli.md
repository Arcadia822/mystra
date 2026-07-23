# CLI Contract

## Commands

```text
pnpm operator:cli -- issues list --integration linear [--limit 25] [--cursor TOKEN] [--json]
pnpm operator:cli -- issues get ENG-123 --integration linear [--json]
pnpm operator:cli -- issues dispatch ENG-123 --integration linear --project PROJECT \
  --agent copilot --branch mystra/ENG-123-short-name [--json]
pnpm operator:cli -- runs inspect JOB_ID [--json]
pnpm operator:cli -- runs wait JOB_ID [--interval-seconds 2] [--timeout-seconds 3600] [--json]
```

`--project` 接受 project slug；CLI 通过 `GET /api/projects/{slug}` 解析，再发送
canonical `projectId`。

## Thin-client invariant

CLI 可以解析 flags、调用 HTTP、验证响应、轮询 Job、格式化输出和映射稳定错误码。
CLI 不得读取 `LINEAR_API_KEY`、构造 GraphQL、导入 Integration/SQLite、创建 JobSpec
或推导第二套状态机。

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success，包括 `waiting_for_review` |
| 2 | usage |
| 3 | transport/upstream |
| 4 | integration/issue/project/job missing |
| 5 | unavailable/conflict |
| 6 | invalid request/response |
| 7 | local wait timeout |
