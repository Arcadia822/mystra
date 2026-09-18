---
title: "058 研究：现有能力、技术取舍与规格勘误"
taco_scope: plan
status: proposed
---

## 证据范围

2026-09-16，仓库 HEAD/index commit `90a04d3`。仅源码、官方文档和索引研究；未连接真实 Linear、未运行 WS 原型或部署服务。本文的 Decision 是供工程评审的技术方案，不是已实现事实。

工具链核验：`fnm exec --using 24.14.0 corepack pnpm gitnexus:doctor` 成功（Node 24.14.0、GitNexus 1.6.9、native lbug 加载）；`gitnexus:status` 索引 commit 与 HEAD 一致。索引分析时分支名为 main，不因当前 058 文档分支名称不同重建。当前工具面未暴露 GitNexus MCP resource/tool，使用仓库精确 pin 的 `pnpm exec gitnexus query/context/impact --repo mystra`，不声称运行过 MCP。

## 1. 已存在什么

| 现有代码 | 已实现事实 | 本设计处理 |
|---|---|---|
| `integrations/registry.ts` / `types.ts` | 编译期 plugin 列表、repositories/issues capability 一致性校验 | 一次性增加 events，保留现有 GraphQL/provider 路径 |
| `packages/shared/src/issue-core.ts` | capability enum 只有 repositories/issues | 扩展 enum，不能把 integrationDescriptorSchema 当作动态插件加载器 |
| `integrations/linear.ts` | 内置 Linear GraphQL IssueProvider | 保留，不替换成 linctl |
| `integrations/linear-api-key-service.ts` | exact connection、API key secret 生命周期、`connectionConfig.workspaceId` | 新 endpoint 关联现有 connection，组织信息复用已验证 metadata |
| `integrations/project-issue-sources.ts` | Project/source/connection tenant 检查、Team 验证、原子替换 | 补反查与反向唯一，不能重建 Project 模型 |
| 两套 `prisma/*/schema.prisma:66-83` | source 仅 `(projectId,integration)` unique | 新增 tenant+scope unique，不假称 045 已保证反向 1:1 |
| `auth/session.ts`、`auth/service.ts` | Bearer/cookie AuthSession、随机 token hash、30 天 human session、停用/到期校验 | 订阅复用 Bearer AuthSession；webhook 不复用 secret token 模式，直接使用稳定 endpoint UUID |
| `rbac/index.ts`、`rbac/permissions.ts`、RdbProvider.getTeamContext | 管理路由使用 active Team；另有按 userId + teamId 查询有效 Team/membership 的能力；权限判定可独立复用 | events 复用显式 Team membership 查询和权限，不把管理选择当授权边界 |
| `scripts/operator-cli.mjs` | version 1 operator session 文件、0600、目标服务一致性、Bearer HTTP | events 客户端只读复用，不加第二种登录/credential store |
| `packages/agent-cli/src/cli.ts/client.ts` | execution-code HTTP workload 命令 | 新 events 分支独立认证，既有命令不变；没有可复用的 WS 重连实现 |
| `apps/control-plane/package.json`、`next.config.ts` | Next dev/build，未启用 standalone，无 custom server | 新增同进程 server entrypoint，完整覆盖 dev/build/start/deploy |
| `scripts/deploy-dev-machine.sh` | systemd 直接运行 next dev，明文 3000 | 切到统一入口；公网 TLS 是部署验收前置，不假设当前已满足 |
| `linear-integration-detail.tsx`、`setting-row.tsx` | 现有 detail 和 app-local SettingGroup/SettingRow | 先把所需 setting primitive 移入 packages/ui，再做共享 webhook 区块 |

表中 integrations/auth/rbac 的路径前缀为 `apps/control-plane/src/lib/`；UI 前缀为 `apps/control-plane/app/_components/`。

## 2. 认证选择

**Decision**：首版订阅复用 human AuthSession 的 Bearer presentation，绑定显式 Team，读取既有 operator session file。不新增 SubscriptionCredential，不借用 execution code。

**Rationale**：Owner 选择复用人的登录，明确一人可属于多个 Team。现有 operator Bearer 身份可复用，`getTeamContext(userId, teamId)` 已按指定 Team 校验 active Team record 与 active membership；结合 `requirePermission` 即可独立鉴权，不需要新凭据，也不依赖 session.activeTeamId。事件路由限制只读订阅不意味着 human token 本身被缩成只读。

**Alternatives**：专用 Project allowlist token 安全范围更窄，但需要 issuance/revocation/expiry/权限交集的额外合同，当前目标没有要求独立长期 Agent 身份；execution code 明确禁止；Cookie-only WS 有跨站握手风险，首版不支持。

**Consequence**：同一登录可在连接配额内同时订阅多个授权 Team（每连接一个显式 Team），切换 active Team 不断开；成员撤销只影响相应 Team，退出登录/账号失效影响全部。原计划与首轮 reviewer 把 active Team 选择误当作 human session 的固有限制，现已撤销。仅改 events 授权组合，不改现有管理路由，不默认把 human token 注入 workload。

