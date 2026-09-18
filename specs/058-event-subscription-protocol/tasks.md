---
title: "058 Tasks:统一 Webhook 入口与 Integration 事件订阅协议"
taco_scope: tasks
status: proposed
---

# Tasks: 统一 Webhook 入口与 Integration 事件订阅协议

**Input**: Design documents from `specs/058-event-subscription-protocol/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 按 plan 测试策略生成:共享 schema/RDB 合同、ingress/订阅路由单测、server+CLI 子进程 smoke、真实 Linear 验收。每个 user story 附实现内测试任务。

**Organization**: 按 spec.md 用户故事分组;Phase 2 为阻塞性地基。所有 exported symbol 实施前 `lsp references` + GitNexus impact。遵循 pre-0.1 clean cutover:不写迁移兼容层;Prisma schema 变更直接改两套 schema 并重建本地数据(需授权)。

**Owner 简化(2026-09-17,已反映到全部文档)**: ready connection 获得固定 webhook URL；稳定 endpoint UUID 以 query 参数承载(`POST /api/webhooks?token=…`)并可重复读取；无额外 token/hash、一次性原值、regenerate、轮换/吊销、revision CAS 或日志脱敏。

## Path Conventions

- Control plane: `apps/control-plane/`(Next.js app + `src/lib/` 服务模块 + Prisma 双 schema)
- Shared contracts: `packages/shared/src/`
- CLI: `packages/agent-cli/src/`
- UI primitives: `packages/ui/src/`

---

## Phase 1: Setup

**Purpose**: 依赖与骨架就绪

- [x] T001 添加锁定精确已审计版本的 `ws` 依赖到 `apps/control-plane/package.json` 与 `packages/agent-cli/package.json`，并给 control-plane 添加 server build 所需 esbuild direct dev dependency；`pnpm install` 通过
- [x] T002 [P] 新建 `packages/shared/src/integration-events.ts` 文件骨架并从 `packages/shared/src/issue.ts`(或 index barrel)导出;typecheck 通过

**Checkpoint**: 依赖可安装,shared 新模块可被 control-plane 与 agent-cli 同时 import

---

## Phase 2: Foundational(阻塞后续全部 story)

**Purpose**: capability 扩展、RDB 模型、EventRuntime 核心数据面——所有用户故事的地基

- [x] T003 [P] 扩展 `packages/shared/src/issue-core.ts` 的 `integrationCapabilitySchema` enum 增加 `"events"`;更新 `apps/control-plane/src/lib/integrations/registry.ts` 构造一致性校验(`actualCapabilities` 数组)以纳入 events;全部既有测试回归通过
- [x] T004 [P] 在 `packages/shared/src/integration-events.ts` 定义 Zod schemas per `contracts/event-protocol.md`:事件目录(256 types/16 filters 上限)、Subscription/Unsubscribe 控制消息(`mystra.events.v1` 子协议)、NormalizedEvent envelope(FR-007 字段,`protocolVersion: 1`,strict);单测覆盖未知字段拒绝与未知版本拒绝
- [x] T005 在 `apps/control-plane/prisma/sqlite/schema.prisma` 与 `apps/control-plane/prisma/postgresql/schema.prisma` 同步新增 `IntegrationWebhookEndpoint` model per `data-model.md`(id/teamId/connectionId unique/createdAt/updatedAt；无 tokenHash/status/revision)并新增 `ProjectIssueSource` 的 `@@unique([teamId, integration, scopeType, scopeExternalId])`;`pnpm db:generate` + `db:validate` 双 schema 通过
- [x] T006 在 `apps/control-plane/src/lib/db/rdb-provider.ts` + `prisma-provider.ts` + `prisma-mappers.ts` 实现领域操作 per data-model.md:`getIntegrationWebhookEndpoint`、`getIntegrationWebhookEndpointById`、`createIntegrationWebhookEndpoint`(事务内校验 connection active/ready+teamId 一致；重复读取返回同一 id)、`resolveProjectIssueSourceScope`；扩展 connection delete 事务同事务清理 endpoint；SQLite/PostgreSQL parity 测试覆盖稳定 ID 跨重启、endpoint 主键/connection 唯一、删除失效、并发 source 冲突 409
- [x] T007 [P] 实现 `apps/control-plane/src/lib/events/event-runtime.ts`:有界易失 inbox(排队+处理中合计 256 条/16 MiB、4 worker、10 秒过期、取消 generation 阻止迟到结果)、同步接纳/异步处理生命周期、shutdown 先停 admission 再取消 worker 丢弃 inbox;单测覆盖接纳上界 503、worker 暂停时 200 先行、过期记录不投递
- [x] T008 [P] 实现 `apps/control-plane/src/lib/events/dedup.ts`:内存去重(8h TTL、100,000 key 上限、tenant+integration+delivery+eventType 键、reserve/expire);单测覆盖表满丢弃、同 Delivery 不重复投递、重启清空

**Checkpoint**: RDB 合同与 EventRuntime 数据面就绪;`pnpm --filter @mystra/control-plane test` 全绿

---

## Phase 3: User Story 2 — 统一 Webhook 入口接收与分发 (P1)

**Goal**: token 鉴权、有界接收、立即 200、异步分发到 integration

**Independent Test**: 用 Linear fixture 与测试 integration fixture 分别 POST `/api/webhooks?token=…`;两者经同一 endpoint 正确分发;无效 token/未注册 integration/超限同步拒绝;暂停 worker 仍先收到 200

### Implementation for User Story 2

- [x] T009 [US2] 实现 `apps/control-plane/src/lib/integrations/webhook-endpoint-service.ts`:ready connection 首次读取时创建稳定 endpoint UUID，后续 GET 重复返回同一 `{endpoint,webhookUrl}`；URL 为 trusted public origin + `/api/webhooks?token=<endpoint.id>`；未 ready 返回 `WEBHOOK_PREREQUISITE_UNAVAILABLE`；无 POST/create/regenerate/hash/secret 生命周期
- [x] T010 [US2] 实现 `apps/control-plane/src/lib/integrations/types.ts` + `registry.ts` 的 events capability 注入:每个 IntegrationPlugin 可注册 webhook 校验/解析处理器、事件类型目录、过滤 matcher；在测试 helper 中新增只通过构造注入的 fixture IntegrationPlugin(不进入 production registry)，供 SC-002 目录/订阅/投递验证；不修改 ingress/router 核心
- [x] T011 [US2] 实现 `apps/control-plane/src/lib/events/ingress.ts` 与 `apps/control-plane/server.ts` composition root:Node HTTP handler 处理 `POST /api/webhooks?token=…`，按稳定 endpoint UUID 查表→connection active/ready 校验→allowlisted headers+原始 body 有界读取→EventRuntime 接纳→立即 200；无效/缺失 endpoint 401；未注册 capability 404；过载 503。root 唯一拥有 ingress/EventRuntime/WS，其他请求委托 Next，并保留 dev HMR Upgrade；在 `apps/control-plane/package.json` 增加统一 dev/build/start scripts 与 esbuild server bundle，外部化 Next/Prisma/native modules，禁止默认入口绕过 events
- [x] T012 [US2] 实现异步 worker pipeline(`src/lib/events/` 内):JSON/schema 解析(Zod 边界,不可信输入)→按 payload Linear teamId 调 `resolveProjectIssueSourceScope` 解析 Project→dedup reserve→匹配订阅投递；处理/发送前复查 endpoint 与 exact connection 当前状态及 organization
- [x] T013 [US2] 实现管理 API route `apps/control-plane/app/api/integration-connections/[id]/webhook/route.ts`(GET only):既有 human session + `team.integration.manage` 权限；ready connection 返回稳定 URL，未就绪 409；`Cache-Control: no-store`；错误沿用 `error.code/error.message`
- [x] T014 [US2] 测试:ingress 集成测试(有效/无效/缺失 endpoint ID、未注册 integration、超限 body、重复 delivery、organization 不匹配、connection 删除后拒绝)；worker pipeline 单测；管理 API 覆盖重复 GET/刷新/模拟重启 URL 不变、`WEBHOOK_PREREQUISITE_UNAVAILABLE`、Member/跨租户 403；fixture IntegrationPlugin 共用同一路径完成 SC-002 零修改证明

**Checkpoint**: `POST /api/webhooks?token=…` 端到端(fixture)可用;SC-003 负向用例全部不投递

---

## Phase 4: User Story 3 — 多 Integration 事件目录与订阅契约 (P1)

**Goal**: 注册式 events capability,目录发现与按来源隔离的订阅匹配

**Independent Test**: 注册 Linear + 测试 fixture;目录返回各自事件类型与过滤能力;fixture 事件只投给 fixture 订阅,Linear 事件不串流

### Implementation for User Story 3

- [x] T015 [P] [US3] 实现 `apps/control-plane/src/lib/events/catalog.ts`:进程启动时从 registry 装配事件目录(256 types/16 filters 硬上限,重复或越界启动失败);`GET /api/events/catalog?teamId=<uuid>` route(Bearer human session,`getTeamContext` + `requirePermission("team.resource.access")`,显式 teamId,不用 activeTeam)
- [x] T016 [US3] 实现 `apps/control-plane/src/lib/events/router.ts`:内存订阅表(连接隔离 subscriptionId、单调 generation、projectId/integration/type/canonical filters);过滤仅声明字段字符串精确相等 AND;未知事件类型/未注册过滤字段明确报错;一个事件匹配多订阅广播不竞争;不硬编码 Linear
- [x] T017 [US3] 测试:目录上限与重复注册 fail-fast;两个来源同名事件不串流;未知 filter/事件类型报错;双订阅广播各一次;SC-002 核心零修改验证(fixture 经构造注入,ingress/router 无 diff)

**Checkpoint**: 目录发现与订阅匹配可用,与 US2 fixture 串联投递

---

## Phase 5: User Story 1 — 五步完成 Linear 配置 (P1) 🎯 MVP

**Goal**: Linear Integration Detail 内展示固定 webhook URL 并复制;反向唯一约束落地

**Independent Test**: UI 打开 Linear detail 看到可复制 URL(含 `?token=…`);粘贴到 Linear 后真实事件进入订阅投递;全程无协议级配置

### Implementation for User Story 1

- [x] T018 [US1] 实现 `apps/control-plane/src/lib/integrations/linear-events.ts`:Linear webhook payload 解析(Zod 边界,官方 schema 为准)→`linear.issue.state_changed` envelope(Delivery UUID 为事件 ID,状态 ID 判定 from/to,不识别可改名文本;普通修改 ignored 不伪造状态变化)
- [x] T019 [US1] 在 `apps/control-plane/src/lib/integrations/project-issue-sources.ts` 的 source PUT 路径接入新反向唯一约束:冲突映射 409 `ISSUE_SOURCE_SCOPE_CONFLICT`,旧绑定完整保留,竞争依赖 DB unique 不先查再写
- [x] T020 [US1] 先从 `apps/control-plane/app/_components/shell-settings.tsx` 提取 reusable Settings modal frame/nav/header 到 `packages/ui/src/settings-modal.tsx`，迁移 production `ShellSettings` 与 `apps/spec-prototype/app/event-subscription-protocol/settings-modal.tsx` 同时消费该实现并删除复制的 modal DOM/SVG glyphs；随后在 `linear-integration-detail.tsx` 接线固定 webhook URL 区块：connection ready 后 GET endpoint，每次打开/刷新展示同一个 URL + 复制按钮 + Linear 指引；未 ready 显示前置说明；无生成/regenerate/轮换/吊销入口
- [x] T021 [US1] UI 测试:更新 `apps/spec-prototype/app/event-subscription-protocol/page.tsx` mock 到稳定 endpoint query URL 形态并核对生产组件行为一致；真实浏览器验证重复进入/刷新 URL 不变、复制、未 ready 提示、Owner/Admin 与 Member 权限差异
- [x] T022 [US1] 测试:linear-events 单测(有效状态变化、普通标题修改 ignored、畸形 payload 丢弃、`Linear-Delivery` 为事件 ID);source 冲突 409 集成测试(双 Project 抢同 Team,旧绑定不变)

**Checkpoint**: 五步 setup 在真实浏览器可走通;SC-005/SC-009 前置(PRODUCT/Constitution 修订见 Phase 8)

---

## Phase 6: User Story 4 — 反向连接与事件订阅投递/CLI (P2)

**Goal**: `mystra-agent events` 经出站 WS 订阅并接收事件

**Independent Test**: CLI 用 operator session 订阅指定 Project;fixture 事件在连接存活时按匹配规则投递;断开清理,重连重订阅

### Implementation for User Story 4

- [x] T023 [US4] 实现 `apps/control-plane/src/lib/events/ws-transport.ts`:`GET /api/events/stream?teamId=<uuid>` Upgrade(ws,子协议 `mystra.events.v1`);Upgrade 前 Bearer human session 认证(`authenticateRequest`)+ `getTeamContext` + `team.resource.access`;拒绝 Cookie-only/endpoint query ID/execution code 作为订阅凭据;心跳(pong 超时断开)、每端发送队列 256 帧/1 MiB、慢消费者断开、控制帧与事件帧 16/64 KiB 上限;同 AuthSession 4 连接、每进程 100 连接、32 订阅/连接;断开清理全部订阅
- [x] T024 [US4] 实现 server 侧订阅控制流:subscribe(校验 Project 归属+权限+目录匹配,冲突/重复处理)→confirmed;unsubscribe→确认;投递帧含 generation 检查(admission 上界);每连接显式固定一个 teamId,同一 session 可多连接不同 Team
- [x] T025 [P] [US4] 实现 `packages/agent-cli/src/events-client.ts`:catalog 请求(HTTP)+ WS 订阅生命周期;session file 安全读取(0600、不跟随 symlink、同句柄校验);`--server` 与 session origin 一致性;退避重连+重提交期望订阅;永久错误不无限重试;SIGTERM 清理连接与 timer
- [x] T026 [P] [US4] 扩展 `packages/agent-cli/src/cli.ts` events 分支:`events list --team <uuid>`、`events subscribe --team <uuid> --project <uuid> --integration linear --event-type linear.issue.state_changed [--subscription-id id] [--filter k=v …] [--control-stdin]`;stdout 仅协议 JSON,stderr 诊断并明示在线模式/丢失窗口;不实现 Agent 启动或 Session Append
- [x] T027 [US4] 测试:server+CLI 子进程 smoke(真实 server、fixture webhook→CLI 收帧);认证矩阵(Cookie/execution code/endpoint ID 拒绝作为订阅凭据);成员撤销选择性关闭;双 Team 并发订阅;慢 stdout/慢 socket 断开;SIGTERM 后 server 残留订阅 0(SC-010);CLI stdout/stderr 不泄露 operator session token且数据/诊断可区分

**Checkpoint**: CLI 经真实统一入口订阅并收到 fixture 事件;断线重连语义符合 FR-013

---

## Phase 7: User Story 5 — 端到端真实链路验收 (P3)

**Goal**: 真实 Linear → server → 反向连接 → CLI 传输闭环证据

**Independent Test**: 专用测试 Issue 进入 In Review(按状态 ID),CLI 收到正确 Project/Issue/事件 ID;四类负向用例按约定处理

**Prerequisite**: T008/T014/T017/T022/T027 的测试全部回归通过后才执行本阶段。
- [x] T028 [US5] 按 `quickstart.md` 执行部署验收:production build 统一 server 启动(`MYSTRA_PUBLIC_URL` HTTPS origin)、哨兵凭据 401 验证、正常关闭清理;切换 `scripts/deploy-dev-machine.sh` 与 `scripts/preview-containers.mjs` 启动路径
  - 本机 production bundle 启动、`MYSTRA_PUBLIC_URL` 可信 origin 组装、哨兵 401、SIGTERM 清理、`deploy-dev-machine.sh` 启动路径切换均已验证(见 `evidence/e2e-local-run.md`);`preview-containers.mjs` 仅检查外部 preview 容器、不承载 Mystra 服务入口,故无需切换。真实 HTTPS 部署与反向代理验收待部署环境。
- [ ] T029 [US5] 五步真实 Linear setup 全流程(专用测试资源):真实 webhook → 200 → CLI 帧出现 <10s(SC-001);断线重连/server 重启/慢消费者场景记录丢失窗口;In Review 状态 ID 判定与普通修改不伪装
- [x] T030 [US5] 出具验收证据:输入/输出/版本;不修改 MYST-4/MYST-8 业务状态;不把 fixture 冒充真实 Linear(SC-008)
  - `evidence/e2e-local-run.md` 记录本机端到端自动化验收(26/26);Linear 全程只读、未修改任何业务状态;该记录明确声明 webhook 由本机发出,不代表 Linear 公网投递已验收。

**Checkpoint**: SC-001..010 全部有对应证据或明示已接受项

---

## Phase 8: Polish & Cross-Cutting

- [x] T031 [P] 修订 `PRODUCT.md` out-of-scope(`webhooks`、`attempt-owned event subscriptions` 两条窄例外)并在 `.specify/memory/constitution.md` amendment-log 追加带日期条目;四项排除(通用 callback、重试 API、离线补发、Issue write-back)文本保留(SC-009);核对 FR-023
- [x] T032 更新 `apps/control-plane/src/lib/integrations/README.md` 与 5xP/`docs/` 相关条目:events capability、统一 ingress、`mystra-agent events` 命令、`MYSTRA_PUBLIC_URL`;刷新 `specs/spec-status.md`
- [x] T033 全仓最终验证:`pnpm -r typecheck && pnpm -r test && pnpm -r build`;`detect_changes` 核对变更面仅限预期模块;GitNexus impact 记录存档
  - 全仓 6 个包/应用 typecheck、test、build 全部通过。GitNexus analyze 因既有同名工作区冲突未能完成索引注册,变更面经 git status 与 diff 严格核验,仅限预期模块。

---

## Dependencies

```text
Phase 1 (T001-T002)
  └─> Phase 2 (T003-T008)  ← 阻塞全部 story
        ├─> Phase 3 US2 (T009-T014)
        │     ├─> Phase 4 US3 (T015-T017)
        │     │     └─> Phase 5 US1 (T018-T022)  ← E 包依赖原型通过(已完成)
        │     ├─> Phase 6 US4 (T023-T027)  ← T023/T024 依赖 US2+US3;T025/T026 仅依赖 Phase 2 合同
        │     └─> Phase 7 US5 (T028-T030)  ← 全部前序完成
        └─> Phase 8 (T031-T033)
```

- US2 → US3 顺序固定(目录/路由消费 ingress 产物)
- US1(UI 接线)与 US4(CLI)在 US3 后可并行,但 T018(Linear adapter)与 T010/T011 共享 `integrations/` 目录,由主集成 owner 串行或明确分工
- T025/T026 可在 T004 合同冻结后与 Phase 3 并行,最终必须接真实 server 验证(T027),不能停留 mock

## Parallel Execution Examples

- Phase 2 内:T003/T004/T007/T008 相互独立可并行;T005→T006 串行
- Phase 3 内:T009/T010/T011 部分并行(接口先冻结);T012/T013 依赖 T011
- Phase 6 内:T025+T026(CLI)与 T023+T024(server)两个所有者并行,通过 `hub` 协调合同点

## Implementation Strategy

- **MVP**: Phase 1–5(US2→US3→US1)= 统一入口+目录/路由+Linear 配置 UI,不含 CLI
- **增量交付**: 每个 Phase 结束跑该 story 的测试任务;禁止跨 story 大爆炸合并
- **简化已锁定**(2026-09-17 Owner):固定 endpoint UUID query ID、可重复读取 URL、无 token/hash/一次性原值/regenerate/CAS/日志脱敏——实现不得重新引入
