---
title: "058 技术计划：统一 Webhook 入口与 Integration 在线事件订阅"
branch: "058-event-subscription-protocol"
date: "2026-09-16"
status: "工程评审、共享 UI 原型与 tasks 门禁通过"
taco_scope: plan
---

## Summary

在现有 Mystra Control Plane 与 `mystra-agent` 内增加统一 Webhook ingress、编译期 Integration events capability 和 Project 授权的在线 WS 订阅。首个真实来源为内置 Linear，保留其 GraphQL IssueProvider。用户仍按五步配置，只新增 connection detail 中固定 webhook URL 的复制引导，不要求用户操作订阅协议。

采用单进程 custom Next server，直接拥有 ingress/catalog/WS 与同一个 EventRuntime；其他 API/Web 继续交 Next。Webhook 由 connection-bound 稳定 endpoint UUID 路由，管理 API 可重复返回固定 URL；订阅复用既有 operator human session 的 Bearer 身份，绝不扩大 execution code。新增 source 反向唯一约束与 endpoint metadata 表，不新增 secret/token 生命周期、事件或订阅持久化。
本次技术计划、独立工程评审、共享 UI 原型与 implementation tasks 已闭环；进入实现前执行 `/speckit.analyze` 并修正一致性问题。
Owner 已明确接收确认边界：入口只鉴权、完整接收并有界接纳，立即返回 200；payload 解析、归属、去重、订阅匹配与投递均在异步 worker 执行。旧“业务处理后再返回”流程已撤销，不再讨论给业务处理预留 2 秒的问题。


## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24.14.0  
**Primary Dependencies**: Next.js 16.2.6、React 19、Zod 4、Prisma 7.9.1、Vitest 4、`@mystra/ui`；拟新增 direct `ws` 8.x 与 server build 的 esbuild（实现时锁定精确已审计版本，本次不改依赖）  
**Storage**: SQLite/PostgreSQL/Supabase-backed PostgreSQL 经 RdbProvider；拟新增 IntegrationWebhookEndpoint 与 ProjectIssueSource 反向唯一约束；事件和订阅仅进程内存  
**Testing**: schema/数据库合同/竞争与授权回归；真实 server + CLI 子进程 smoke；共享原型浏览器验证；独立真实 Linear 验收  
**Target Platform**: self-hosted 单实例 Node server；公网 HTTPS + WSS；macOS/Linux CLI 主动出站  
**Project Type**: 现有 TypeScript monorepo 的 headless API、CLI 与辅助 Web UI 扩展  
**Performance Goals**: Mystra 接收至已授权在线 CLI 小于 10 秒；入口接纳后立即返回 HTTP 200，不等待任何后续业务动作；4 秒仅为接收保护上限，不是处理预算或等待时间
**Constraints**: 不补发、不持久化事件、无签名 secret setup、无新网关/CLI/中间件；不改变 Task/Session/Workflow；所有资源有界  
**Scale/Scope**: 100 WS/进程、4 WS/AuthSession、32 订阅/连接；1 MiB body、32 并发接收；易失 inbox（排队+处理中）256 条/16 MiB、4 worker、10 秒过期；控制/事件帧 16/64 KiB；每端发送队列 256 帧/1 MiB；去重 8h/100,000 key

这些限额是首版可测合同，不是已经压测得到的容量声明。超限按合同明确拒绝，不能依赖无限缓存。

## Constitution Check

### Phase 0 前置检查

| 原则 | 核验/处理 | 结论 |
|---|---|---|
| I 产品边界 | FR-023 已落实 PRODUCT 窄例外与 Constitution 2026-09-16 amendment（2.17.0），历史条目保留 | 设计获准，不宣称已上线 |
| II Typed contracts | 共享 Zod 管理 HTTP/WS/envelope/catalog；CLI 与 server 同源 | 设计通过 |
| III Provider 可替换 | events capability 归属现有 IntegrationPlugin；RdbProvider 封装双数据库；保留内置 Linear | 设计通过 |
| IV Secret/出站 | 固定 endpoint ID webhook；TLS；execution code 不扩权；CLI 只主动出站 | 设计通过，URL 持有者可伪造事件的风险已由 Owner 接受 |
| V 证据与共享 UI | 本次静态文档核验；功能验收另需真实运行、shared-code prototype | 禁止冒充运行证据 |

### Phase 1 后置检查

