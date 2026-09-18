---
title: "058 合同：在线 Integration 事件协议 v1"
taco_scope: plan
status: proposed
---

## 边界与版本

本合同是待实现的设计，不表示端点已上线。规范 schema 归属 `packages/shared/src/integration-events.ts`；服务端与现有 `packages/agent-cli` 同时消费。仅支持 `protocolVersion: 1`，未知版本拒绝，不做旧开发版本兼容。

HTTP 路径与 WS 路径由同一 Mystra server composition root 拥有，无独立网关或客户端入站端口。订阅与事件不持久化，不修改 Task、Session、Workflow 或外部 Issue。

## 认证与授权

- `GET /api/events/catalog?teamId=<uuid>` 与 `GET /api/events/stream?teamId=<uuid>`（Upgrade）使用既有 human AuthSession 的 `Authorization: Bearer <session token>`。`teamId` 必填，不靠当前 active Team 猜测。
- WS 子协议为 `mystra.events.v1`，Upgrade 前用 human AuthSession 验证身份，再通过现有 `getTeamContext(user.id, requestedTeamId)` 查询目标 Team 的有效成员身份，使用 `requirePermission(context, "team.resource.access", requestedTeamId)` 校验权限。不调用 `resolveActiveTeam`，不读取/修改 session.activeTeamId 作为授权前提。只接受显式 Bearer，不接受 Cookie-only、query token、webhook token 或 execution code；有 Origin 时必须匹配受信部署 origin，无 Origin 的 CLI 合法。
- 复用 `authenticateRequest`、密码强制修改检查、membership 查询与 RBAC 权限判定，不引入第二种登录或专用凭据。仅新增 events 的显式 Team 授权组合，不全局改写既有管理路由的 active-Team 语义。human 凭据仍较宽，不默认注入 workload。
- 一条连接固定一个显式 Team，但同一人、同一 session 可在现有连接配额内同时为多个有权限的 Team 建立连接，无需重新登录。每次 subscribe 校验 Project 属于该连接 Team；发送/心跳复核当前 session/user、目标 Team membership/权限及 Project。切 active Team 不影响订阅；目标 Team 归档、成员撤销或权限不足只关闭该 Team 的连接，其他 Team 不受影响；session/user 失效关闭其全部连接。已写入 socket 的字节无法撤回。
- 数据库不可用时 fail closed，关闭连接 `1011`，不能用过期缓存继续发送。
- catalog HTTP 请求与 stream Upgrade 使用同一显式 Team 授权组合，目录查询也不受 activeTeamId 影响；未加入、Team 已归档或无资源访问权限统一 403，不泄漏该 Team 的目录。未知 Project 与不匹配 Project 均 fail closed。
- 首次认证及后续复查均保留强制改密码检查。角色名称变化本身不等于撤权：只要目标 membership 有效且仍具 `team.resource.access`，连接保持；仅实际失去所需权限才停止。

## 事件目录

```json
{
  "protocolVersion": 1,
  "delivery": "online-only",
  "events": [
    {
      "integration": "linear",
      "eventType": "linear.issue.state_changed",
      "subjectType": "issue",
      "filters": [
        {"key": "subject.externalId", "operator": "eq", "valueType": "string"},
        {"key": "changes.state.from", "operator": "eq", "valueType": "string"},
        {"key": "changes.state.to", "operator": "eq", "valueType": "string"}
      ]
    }
  ]
}
```

返回当前进程已注册的类型和过滤能力，不返回外部凭据或所有 Project 列表。目录不代表任意 Project 的访问授权。目录有硬上限 256 个事件类型、每类型 16 个过滤项；注册时检测重复和越界并使启动失败，不做截断或无意义分页。新增来源通过 program-owned 注册而非远程插件安装。

通用过滤仅支持声明字段的字符串精确相等，多个项取 AND，无正则、表达式、脚本、通配符或复杂 DSL。core 不对外部任意 JSON 做路径求值，由已注册 capability 的 schema 和 matcher 验证/匹配；不在 router 中写 `if integration === linear`。

