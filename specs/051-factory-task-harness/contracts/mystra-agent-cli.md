# Contract：mystra-agent CLI

## Environment

- `MYSTRA_CONTROL_PLANE_URL`: required absolute HTTP(S) URL。
- `MYSTRA_EXECUTION_CODE`: required opaque code；CLI不得打印、缓存或写入 argv。
- 当前工作目录：Runner 已解析的 ready Task Workspace root。

缺少环境变量时 CLI 在发起网络请求前 fail closed。

## Commands

```text
mystra-agent whoami
mystra-agent context get
mystra-agent task status get
mystra-agent task status set <blocked|in_progress|waiting_for_review> \
  --expected-revision <positive-int> \
  --idempotency-key <bounded-string> \
  [--note <bounded-string>]
```

CLI 不提供 `--task-id`、`--agent-id`、`--harness-id`、`--session-id`、`done`、`canceled`、Task PATCH 或 external credential commands。

## Output

- 成功：单个 JSON object + newline 写 stdout，exit 0；无进度装饰。
- 失败：单个 `{"error":{"code":"...","message":"..."}}` + newline 写 stderr，stdout 空，exit 1（usage error exit 2）。
- HTTP error code 原样映射 stable application code；网络/JSON异常映射 `control_plane_unavailable`。
- 所有输出经 schema parse；未知/超大 server response fail closed。
- `context get` 在 schema parse 后添加 `workspace.root=process.cwd()`。

## Secret handling

- execution code 只从环境读取并放入 Authorization header。
- usage、错误和 debug output 不包含 code 或完整 request headers。
- CLI 不调用 `linctl`/`gh`；标准 Agent prompt负责调用。这样 helper 不成为外部工具 orchestration layer。