- 归属不跨租户，one-to-one 由新 DB unique 保证而非错误复用 045 假设；无新 Project 模型。
- UI 原型 route `/event-subscription-protocol` 已完成体验评审；当前 prototype settings modal 仍是 production DOM/SVG 副本，不能作为共享实现完成证据。T020 必须先将 Settings modal frame 提取到 `packages/ui` 并迁移两个消费者，才满足 Constitution V。
- `SettingGroup/SettingRow` 已移至 `packages/ui` 的唯一实现；Webhook URL 区块直接在 production `linear-integration-detail.tsx` 内用共享 primitives 组装，不新增独立 webhook panel 状态机。
## Project Structure

### Documentation (this feature)

```text
specs/058-event-subscription-protocol/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  prototype.md
  contracts/
    event-protocol.md
    webhook-and-integration.md
    agent-cli.md
  checklists/requirements.md
  058-event-subscription-protocol.taco.html
```

`tasks.md` 已生成并经 `/speckit.analyze` 修正；实现仍须按阶段和 impact gate 执行。

### Source Code（计划变更面，不表示已创建）

```text
apps/control-plane/
  server.ts                         新统一 Node/Next composition root
  src/lib/events/                   新 EventRuntime、router、ingress、WS transport
  src/lib/integrations/
    registry.ts, types.ts           events capability
    linear-events.ts                新 Linear payload adapter
    webhook-endpoint-service.ts     新 token 管理服务
    project-issue-sources.ts         反向唯一冲突处理
  src/lib/db/
    rdb-provider.ts, prisma-provider.ts, prisma-mappers.ts
  prisma/{sqlite,postgresql}/schema.prisma
  app/api/integration-connections/[id]/webhook/...   管理 API
  app/_components/linear-integration-detail.tsx       API/权限薄适配
packages/shared/src/
  issue-core.ts                     capability enum
  integration-events.ts             新协议/目录/事件 schemas
packages/agent-cli/src/
  cli.ts                            独立 events 分支
  events-client.ts                   新 catalog/WS/重连/控制流
packages/ui/src/
  setting-row.tsx                   从 app-local 移入的唯一 primitive
apps/spec-prototype/app/event-subscription-protocol/
  page.tsx + settings-modal.tsx     原型组合与共享 CSS 组装的设置弹窗
scripts/deploy-dev-machine.sh       统一入口切换
scripts/preview-containers.mjs       核验/更新实际启动路径
```

结构选择：延续 `apps/control-plane/src/lib` 服务模块、既有 provider 和 `packages/shared` 合同；`events` 是内部目录不是新的服务产品。所有 exported symbol 实施前必须 LSP references + GitNexus impact。

## Architecture 与数据流

```text
Linear POST
    |
    v
Node HTTP ingress: token + bounded body + inbox admission
    |                                      |
    +-- immediate HTTP 200 {"received":true} |
                                           v (later event-loop turn)
                                EventRuntime async workers
                                  parse / source / dedup
                                  current auth / WS enqueue
                                           |
                                           v
                                   online CLI subscriptions

same server: /api/events/catalog + /api/events/stream
             other routes -> Next API/Web/MCP -> token management/RDB
```

核心所有权：server root 构造一个 EventRuntime，直接处理所有事件数据面；Next 的管理 API 只改 durable endpoint 状态。避免 Next 编译模块、HMR 和 server import 得到多个 Map；不以 `globalThis` 或独立 WS 进程拼接共享状态。

server root 保留 dev HMR Upgrade 与既有 instrumentation/RDB 生命周期；shutdown 先停止 admission，取消 worker/清空易失 inbox 并屏蔽迟到投递，再关闭 WS/timer/HTTP/provider。已确认事件可能丢失，不持久化补发；禁止二次初始化 SkillContentStore 或改既有 Runner 协议。

## 技术决策摘要

1. **身份**：Owner 选择复用 human AuthSession；通过既有 `getTeamContext(userId, requestedTeamId)` + `team.resource.access` 独立验证目标 Team 成员权限，不使用 active Team 限制。同一 session 可同时连接多个授权 Team；每次订阅/发送/心跳复核。使用 operator store，不新增 SubscriptionCredential。
2. **Webhook**：每 connection 一稳定 endpoint；endpoint UUID 直接作为 `?token=` query 标识。管理 API 可重复读取同一 URL；无额外 token/hash、一次性原值、regenerate、轮换/吊销或 CAS。
3. **归属**：租户来自 token，Linear Team 来自 payload；新 unique `(teamId,integration,scopeType,scopeExternalId)`。connection 用于身份/组织检查，不作 Project 选择键。
4. **事件**：首版 `linear.issue.state_changed`，Delivery UUID 为事件 ID。只接受已知不同 from/to，In Review 用状态 ID，不用标签文本。
5. **注册**：扩展 `issue-core.ts` capability enum 和 registry 一次；后续 fixture 通过构造注入，不改 ingress/router。事件目录最多 256 types，filter 仅注册字段精确匹配。
6. **交付**：入口先回 200，后续全部异步；易失 inbox 有界，过载接纳前 503，200 后失败仅脱敏诊断并丢弃。只投递给 admission 时存在且仍有效的订阅；无 consumer ACK/offset/replay，8h 去重，不保证跨重启去重或可靠送达。
7. **部署**：同端口 custom Node/Next server、双端 ws、禁压缩；独立 server 构建，所有启动入口一并切换，不启用 standalone。`MYSTRA_PUBLIC_URL` 为新增部署级 HTTPS origin，明确拒绝从不可信 Host 推导。
8. **UI**：connection ready 后只呈现固定 URL 与复制操作；不出现创建、regenerate、轮换/吊销、event DSL、subscription 设置、Agent 按钮或 replay 控件。