## 消息与确认

所有消息均为 UTF-8 JSON object，禁止二进制、未知字段和未知 type。控制消息最大 16 KiB，事件消息最大 64 KiB。控制请求的 `requestId` 为客户端非空字符串（最多 128 字符）；不承担跨连接幂等。每连接控制命令串行执行，确认后其操作生效。

Server 建连后先发送：

```json
{"protocolVersion":1,"type":"hello","connectionId":"connection-1","delivery":"online-only","heartbeatIntervalMs":30000,"pongTimeoutMs":10000,"maxSubscriptions":32}
```

客户端提交期望订阅，Project/integration/eventType 必须明确：

```json
{"protocolVersion":1,"type":"subscribe","requestId":"r1","subscriptionId":"review","projectId":"11111111-1111-4111-8111-111111111111","integration":"linear","eventType":"linear.issue.state_changed","filters":{"changes.state.to":"review-state-id"}}
```

确认：

```json
{"protocolVersion":1,"type":"subscribed","requestId":"r1","subscriptionId":"review"}
```

`subscriptionId` 为连接内的非空字符串（最多 128 字符）。同一 ID、同一规范化过滤器的重复请求返回同样确认；同一 ID、不同内容返回 `SUBSCRIPTION_CONFLICT`，不隐式替换。不同行连接可使用同一 ID，无共享订阅身份。

退订：

```jsonl
{"protocolVersion":1,"type":"unsubscribe","requestId":"r2","subscriptionId":"review"}
{"protocolVersion":1,"type":"unsubscribed","requestId":"r2","subscriptionId":"review"}
```

不存在的本连接订阅也返回确认。确认前已发送的事件可能已到达；确认后不能再产生该订阅的新事件帧。命令和数据使用同一有序发送队列，不能让已取消的待发送事件越过退订确认。

## Event envelope

```json
{
  "protocolVersion": 1,
  "type": "event",
  "subscriptionId": "review",
  "event": {
    "id": "linear:234d1a4e-b617-4388-90fe-adc3633d6b72:linear.issue.state_changed",
    "integration": "linear",
    "eventType": "linear.issue.state_changed",
    "projectId": "11111111-1111-4111-8111-111111111111",
    "subject": {"type": "issue", "externalId": "539068e2-ae88-4d09-bd75-22eb4a59612f", "identifier": "TEST-1"},
    "occurredAt": "2026-09-16T10:00:00.000Z",
    "receivedAt": "2026-09-16T10:00:01.000Z",
    "changes": {"state": {"from": "started-state-id", "to": "review-state-id"}}
  }
}
```

`id/integration/eventType/projectId/subject/occurredAt/receivedAt` 必填；subject 的 `identifier` 只作可选展示，过滤用稳定 `externalId`。字段均有长度上限，时间为有效 RFC3339 UTC 时间。`changes` 由 capability 声明的 schema 验证；Linear 首版只接受非空且不相等的 from/to 状态 ID。不转发完整 payload、正文、评论、actor 邮箱、URL token、签名或 headers。

在 ingress 内部尚未解析 Project 的候选事件不是可投递 envelope。只有得到唯一且授权范围内的 Project 才能进入 router。

## 错误与关闭

控制错误统一格式：

```json
{"protocolVersion":1,"type":"error","requestId":"r3","code":"UNSUPPORTED_FILTER","message":"Unsupported filter","retryable":false}
```

`requestId` 仅在解析出合法 ID 时回传。稳定 code：`INVALID_MESSAGE`、`UNSUPPORTED_VERSION`、`UNKNOWN_EVENT_TYPE`、`UNSUPPORTED_FILTER`、`SUBSCRIPTION_CONFLICT`、`SUBSCRIPTION_LIMIT`、`FORBIDDEN`、`UNAUTHENTICATED`、`INTERNAL_ERROR`。消息不回显完整入参、凭据或内部异常。

