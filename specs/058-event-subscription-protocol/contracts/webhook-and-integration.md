---
title: "058 合同：Webhook 生命周期、统一入口与 Integration capability"
taco_scope: plan
status: proposed
---

## 管理 API

以下为待实现端点，服务逻辑通过 `RdbProvider`，Web/管理 CLI/MCP 只能作薄适配，不单独实现 token 逻辑。

| 方法与路径 | 请求 | 成功 | 权限 |
|---|---|---|---|
| GET `/api/integration-connections/{id}/webhook` | 无 body | 200，ready connection 返回稳定 `{endpoint,webhookUrl}`；未 ready 返回 409 | 既有 human session + `team.integration.manage` |

`endpoint` 公开字段：`id`（UUID）、`connectionId`（UUID）、`integration`、`createdAt/updatedAt`。`webhookUrl` 由可信 public origin + `/api/webhooks?token=<endpoint.id>` 组成；重复 GET、页面刷新与服务重启均返回同一 URL。不存在 rotate、revoke、regenerate、token hash、revision 或一次性原值。

GET 绑定当前 active Team 内的 exact connection。Connection active/ready、已注册 events capability、可信 HTTPS public origin 为前置；未就绪 409 `WEBHOOK_PREREQUISITE_UNAVAILABLE`。Member/跨租户 403。管理错误采用现有 `error.code/error.message`。

UI 在 step 3 内直接读取与复制固定 URL，不引入创建按钮、订阅配置或凭据管理步骤。

## Token 与统一入口

`POST /api/webhooks?token={endpointId}` 是唯一 provider-neutral ingress。`endpointId` 为服务端生成的稳定 UUID，以 query 参数承载并可公开记录；数据库按 endpoint 主键查询 endpoint→connection→Mystra Team/integration。URL 不含客户端指定的 Project、Linear Team 或 integration 路由参数。日志不要求脱敏。

无效、缺失、connection 已停用/缺失或凭据状态非 ready：统一 401 `WEBHOOK_UNAUTHORIZED`，避免泄漏记录是否存在。有效 token 对应未注册或无 events capability 的 integration：404 `WEBHOOK_INTEGRATION_UNAVAILABLE`，绝不回退到 Linear。

## 接收确认与异步处理边界

Owner 已明确：**Mystra 收到 event 就立即返回，后续动作全部异步。** HTTP handler 只做接收所必需的入口鉴权、传输限制和有界内存接纳，不能等待平台 payload 解析、Project 归属、去重、订阅授权或投递。

```text
HTTP handler:
  method/path + transport admission
    -> hash lookup + connection state + registered capability
    -> bounded raw body / header allowlist
    -> atomically admit ReceivedWebhook into bounded memory inbox
    -> HTTP 200 {"received":true}
                         |
                         | response.end invoked; schedule on a later event-loop turn
                         v
Async EventRuntime worker:
  endpoint validity/token recheck
    -> integration validate + parse + normalize
    -> tenant-scoped source/organization checks
    -> in-memory dedup reservation
    -> current authorization + subscription matching + bounded WS enqueue
```

先完成内存接纳，再调用 response.end，随后唤醒异步 worker；HTTP handler 不 await worker，不用会在响应前执行解析的同步调用或 microtask 冒充解耦。HTTP socket 实际送达对方不可保证；响应丢失时上游可能重发，不能通过撤销已接纳记录推测对方是否收到。

### 同步入口错误

- 只接受 POST；其他方法 405，不重定向。只接受 `application/json`（可带 charset=utf-8），非 JSON Content-Type 或压缩 Content-Encoding 均为 415 `WEBHOOK_UNSUPPORTED_MEDIA_TYPE`。这一步检查 header，不解析 JSON。
- Content-Length 大于 1 MiB 立即 413；chunked body 累计原始字节，超限同样 413。全 ingress 最多 32 个并发接收；从请求进入起，入口鉴权和完整 body 接收共用 4 秒的接收保护上限，超时 408 且禁止迟到回调再入 inbox。该上限不是等待时间，收齐并接纳后立即响应；不为业务处理预留或等待额外秒数。
- token 校验先于任何 payload 解析；入口 RDB 故障返回 503。未经完整接收、body 中断、鉴权失败、关闭中或内存接纳失败，不返回成功。
- body 缓冲区移交 inbox，不复制原始正文；只留 capability 的 header allowlist，Linear 为 Content-Type、Linear-Delivery、Linear-Event，不保存原始 token、Authorization/Cookie 或 URL。
- 接收并发或 inbox 容量不足：503 `WEBHOOK_OVERLOADED`，不排无限等待队列、不先回 200 再尝试接纳。
- 首版不验证 `Linear-Signature`，无签名/错误签名不构成拒绝条件。持有 token URL 者可伪造事件，组织字段校验不等于密码学 sender authentication。