理由、替代方案与来源见 [research.md](research.md)。完整 wire/HTTP/CLI 行为见 [contracts](contracts/event-protocol.md)，数据/事务见 [data-model.md](data-model.md)。

## Phase 0 / Phase 1 产物

Phase 0 已核验现有能力并选定认证、WS、composition root、存储和去重方案。修正了 spec 的 webhookId、045 reverse uniqueness、SecretProvider hash、SC-003 解析先后等不实断言。

Phase 1 已定义：持久/内存模型、双数据库约束、三个合同、验收步骤与原型交互范围。未改生产源码、依赖或数据库，未执行外部环境操作。

## Phase 2 实施顺序（非 tasks.md）

| 顺序 | 工作包 | 依赖与完成证据 |
|---|---|---|
| A | 工程评审 + shared-code 原型 | 先验证本计划的认证/部署/资源限额取舍；原型从 starter 开始，真实浏览器验证。未通过不得进 tasks |
| B | 共享 schema、capability、RDB 模型 | 合同冻结后实施；双 schema parity、stable endpoint identity、connection delete 同事务清理；旧 Integration/认证回归 |
| C | 同进程 server、固定 endpoint 管理、ingress/router | 依赖 B；fixture end-to-end 经真实统一入口与 ws，重启/队列/鉴权证据；所有启动路径切换 |
| D | CLI events 命令 | 依赖 B 合同，可在 C 期间用真实 fixture server 开发；最终必须接 C，不能停留 mock |
| E | Linear adapter + detail production 接线 | 依赖 B 和原型通过；共用 UI 模块、token 生命周期和精确 source 路由 |
| F | 集成验收与文档 | C/D/E 汇合；真实专用 Linear Issue、两个来源 fixture、数据库及旧 CLI 回归 |

可并行：B 冻结后 C(server/events) 与 D(agent-cli) 各自独立；E 的 Linear adapter 与 C 共享 integrations 目录，需串行或明确主集成 owner，不能同时修改 registry。packages/ui primitive 与原型属于 A 的共同所有权，不能复制解决冲突。最终 build/lint/全局验证由集成 owner 一次执行。

## 需求与验证对应

| 需求 | 实现边界 | 必需证据 |
|---|---|---|
| FR-001..006 | unified ingress + endpoint lifecycle + async inbox | 同路径两来源；暂停 worker 仍先收到 200；同步入口错误与异步解析丢弃分开验证 |
| FR-007..009 | shared schemas + minimal projection | envelope 缺字段/未知字段拒绝，来源 payload 不泄漏 credential/正文 |
| FR-010..015 | reverse unique + router/catalog | 并发 scope 冲突、跨租户、授权撤销、双订阅广播、duplicate、未知 filter |
| FR-016..019 | ws + CLI lifecycle | 主动出站、临时/永久错误、重连重订阅、stdout backpressure、SIGTERM 清理 |
| FR-020..022 | Linear adapter + shared detail | 已知状态变化、普通修改 ignored；五步 setup；固定 URL 重复读取/复制/权限 UI |
| FR-023 | durable context | PRODUCT + dated Constitution amendment 保留 callback/retry/offline/write-back 排除 |
| SC-001..010 | quickstart 分层验收 | 10s 从入口计时；core 零修改第二来源；所有错误不投递；固定 URL 跨刷新/重启稳定；真实 Linear 不用 fixture 冒充 |

每条新失败路径必须在运行时暴露明确结果：