| 情况 | HTTP/WS 行为 | CLI |
|---|---|---|
| Upgrade 前认证失败 | HTTP 401 | 退出，不重试 |
| Team/Project 权限不足、强制改密码 | HTTP 403 或协议错误 + 4403 | 退出，不重试 |
| 已建立连接的认证失效 | 4401 | 退出，不重试 |
| 不支持版本/子协议 | HTTP 400 / 4406 | 退出，不重试 |
| 不支持过滤/类型 | 控制 error，原有订阅不变 | 初始订阅失败则非零退出；运行中控制请求失败仅报错，不重试该请求 |
| 超大帧 | 1009 | 配置/协议错误，退出 |
| 超量控制请求 | 1008 | 退出，不无限重试 |
| server shutdown | 1001 | 可退避重连 |
| 瞬时服务/网络故障 | 1011 / abnormal close | 可退避重连 |
| 慢消费者 | 4410 | 报告丢失风险并退避重连 |
| WS 进程/session 连接配额耗尽 | Upgrade HTTP 429 | stderr 明确配额原因，按既有 full-jitter 退避重试；不误报认证失败、不循环新建登录 |

HTTP 错误采用既有 `error.code/error.message` 结构，任何 Upgrade 拒绝都有明确 HTTP 状态，非事件路径保持原有 API 语义。

## 有界资源与交付语义

| 资源 | v1 限额/行为 |
|---|---|
| 活跃 WS | 进程最多 100、每个 AuthSession 最多 4；超限 HTTP 429 |
| 每连接订阅 | 32 |
| 控制流 | 每连接每秒 20 次，突发 40；超限关闭 1008 |
| server 待发送 | 每连接最多 256 帧或 1 MiB，含已交给 ws 的 buffered bytes；先到者触发 4410 |
| 客户端 stdout 待写 | 最多 256 帧或 1 MiB；backpressure 等 drain，越界主动断开并诊断，不能无限堆积 |
| 心跳 | server 每 30 秒发 WS ping；10 秒内未 pong 则 terminate 并清理 |
| 重连 | full jitter，基数 1 秒、指数增长至上限 30 秒；稳定连接 60 秒后重置 |
| 握手/控制确认 | 10 秒超时；协议未确认前不声称订阅生效 |
| 退出 | SIGINT/SIGTERM/正常停止立即取消重连和心跳、关闭 WS；2 秒未关闭则 terminate |

每个 `(connectionId, subscriptionId)` 是独立广播目标。同一连接两个匹配订阅会收到两个不同 subscriptionId 的帧，不做竞争消费或跨订阅合并。单连接按入队顺序发送，不承诺来源时间顺序或跨连接一致顺序。

不含 ACK、offset、replay cursor、resume token 或 last-event-id。server 不重新投递已尝试发送的帧。去重以 webhook 合同的窗口为界；进程重启、重连及窗口外不保证全局严格 at-most-once。CLI stderr 在初连与每次重连明确报告在线模式和可能丢失的窗口；stdout 的 `event` 仅表示客户端接收，不表示 Agent 处理。

Webhook 的 HTTP 200 与订阅协议的确认不同：入口接收后立即响应，解析/去重/投递在易失 inbox 的异步 worker 中执行。200 后处理失败或进程退出仍可能丢失事件；新建/重连订阅不得收到 admission 之前积压的事件。CLI 在线模式诊断需覆盖这个易失窗口，不把 webhook 已确认解释为 CLI 必达。

## 验收矩阵

必须覆盖：未知版本；Cookie/execution-code/webhook-token 不能建立订阅；跨租户及未授权 Project；成员撤销/注销/账号停用/到期；两个来源同名本地事件不串流；不支持过滤明确失败；重复 subscribe 与冲突 subscribe；退订确认后的投递屏障；同连接两个匹配订阅各一次；不同连接 ID 隔离；无 pong、慢 stdout、慢 socket、有界队列；断网重连/重启不补发；退出无残留订阅与定时器。所有这些是未来实现验收，不是本次已经运行的测试。
