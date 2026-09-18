---
title: "058 数据模型：Webhook 校验状态与在线订阅"
taco_scope: plan
status: proposed
---

## 持久化增量

只新增 connection-bound `IntegrationWebhookEndpoint`，不新增事件表、订阅表、消费 offset 或 Agent 身份。全部经领域化 `RdbProvider`，SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 保持同一逻辑约束。

| 字段 | 类型 | 约束 |
|---|---|---|
| id | UUID | 主键、服务端生成；稳定 webhook query 标识，可通过管理 API 读取 |
| teamId | UUID | 从 exact connection 解析的 Mystra tenant，调用方不能指定 |
| connectionId | UUID | 唯一、指向 IntegrationConnection，每 connection 至多一个 endpoint |
| createdAt / updatedAt | RFC3339 string | 与现有 provider 时间表示一致 |

不重复保存 integration/organization/credentialRef，以 connection 当前状态为准；公开 metadata 的 integration 由服务层投影。关联键由 server 赋值，provider 事务仍校验 teamId 相等，不把独立 FK 的存在误当成复合租户隔离。

Connection 删除与 endpoint 删除在同一事务，保留 045 对被 Project/source 引用连接的删除限制。不把 webhook 哈希放进公开的 `connectionConfig` 或可解密 SecretEnvelope。API key 的 SecretProvider 合同不变。

```text
Mystra Team
  +-- IntegrationConnection -- 0..1 IntegrationWebhookEndpoint (hash only)
  +-- Project -- 0..1 Linear ProjectIssueSource
                          +-- exact connectionId
                          +-- scopeExternalId = Linear Team ID
```

## 045 关联约束扩展

现有两套 schema 只有 `@@unique([projectId, integration])`，不能保证反向唯一。保留该约束，新增：

```text
UNIQUE(teamId, integration, scopeType, scopeExternalId)
```

Linear scopeType 为 `linear-team`。同一 Mystra Team 中，不同 connection 也不能把同一 Linear Team 绑定给两个 Project；跨 Mystra Team 的独立配置不互相抢占。原 source PUT 的校验和原子 replace 保留，并将唯一冲突映射为 HTTP 409 `ISSUE_SOURCE_SCOPE_CONFLICT`。竞争写入须依赖数据库约束，而非先查再写。

范围替换发生冲突时旧 source 必须完整保留。归属查询返回 `none | exactly-one`，异常重复为 fail-closed 配置错误，不选择第一条、不广播。历史 pre-0.1 本地数据不提供去重迁移；重建仅在执行阶段获得对指定数据的明确授权后进行，本次不操作数据库。

查询条件：token connection 的 Mystra teamId + integration + scopeType + scopeExternalId。选出的 Project 必须 active，并校验其 exact source connection 的当前 active/ready 状态和 workspaceId。connectionId 不作归属选择键，仍保留 source 自身的 exact-connection 语义。

## RdbProvider 新领域操作

以下为计划新增的接口名，参数/结果在实现时以共享 Zod 和内部 record 定义，不暴露 Prisma 类型：

| 操作 | 输入 | 结果与事务边界 |
|---|---|---|
| getIntegrationWebhookEndpoint | connectionId + teamId | 返回稳定 endpoint 或 undefined；管理 API 由 id + trusted public origin 组成固定 URL |
| getIntegrationWebhookEndpointById | id | endpoint + exact connection 非秘密记录；仅 ingress 使用 |
| createIntegrationWebhookEndpoint | teamId + connectionId + id + timestamp | 唯一创建，connection active/ready 与租户一致性在事务中校验；重复调用返回现有 endpoint |
| resolveProjectIssueSourceScope | teamId + integration + scopeType + scopeExternalId | 唯一 source/Project/connection 的领域记录或 undefined |

`PrismaRdbProvider` 实现两数据库相同合同；测试用 provider/fixtures 随新增方法更新。Connection delete 的既有事务扩展必须同事务清理 endpoint，不能绕过 service-side reference 检查。不新增 SecretProvider 路径、token hash 或可解密 secret。

