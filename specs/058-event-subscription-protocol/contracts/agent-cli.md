---
title: "058 合同：mystra-agent events 命令"
taco_scope: plan
status: proposed
---

## 命令面

扩展 `packages/agent-cli` 的现有 `mystra-agent` binary，不建新 CLI。以下命令为实施目标，目前不可作为已上线命令使用。

```sh
mystra-agent events list --team <mystra-team-uuid>
mystra-agent events subscribe --team <mystra-team-uuid> --project <project-uuid> \
  --integration linear --event-type linear.issue.state_changed \
  --subscription-id review --filter changes.state.to=<state-id>
```

共同可选参数：`--session-file <path>`（优先级为显式参数、`MYSTRA_OPERATOR_STATE_PATH`、默认 `~/.mystra/operator-session.json`）、`--server <origin>`。subscribe 另支持重复 `--filter key=value` 和 `--control-stdin`。项目/source/type 都必须显式选择，不默认订阅所有 Project。`--filter` 不是任意表达式，按 server 目录限定字段及 eq，重复 key/未知 flag/缺值均 usage error。`--subscription-id` 默认 `default`，只在当前连接内有意义。

list 是一次 HTTP catalog 请求；subscribe 是 WS 生命周期。CLI 不把 catalog 转成平台专属命令，第二个 fixture integration 使用同一路径和参数。

## 凭据与配置复用

- 读取现有 operator session store 的 version 1 格式：`{version:1,controlPlaneUrl,sessionToken}`，不复制到第二份配置文件、不写新 token。原 `scripts/operator-cli.mjs` 的登录仍是认证入口。
- session 文件须为本用户的普通文件、权限不超过 0600，不跟随 symlink；这是 events reader 新增的安全读取要求，既有 operator reader 只提供格式读取，不能宣称它已实现此保护。以不跟随 symlink 的方式打开并对同一文件句柄检查类型、owner、权限后读取，避免仅 lstat 后再按路径读取的竞争窗口。格式、版本、token 正则错误明确失败，原始 token 不通过 argv、日志或 stdout 出现。
- `--server` / `MYSTRA_CONTROL_PLANE_URL` 可指定目标，但必须与 session file 的规范化 origin 相等；不向另一个 Host 或跨 origin redirect 转发 Authorization。HTTPS 默认强制，仅精确 loopback 允许 HTTP fixture；不能用宽泛私网判断降级。
- 既有 workload 命令仍只接受 `MYSTRA_EXECUTION_CODE`。在 `runAgentCli` 的命令族判定后分别加载 events/session 配置与 workload/execution 配置；events 即使看到 execution code 也不能把它当 fallback，workload 也不得读取 human session 作为 fallback。
- `--team` 显式指定本进程订阅目标，不要求等于 session.activeTeamId。同一份登录文件可由多个 CLI 进程同时订阅该用户有权限的不同 Team（仍遵守每 session 4 连接配额）；切换管理界面/CLI 的 active Team 不断开订阅。服务端按目标 Team membership 与权限分别复查，不自动迁移目标。
- 每个 AuthSession 最多 4 条连接是资源限额，不是 Team 成员数量限制；同一 session 的第 5 条连接收到 HTTP 429，在 stderr 提示并退避重试，等待其他连接释放。不得为绕过配额自动重新登录或创建新凭据。
- 这复用现有 human session，不是新登录流，也不把 30 天 human 权限交给 Task 中的 Agent。未来 DSH/Agent 适配若需要专门身份或更窄委托，必须另行设计，不能假定本合同已授权。

## 输出与控制

stdout 只写每行一个共享 schema 验证后的 JSON。list 返回目录；subscribe 输出 `hello/subscribed/unsubscribed/event/error` 协议帧。诊断、连接状态、退避倒计时与“在线模式不补发”的警告只写 stderr。不输出原始 WebSocket 异常对象或包含请求 header 的堆栈。

初始订阅在 hello 后发送，收到 subscribed 才报告生效。重连保留进程内期望订阅列表，不持久化；对每条期望订阅重新发送、逐条确认，无 offset 恢复。服务端说 subscribed 只表示登记，不能说 Agent 已处理。

`--control-stdin` 启用 UTF-8 NDJSON 控制通道，支持协议的 subscribe/unsubscribe 消息（见 [event-protocol.md](event-protocol.md)），每行最大 16 KiB、有界缓冲，更新期望集合后发送。取消期望订阅后重连不得重新订阅它；恢复必须等待之前有效的初始过滤器通过确认。没有该 flag 时不读取 stdin，管道 EOF 不影响长连接。有 flag 时 EOF 视为正常停止；非法控制行输出结构化 error，不污染 stdout 数据边界。

`--control-stdin < config.ndjson` 会在读完文件后退出，不是加载配置后长驻的方式；要保持受控订阅在线，调用方必须保持 stdin writer 打开。只需固定订阅时直接使用命令参数并省略此 flag。

## 错误与退出

| 退出码 | 行为 |
|---|---|
| 0 | list 成功，或 subscribe 的正常受控停止 |
| 2 | usage、session 文件/来源配置不合法、未知 filter/type/version 等永久协议配置错误 |
| 3 | list 的网络/临时服务失败，或 subscribe 无法恢复的本地 I/O 错误 |
| 4 | 认证失效/权限不足/强制改密码 |
| 130 / 143 | SIGINT / SIGTERM，清理后退出 |

subscribe 的临时网络错误按协议退避，没有固定总重试次数；永久认证/权限/初始过滤错误不自动重试。不能只凭 WebSocket error 文本猜 HTTP 状态：`ws` 的 Upgrade HTTP 响应/close code 负责分类。CLI 与 server 使用 `ws`，因为原生 WebSocket API 不能以所需构造方式添加 Authorization header；不将 token 挪到 URL 绕过这个限制。

server 的正常退出、断网和慢消费者重连都会打印潜在事件丢失窗口。慢 stdout 遵守 Node stream backpressure；已超限的本地 event 不伪装收到，主动关连接并诊断。EPIPE 结束进程，不让重连 timer 残留。

## 兼容性与验证

既有 whoami/context/task/workflow 命令、错误映射和 execution-code 安全边界不改变。增加 events 分支不是旧功能 alias 或兼容层。

验证优先实际 CLI 子进程与真实 WS server：读取 operator store（不泄漏 token）、两个来源 list/subscribe、stdin unsubscribe、断网重连、HTTP 401/403 停止、stdout 阻塞、SIGTERM、EPIPE、所有清理 timer 与 server 订阅归零。初次连接与每次重连 stdout/stderr 分流都应可被后续插件直接消费，但本功能不实现插件、Session Append 或本地 HTTP 转发。