### HTTP 200 只表示接收

```json
{"received":true}
```

成功响应不含 `outcome`，不包含 accepted/duplicate/ignored 的业务结果、Project 或订阅者数量。HTTP 200 不承诺内容有效、归属成功、已经投递或持久保存。Linear 官方要求 200 且 5 秒内响应；不能用 202/204 替代，也不能等异步处理完成后才回 200。

| 200 之后发现的情况 | 异步结果，不改 HTTP |
|---|---|
| JSON/schema/Delivery ID 非法 | 丢弃，脱敏 reason `invalid_payload` |
| 无 Team、未关联、已归档、无状态变化、不支持的事件子集 | 丢弃，reason `ignored` |
| endpoint 缺失、connection/organization 不匹配 | 丢弃，reason `scope_mismatch` / `endpoint_unavailable` |
| 同一稳定事件 ID 重复 | 丢弃，reason `duplicate` |
| worker RDB 故障、处理超时、去重表满 | 丢弃，reason `processing_failed` / `expired` / `dedup_capacity`；不能事后返回 503 |
| 无仍有效的在线订阅 | 丢弃，不等待订阅、不补发 |
| 匹配在线订阅 | 有界投递；每个慢消费者独立断开 |

错误仅用现有本地脱敏诊断记录 reason 与内部关联 ID，不存原始 payload 或秘密；不新增日志 API、事件历史表或状态查询产品。异步失败不触发内部重试，也不能要求 Linear 重发已经确认的请求。

### 有界异步 inbox 与退出

EventRuntime 内建易失 inbox，不是持久队列或新服务。排队与正在处理合计最多 **256 条或 16 MiB 原始正文**，先到者为限；worker 并发最多 **4**，没有无限 Promise fan-out。入口接收中的 body 另受 32×1 MiB 上限；worker 解析生成的 payload/候选对象受请求大小与 16 candidate 上限约束，不复制完整正文。

每条记录包含 receivedAt、endpointId、connectionId、tenant/integration、allowlisted headers、rawBody 和 admission 时的订阅 generation 上界。只向 admission 时已存在且处理/发送时仍有效的订阅投递；重连/新订阅的新 generation 不得接收此前 backlog。归属与权限仍按处理时的当前状态检查，不保存订阅者凭据快照。

记录从接收起 **10 秒**仍未完成则过期丢弃，队列不演变为离线补发。超时/取消后，迟到的异步结果不得 reserve 或投递；底层 DB Promise 未 settle 时仍占 worker slot，不能用 Promise.race 释放槽位后无限启动新查询。下一事件通过独立有界调度推进，不等待前一事件成功。

过期由 EventRuntime 单一有界定时扫描器驱动，不依赖 worker 唤醒；同时在每次开始处理及产生副作用前检查 deadline。扫描器移除排队的过期记录，对运行中的记录标记取消；底层未 settle 的任务仍占 worker/inbox 配额且其仍被引用的正文继续计入字节数，不能虚报内存已释放。即使四个 worker 全挂起，排队过期清理与 HTTP 过载拒绝仍工作；I/O settle 后释放槽位，后续未过期记录才可继续。

256 条与 16 MiB 是独立的先到上限：约 16 条 1 MiB body 即达字节上限，不能按 256×1 MiB 理解容量。容量验收分别验证条数、字节数与入口 body→inbox 移交后的计数。

Owner 选择首版仅保留全局接收/inbox 限额，不增加 per-token 或 per-connection 配额。一个繁忙来源可能占用全局容量并使其他来源收到 503，这是明确接受的隔离限制；不声称全局有界等于来源公平或抗洪泛隔离。

shutdown 先关闭 admission，取消/清空未完成 inbox，禁止迟到 worker 写入 WS，再关闭连接与 RDB；不等待队列无限排空、不补发。进程崩溃或退出可丢失已回 200 的事件，这是既有“不持久化、仅在线”边界的直接代价，不声称可靠送达。

### 异步去重

键为 `(mystraTeamId, integration, providerEventId, eventType)`，Linear providerEventId 是 `Linear-Delivery`，不是 webhookId 或 connectionId。TTL 8 小时，最多 100,000 key，不提前驱逐有效 key。是否跨 retry 保持相同 Delivery ID 仍由真实验收记录。