## Endpoint 生命周期

```text
absent -- ready connection create/read --> stable endpoint
stable endpoint -- repeated read/restart --> same endpoint id
stable endpoint -- permitted connection delete --> absent
```

API key 同组织替换不改变 endpoint ID。若 connection identity/organization 改变，仍由 exact connection 的当前 active/ready 与 organization 校验阻止错误投递；本版不提供 endpoint rotate/regenerate。inactive/missing/invalid connection 不得接纳入站。

## 内存对象

| 对象 | 主键/字段 | 生命周期 |
|---|---|---|
| EventCapability catalog | integration + eventType，schema/filter/matcher | composition root 启动注册，immutable |
| SubscriptionConnection | connectionId、sessionId/hash、userId、固定的显式目标 teamId、WS、心跳/队列 | 同一 session 可持有不同 Team 的多个连接；目标权限失效仅关闭该 Team，activeTeam 切换无影响 |
| Subscription | connectionId + subscriptionId、单调 generation、projectId、integration/type、canonical filters | 确认后到 unsubscribe/连接清理；重建使用新 generation |
| ReceivedWebhook | endpointId、connectionId、tenant/integration、receivedAt、headers、rawBody、subscriptionGeneration 上界 | 先内存接纳再立即回 200；排队/处理到完成或取消，不入 RDB |
| CandidateEvent | providerEventId、source scope、subject、occurredAt、changes | 异步 worker 内解析，每请求最多 16 个 |
| NormalizedEvent | schema v1 + server-resolved projectId + receivedAt | 规范化到队列释放，不入 RDB |
| DedupEntry | tenant + integration + delivery + eventType，pending/done，expiresAt | 8h TTL，最多 100,000；reserve 后失败仍保留，重启清空 |

Connection 仅持有认证验证所需的最小内部身份；不缓存完整 human session token到日志/对象 dump，保存 session hash 或 session id 用于后续复查。Project 身份、权限及 source 绑定不能在建连时永久冻结。

订阅鉴权复用 `getTeamContext(userId, connection.teamId)` 获取当前目标 Team membership/role，再检查资源权限；不使用 `resolveActiveTeam`，不缓存或更改 activeTeamId。session/user 失效关闭全部连接；目标 Team/membership 失效只关闭对应连接。无需新增持久身份数据。

队列统一按消息数和字节数计量，包括 transport 已缓存字节。序列化不可变 envelope 可在同一事件内复用，但各 subscriptionId 的 wrapper 独立；不同连接不共享可变队列。

inbox 排队与处理中合计 256 条 / 16 MiB 原始正文、最多 4 个 worker；入口读取另限 32×1 MiB。完整 body 移交而非复制；10 秒过期记录不得开始或继续投递。未 settle 的 worker I/O 仍占槽位，取消 generation 阻止迟到结果产生副作用。shutdown 关闭 admission、取消 worker、丢弃 inbox，不持久化或重投；所有具体 HTTP/异步结果见 webhook 合同。

ReceivedWebhook 捕获接纳时订阅 generation 上界；worker 只能投递给该上界内仍有效的订阅，不给后来新建或重连的订阅补发。当前权限/source/endpoint 状态仍须复查，不把 admission snapshot 当永久授权。

## 验证边界

- DB parity：字段、unique、删除限制、并发 source 冲突、跨 Team 同外部 ID 均覆盖 SQLite 与 PostgreSQL；Supabase 复用 PG adapter，不虚构单独适配器。
- endpoint id 是公开路由标识，可出现在 IntegrationConnection 管理投影生成的 webhook URL 中；不新增 hash、secretRef 或一次性原值。
- 内存清理：SIGTERM、heartbeat、session revoke、source removal、Project archive、DB failure、slow consumer；事件不进入 SessionEvent/TaskHistory。
- schema/bootstrap 更新遵循 pre-0.1 clean cutover，无双读、fallback、迁移兼容承诺。实际 reset 是单独且需授权的破坏性操作，不属于本次规划。