**源码证据**：`RdbProvider` 已提供 `getTeamContext(userId, teamId)`（rdb-provider.ts:637）；`PrismaRdbProvider` 实现检查指定 Team 与 membership 均 active 并返回 role（prisma-provider.ts:3294-3302），不使用 session.activeTeamId。无需新增 membership 表或平行身份模型。

## 3. Transport 与 server 生命周期

**Decision**：`ws` 8.x（实现时作为精确 direct dependency 锁定已审计 patch）承担 server/client；协议固定为 WS。新增 `apps/control-plane/server.ts` composition root：同一 HTTP server 直接接收 webhook、catalog 与 WS Upgrade；其余路由交 Next。EventRuntime 实例由 root 显式注入三条事件通路。

**Rationale**：subscribe/unsubscribe 双向控制、鉴权 Upgrade、心跳和 backpressure 是一条 WS 连接的正常能力。原生 Node WebSocket 的标准构造接口不提供这里需要的自定义 Authorization header；不能为省依赖将 session token 放到 URL。SSE + 独立 mutation API 需要第二套连接/订阅身份和控制顺序，未优于当前方案。

**重要限制**：不要把新 webhook handler 放进 Next 编译后的 App Route，同时寄希望源码 server import 的 Map 自动共享。即使同 OS 进程，Next bundling/HMR 也可能得到不同模块实例。root 直接处理事件数据面，保证一个显式 EventRuntime；普通 Next 管理 route 只读写 RDB 的 endpoint 生命周期，不依赖这张 Map。

**部署**：custom server 经独立构建（采用仓库已有 esbuild 工具链，新增明确 direct dev dependency），外部化 Next、Prisma/native modules，打包内部 TS/path alias。保留 Next webpack build 与 generated Prisma assets，增加生产 start；不启用 `output: standalone`。dev 仍由同一入口调用 Next dev 并委托 HMR upgrade，不能保留一个绕过事件入口的默认 dev 命令。修改 dev 部署脚本和预览启动点，不新增服务或端口。

**Rejected**：独立 WS 进程需要 IPC/转发边界，不能靠相同 import 共享内存；Redis/持久队列违反本轮边界。同进程有界易失 inbox 仅用于立即应答与异步处理解耦，不属于持久队列。纯 App Route 不能直接承载该 Node Upgrade 合同。

## 4. Webhook capability URL

**Decision**：一 connection 一稳定 endpoint，服务端 UUID 直接作为 `?token=` query 标识。管理 API 可重复读取固定 URL；不新增 verifier/hash、一次性原值、regenerate 或轮换/吊销。

**Rationale**：Owner 明确 webhook 是安装/配置后获得的固定 URL，endpoint 本身已与 exact connection/tenant/integration 绑定；额外 secret 生命周期只增加数据库、API 与 UI 状态而不提供本版需要的产品价值。

**Owner 已确定**：不使用 Linear signing secret。token URL 的持有人可伪造事件，这一风险不因 Zod/organization 字段检查而消失。只读事件传输不得隐式触发 Task/Agent 执行。

**URL 安全**：针对现有代码与环境配置的检索未找到对应受信公网 origin 设置；本计划新增部署级 `MYSTRA_PUBLIC_URL`，不属于用户五步 setup 的额外步骤。不得用 Host/Forwarded 拼 URL。公网 HTTPS 与 one-time UI disclosure 是真实验收条件。token 以 query 参数承载并进入日志为 Owner 已接受行为（2026-09-17），无脱敏要求。

## 5. Team 归属与状态语义

**Decision**：tenant 从 token connection 得出；scope 从 payload 得出。新增 `(teamId,integration,scopeType,scopeExternalId)` unique，反查唯一 Project，不用 connectionId 作 Project 选择键。payload organization 必须与 token connection 及 source connection 的 verified workspaceId 一致。

**Rationale**：用户确认一对一，现有代码只有单向约束。不采用研究中的“对多个 Project 广播”备选，因为那改变了已批准产品边界。两个 Mystra Team 可以各自关联同一个外部 Team，彼此授权隔离。

**状态**：只从 update 的 `updatedFrom.stateId` 与 `data.stateId` 产生状态变化，必须已知且不同；缺 Team、缺旧值、普通编辑不猜测、不回源补旧值。首次真实验收必须包含官方 Issue webhook shape 核验，尤其 `data.teamId/stateId/updatedFrom`；本次未声称已拿到该部署的实际 payload。

## 6. 去重、限流与失败边界

**Owner correction**：收到事件立即返回，后续全部异步。原计划把解析/归属/去重/订阅匹配放在 HTTP 200 前，属于设计错误；原 F-1“给后续处理分配秒数”的讨论撤销，不以缩短 body timeout 代替架构修正。