worker 完成解析/归属后，同步完成 check-and-reserve，pending/done 均阻止相同 key 再次投递；重复 worker 不等待另一个处理结果，直接结束。表满时丢弃新唯一事件并诊断 `dedup_capacity`，HTTP 已确认不能更改。获得 reservation 后，无论成功、部分投递或失败都保留该 key 至窗口结束，不因失败开放重投；未经解析/归属的 discarded 请求不占 key。进程重启清空，允许跨重启重复。每个 candidate 独立去重，批量请求也不承诺原子业务投递。

## Linear 首版解析

正式支持的 event type 只有 `linear.issue.state_changed`。创建、删除、评论、Document 和普通 Issue 修改不冒充状态变化。

1. `type === "Issue"` 且 `action === "update"`。
2. `Linear-Delivery` 是合法 UUID，`Linear-Event` 若提供必须为 Issue；与 body 不一致拒绝。
3. body `organizationId` 与 token connection 的 `connectionConfig.workspaceId` 相等。该检查防误投，不把未经签名的 organizationId 当身份凭证。
4. Team 用 Issue payload 的 provider-stable `data.teamId`。缺少该字段则 ignored，不调用 GraphQL 猜测，不用 key 前缀、Linear Project 或最近 Project。正式 fixture 需由官方 Issue webhook schema/真实 payload 验证这些字段。
5. 状态变化必须有 `updatedFrom` 自有属性 `stateId`，旧值与 `data.stateId` 均为非空稳定 ID 且不同。未知/null 旧值、字段缺失、相同状态、只改标题/描述全部 ignored。绝不查询当前状态后伪造旧值。
6. 只投影 `data.id`、可选 `data.identifier`、`createdAt` 与状态前后 ID；发生时间使用 payload action 时间 `createdAt`，接收时间由 server 记录。

同租户 Team 归属：以 `(tokenConnection.teamId, integration, scopeType="linear-team", scopeExternalId=data.teamId)` 查询唯一 `ProjectIssueSource`，再确认 Project active、source connection active/ready、其已验证 workspaceId 与 payload organization 一致。不要求两个 connectionId 相同，不越过 tenant。冲突或不一致 fail closed，无广播兜底。

## Integration capability 合同

`IntegrationPlugin.capabilities.events` 为可选的编译期契约。沿用既有 registry 构造注入，不引入动态注册 API、handler registry 产品或远程 plugin runtime。

```text
IntegrationEventCapability
  descriptors: EventDescriptor[]
  requiredHeaders: string[]
  parseWebhook({rawBody, headers, connectionMetadata})
      -> {kind: "ignored", reason}
       | {kind: "events", events: CandidateEvent[]}
  validateFilters(eventType, filters) -> canonical filters | typed error
  matches(eventType, canonicalFilters, normalizedEvent) -> boolean
  eventSchemas: 每种 eventType 对应的共享 Zod schema
```

每请求最多 16 个 candidate；Linear 至多一个。Candidate 包含 providerEventId、eventType、subject、occurredAt、scope（scopeType/scopeExternalId）、组织声明及白名单 changes，不接受外部 projectId/teamId（Mystra tenant）。候选 Project 解析由 core 调 RdbProvider；平台 payload 语义只留在对应 capability。

目录中的 eventType 必须以 integration namespace 开头；重复 type、描述符与 implementation 不匹配在启动阶段拒绝。filters 能力声明必须与实际验证/matcher 相符，不能宣传后静默忽略。

一次性扩展位置：`packages/shared/src/issue-core.ts` 的 capability enum，`integrations/types.ts`、`IntegrationRegistry` consistency 校验、`defaultIntegrationRegistry` 装配。随后测试通过注入第二个 `fixture` capability，使用同一 token 表/统一 endpoint/catalog/router 完成发现和投递；不在 production 注册 fixture，不增加 GitHub/GitLab 实现。

## 泄露与生命周期验收

- （2026-09-17 Owner 决定）endpoint ID 以 query 参数承载，进入应用日志、Sentry、反向代理 access log 与验证证据为已接受行为，不要求日志脱敏。
- public URL origin 从受信部署配置导出，不根据请求 Host/Forwarded 拼接。公网必须 HTTPS；localhost HTTP 只作本地 fixture。
- connection 停用即拒绝 ingress；删除时在同一事务删除 endpoint，原引用约束仍按 045 保留。
- 同 workspace 的 API key 替换保留 endpoint。worker 处理及投递前重查 endpoint 与 exact connection 当前状态；已入 socket 的数据不声称可撤回。