| 失败 | 设计处理 | 未来验证 |
|---|---|---|
| token 被记录到 proxy/Sentry | 已接受（2026-09-17 Owner 决定），不脱敏、不验证 | — |
| 相同 webhookId 的新事件被吞 | 使用 Delivery ID | 同 webhookId 两个不同 delivery 均送达 |
| 两个 Project 抢同 Team | database unique + 409 | 并发 PUT，旧绑定不丢失 |
| cookie/exec code 混入 events | 显式 Bearer human session 类型鉴权 | 凭据矩阵拒绝 |
| 成员删除/Team 归档/active Team 切换 | 撤权或归档只关闭目标 Team 连接；切 active Team 无影响；session 失效关闭全部 | 同一 session 双 Team 并发订阅与选择性撤权 |
| Next/server 各有一张 Map | root 统一拥有数据面 | 生产构建后的真实 webhook→CLI |
| DB 超时 | 入口 503；200 后 worker 丢弃诊断；订阅认证故障 1011 | 故障注入，不能使用 stale auth 或追改已发 HTTP |
| inbox/去重表/发送队列饱和 | inbox 接纳前 503；去重表满异步丢弃；慢连接独立关闭 | 容量、内存和未 settle I/O 槽位均有界 |
| SIGTERM/stdio EPIPE | cancel timer/close/terminate | 子进程退出、server 订阅归零 |
| worker 暂停/崩溃/迟到回调 | HTTP 不等待；取消后禁投递，已确认事件允许丢失 | 屏障证据、退出清理、新订阅不收 backlog |

验证执行步骤在 [quickstart.md](quickstart.md)；本次仅运行文档静态验证，不声称上表运行用例已经通过。

## NOT in scope

- Linear signing-secret 设置：Owner 已选择 capability URL，安全代价已记录。
- 独立订阅身份系统/长期 Agent token：复用现有 human session；后续委托另案。
- Redis、可靠队列、offset/replay、离线补发：本轮仅在线传输。
- 新 Nexus/relay、独立 WS 服务：同进程扩展既有 server。
- GitHub/GitLab 真实 webhook：只测试第二 fixture integration 的通用性。
- DSH 插件、Session Append、飞书 Thread、Spec 发布、Issue write-back：属于后续 Issues。
- Task/Session/Workflow 自动动作、历史事件产品：事件接收不等于执行授权。
- 全局 Project ACL/多 repo/外部 snapshots：现有 Team 资源授权与项目模型不重构。

## Complexity Tracking

| 复杂性 | 必要原因 | 更简单选项为何不足 |
|---|---|---|
| custom Next server | 单进程 WS Upgrade + ingress 内存直投 | App Router 无该 Upgrade 控制；独立进程需额外 IPC |
| 新 endpoint metadata 表 | stable endpoint UUID + exact connection 生命周期 | 固定 URL 可重复读取；connection 删除同事务失效 |
| source reverse unique | 保证已批准 Team→Project 一对一 | 045 只有正向 unique；广播会改变产品合同 |

无新增服务、平行身份模型或消息中间件。高风险扩展已记录 GitNexus CRITICAL 结果；这不是绕过评审的豁免。

## Review Gate

| 门禁 | 状态 | 证据/后续 |
|---|---|---|
| 源码/官方资料研究 | 完成 | research.md |
| 技术计划与合同静态检查 | 本轮执行 | 见交付核验输出 |
| FR-023 窄边界 amendment | 已落地 | PRODUCT / Constitution 2.17.0 |
| plan-eng-review | CLEAR（计划级） | 独立 session 全量+两次定向复核；9 项处置完成，Owner 接受全局容量隔离限制 |
| shared UI prototype | 已通过 | 原型已实现并完成浏览器验收，见 prototype.md |
| 生产端到端与真实 Linear | 未执行 | 实施后的 quickstart |

结论：工程计划评审通过，下一步进入共享代码交互原型与浏览器验收；**原型通过前不可进入 tasks，不能宣称实现完成**。

## GSTACK REVIEW REPORT

| Review | Trigger | Runs | Status | Findings |
|---|---|---|---|---|
| Eng Review | `plan-eng-review`，独立 session | 1 全量 + 2 定向 | CLEAR | 原 9 项全部处置；未解决工程决定 0、blocker 0 |
| Shared UI Prototype | 项目必需门禁 | 0 | NOT RUN | route 尚未实现 |

独立报告与主会话核验：[eng-review.md](eng-review.md)。Owner 明确决定立即应答、复用人登录并按目标 Team membership 授权、保留全局容量上限；不新增专用凭据或单来源配额。未运行额外跨模型 outside voice。未找到预期 gstack review-log helpers，canonical Spec-Kit 记录为本轮评审状态来源，不伪造全局 dashboard。共享 UI 原型仍是单独门禁。