**Decision**：入口仅验证 token/connection/capability、接收有界 body 并接纳到 EventRuntime 易失 inbox，立即 `200 {"received":true}`；后续 worker 执行 parse/source/dedup/auth/dispatch。inbox 排队+处理中 256 条/16 MiB、4 worker、从接收起 10 秒过期；接收侧另限 1 MiB/32 并发/4 秒入口保护。以上为待实现容量合同，不是测量结论。

**Failure boundary**：inbox 满在接纳前 503；JSON/schema/组织/worker DB/去重表满在 200 后只能脱敏诊断并丢弃。不返回业务 outcome、不改写既成 HTTP、不引入内部 retry。shutdown 丢弃未完成 inbox，已确认事件可能丢失；这是不持久化的代价。

**Dedup/online-only**：Linear-Delivery 为 providerEventId，8h/100,000 key，reserve 后失败仍保留，不驱逐有效 key。admission 捕获 subscription generation 上界，新订阅/重连不接收 backlog；当前授权必须复查。socket/stdout 各 256 帧/1 MiB，心跳 30s/pong10s，重连 full-jitter1–30s 不变。

**Rationale**：Linear 要求 HTTP 200/5 秒，回复是接收确认而非业务结果。真实验收必须用暂停 worker 的屏障证明先收到 200；不能只用“通常处理很快”来掩盖同步耦合。未 settle 的底层查询仍占 worker slot，避免超时后继续创建无限 I/O。

## 7. GitNexus blast radius

实际命令：

```sh
fnm exec --using 24.14.0 corepack pnpm exec gitnexus query 'LinearApiKeyConnectionService ProjectIssueSource authentication' --repo mystra --limit 4
fnm exec --using 24.14.0 corepack pnpm exec gitnexus context defaultIntegrationRegistry --repo mystra
fnm exec --using 24.14.0 corepack pnpm exec gitnexus impact IntegrationRegistry --repo mystra --direction upstream --limit 8
fnm exec --using 24.14.0 corepack pnpm exec gitnexus impact RdbProvider --repo mystra --direction upstream --limit 8
```

| 符号 | 图结果 | 重点直接依赖/受影响面 |
|---|---|---|
| IntegrationRegistry | CRITICAL；12 affected，7 direct，5 processes | defaultIntegrationRegistry、resolve-issue-scope、Integration catalog/Issue/repository routes |
| RdbProvider | CRITICAL；138 affected，51 direct，42 processes | API auth、workspace/task/workflow services，间接 auth login/register、connection routes、Runtime routes |

数字为当前图返回，不代表本功能将修改所有这些调用者。实现要采用窄 `Pick<RdbProvider,...>`、现有 provider/fixtures 更新、两 schema parity，避免为新 token 改旧 credential 语义。此前已向 Owner 报告 CRITICAL 风险。当前只改文档；实施前针对实际符号再运行 impact 与 LSP references。

## 8. 官方资料与适用版本

- [Linear Webhooks](https://linear.app/developers/webhooks)，2026-09-16 读取：公共 HTTPS；200 成功；5s timeout；1m/1h/6h retry；Linear-Delivery 为 payload UUID；updatedFrom 为旧值。签名部分只用于理解已接受的偏离，不照抄 signing-secret setup。
- [Next.js 16.2.6 custom server](https://raw.githubusercontent.com/vercel/next.js/v16.2.6/docs/01-app/02-guides/custom-server.mdx)：与本仓库 lock 对齐；custom server 不经过 Next 编译，不能与 standalone server 混用，存在优化/打包代价。
- [Next.js 16.2.6 output tracing](https://raw.githubusercontent.com/vercel/next.js/v16.2.6/docs/01-app/03-api-reference/05-config/01-next-config-js/output.mdx)：部署需保留 public/static 与所需 runtime assets，不把 `.next` 存在等同于可部署。
- [ws 8.18.3 README](https://raw.githubusercontent.com/websockets/ws/8.18.3/README.md)：noServer/handleUpgrade、Upgrade 前认证、ping/pong 和 permessage-deflate 内存代价。本计划两端禁用压缩。8.18.3 是研究样本，不直接宣称它是执行时最新安全版本；最终依赖 patch 由 implementation lock/audit 确认。

## 9. 规划修正与未获验证的门禁

已同步 spec：webhookId→Linear-Delivery；SC-003 解析阶段区分；SecretProvider hash 误述；一次展示优先于“随时重取”；045 反向唯一缺失；已归档远端 Team 不保证本地自动感知；bounded dedup 语义。

已按 FR-023 修订 PRODUCT，并在 Constitution 追加 2026-09-16 窄边界 amendment，保留历史及 callback/retry/offline/write-back 排除。无需改通用 spec/plan template；045 原文作为历史，本功能 data-model/spec 明确 supersede 其唯一约束范围，不为旧开发数据建立迁移。

下一门禁是工程评审与共享代码 UI prototype，不是生产编码。本次所有技术问题均给出推荐方案；部署公网/TLS、真实 payload、吞吐与客户端运行行为的验证在 quickstart 中明确标为未来实施证据，不能用本文代替。
