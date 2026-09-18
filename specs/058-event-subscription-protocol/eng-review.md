---
title: "058 独立工程评审记录"
taco_scope: plan
status: "工程评审通过；后续 Owner 简化已记录"
reviewer_session: "EngReview058Independent"
---

> 2026-09-17 supersession: Owner 后续将 webhook 模型简化为稳定 endpoint UUID query ID，可重复读取固定 URL；原 verifier/hash/一次性原值/rotate/revoke/CAS 与日志脱敏相关评审证据仅作历史记录，不再构成当前实现要求。共享 UI 原型现已完成。

## 主会话核验与当前门禁

用户要求独立 session，本轮由 `EngReview058Independent` 执行 1 次全量、2 次定向只读工程评审。原 9 项发现已修订或由 Owner 明确处置；定向复核未报告 blocker。当前工程计划门禁通过，共享 UI 原型与生产运行验收仍独立未完成。下方原始报告保留历史，不以其中过时措辞覆盖本页最新结论。

Owner 已纠正立即应答/后续全异步及一人多 Team 授权边界，并选择保留全局上限、不增来源配额。规范、模型、合同和验收已同步，未改生产代码或运行功能测试。当前仅允许进入共享代码原型阶段，不能跳过原型直接生成 tasks。

主会话已复核 RBAC、operator session reader、部署脚本及当前合同。需要纠正 reviewer 的以下表述：

- 原报告失败模式图不仅 parse 顺序错误，还把业务处理放在应答前，现已整体废弃。当前合同为 token/完整接收/有界接纳 → 立即 200 → 异步 parse/source/dedup/auth/dispatch；下方原始报告只保留历史，不可用于实施。
- “auth DB 无压力”只计算 heartbeat，未计逐事件、逐订阅授权成本；未经运行测量，不作为容量结论。
- F-1 的“缩短读取、给后续处理留预算”提案已撤销。Owner 要求的是立即应答与后续处理解耦；4 秒只保留为接收保护，不等待业务完成，不采用 2 秒读取提案。
- F-3 只能证明 `deploy-dev-machine.sh` 的 systemd 模板使用 `next dev`，未检查真实生产机器，不能据此断言当前生产部署状态。
- F-8 的 ignored→accepted 不违反“至多投递一次”，第一次 ignored 没有投递；它仍是有价值的去重顺序测试。
- 原报告维度统计有交叉与遗漏，唯一发现总数以 F-1..F-9 为准，不将维度行相加。

## 待决与处置清单

| 发现 | 当前处置 |
|---|---|
| F-1 请求时限 | 被 Owner 的“立即应答、后续异步”决定取代；已修订，独立定向复核另记 |
| F-2 active Team 限制 | Owner 选择复用人登录并纠正多 Team 边界；已改用 getTeamContext(userId, requestedTeamId)+权限判定，切 active Team 不影响订阅 |
| F-3 production-build 验收 | quickstart 已明确 production build 下真实 Linear→CLI 全链路及 dev 对照；运行证据留待实现 |
| F-4 单来源并发隔离 | Owner 选择 4A：保留全局上限，接受繁忙来源占用容量的风险，不加来源配额 |
| F-5 压缩请求错误码 | 已明确同步 415 WEBHOOK_UNSUPPORTED_MEDIA_TYPE |
| F-6 token connection 归属措辞 | 已统一为 connection 级 |
| F-7 session 文件防 symlink | 已明确为 events reader 新增保护，要求同一文件句柄检查/读取，不误称既有能力 |
| F-8 绑定前后重复 delivery | 已补异步 ignored 不占 key 用例；HTTP 两次均只表示 received |
| F-9 stdin EOF | 已明确文件重定向读完即退出，长驻需保持 writer 打开或省略 control-stdin |

## Owner 纠正后的合同增量

- HTTP 200 固定 `{"received":true}`，不返回 accepted/duplicate/ignored；JSON/schema、归属、去重与投递均异步。
- 有界易失 inbox：拟定 256 条/16 MiB（含处理中）、4 worker、10 秒过期；这些数字是技术设计值，非 Owner 给出的容量或实测。
- inbox 满在确认前 503；200 后失败、退出或崩溃可丢失已确认事件，仅脱敏诊断，不追改响应、不加内部 retry/持久化。
- admission 捕获订阅 generation 上界，禁止新订阅/重连收到 backlog；worker 仍复查当前权限与 endpoint revision。
- 用暂停 worker 的验收屏障证明先返回 200，再进行异步处理；未运行实际程序，不声称该验证已经通过。

## 独立 session 定向复核（立即应答修订）

`EngReview058Independent` 在同一独立 reviewer session 完成定向复核，确认 spec/plan/model/contracts/quickstart 的同步接纳与异步处理边界一致，原 F-1、F-5 已消解；没有报告本次修订的实质矛盾。该结论不代替剩余工程取舍或 UI 原型门禁。

两项非 blocker 观察已落实：过期清理由独立有界 timer 驱动，不依赖可能挂起的 worker，未 settle 任务继续占槽/字节；256 条与 16 MiB 为先到上限，验收分开测试。quickstart 增加四 worker 全挂起、计数与恢复场景。以上是合同静态复核，没有执行运行测试。

## Owner 对多 Team 身份的纠正

Owner 选择 2A（复用人登录），同时指出一人可属于多个 Team。主会话与首轮 reviewer 将管理界面的 active Team 选择误当成订阅的固有限制，这是错误推论，不是必须接受的身份体系取舍。

已核验既有 `getTeamContext(userId, teamId)` 能按显式目标查 active Team/membership 并返回 role；events 将复用该方法与权限判定，不调用 `resolveActiveTeam`。同一 session 在既有配额内可同时连接多个授权 Team；active Team 切换无影响，目标撤权只影响相应连接，session/user 失效关闭全部。无需专用凭据、额外登录或新表；其他管理路由保持原语义。

## 最终工程门禁结论

独立 reviewer 第二轮定向复核确认多 Team membership 授权、catalog/stream 一致性、身份与目标成员失效分类、F-3/7/9 处置均自洽，无 blocker。其补充的 429 处理已写入协议/CLI，强制改密码检查已明确保留；角色降级但权限仍有效继续连接的场景已纳入验收。F-4 已获 Owner 明确选择。

- Scope：不扩大，复用现有 human 身份与指定 Team membership 查询。
- 原 9 项：全部处置；待决工程选择 0；未解决 blocker 0。
- 工程评审：CLEAR（文档级，不是实现/运行验收）。
- 原型：未实现，仍阻止 tasks；下一步为共享代码交互原型及浏览器验收。
- NOT in scope：单来源配额本轮不做；专用订阅凭据、持久队列、retry/replay 和 Agent 自动动作仍排除。

## 独立 session 原始报告（保留，以上核验注优先）


评审人：独立会话，非计划作者。对象：specs/058-event-subscription-protocol/ 全部 canonical Markdown（spec/plan/research/data-model/quickstart/prototype/contracts/requirements checklist，排除 Taco）+ 相关源码核验。日期 2026-09-16，HEAD commit 90a04d3（research.md 自报一致）。

## 结论（Scope Verdict）

**范围判定：通过（scope accepted as-is），工程结论：可实施，无 Blocker；9 项发现（0 blocker / 3 improvement-P2 / 6 question-improvement-P3）。** 计划对既有源的核验陈述（capability enum、RBAC active-Team 相等、AuthSession hash 模型、045 唯一约束缺失、SecretProvider 可逆性、operator session 格式、systemd `next dev`）经抽查全部与源码一致，无虚构。UI 原型与真实运行证据尚未发生，文档自身已如实声明，不构成评审发现。

- **工程结论（verdict）**：技术计划自洽、边界克制、合同可测，可在完成 P2 改进后进入 tasks 门禁前置流程。
- **原型门禁（prototype gate）**：独立于工程结论，`/event-subscription-protocol` route 未实现、浏览器验收未执行，门禁未通过；不因本评审通过而降低。

## 维度统计

| 维度 | 发现数 |
|---|---|
| 范围挑战 | 0 blocker（1 条过度抽象疑虑已判定为合理） |
| 架构 | 2（P2×1，P3×1） |
| 代码质量/合同一致性 | 4（P3×4） |
| 测试/失败模式 | 1 关键缺口未发现；1 补充用例（P3） |
| 性能边界 | 2（P2×1，P3×1） |
| NOT in scope | 已成文，逐条有理由 |
| 复用清单 | 已成文（见下） |

## 编号发现（blocker / improvement / question 分类）

### F-1（improvement, P2）4 秒正文读取期限在 Linear 5 秒超时下无余量
- 依据：contracts/webhook-and-integration.md「单请求读取期限 4 秒」+ plan.md「Webhook HTTP 成功响应目标小于 4 秒（Linear 超时为 5 秒）」。
- 场景：慢速/大 body 的合法投递消耗接近 4s 读取，再加 token 查询（RDB）、source 解析（第二次 RDB）、去重与入队，总时间可越过 5s → Linear 判失败重试（1m/1h/6h）→ 放大 ingress 负载并可能触发 32 并发饱和的 503，形成重试风暴。
- 建议修复：读取期限降到 2s（1 MiB/2s ≈ 512 KiB/s，远高于真实 webhook 尺寸），或在 4s 总预算中给处理阶段显式保留 ≥1.5s。
- 替代：维持 4s 但把「接收成功响应」提前到 parse 完成后即返回（现状即如此），并加压测证据证明 4s 读 + 处理 < 5s。选前者，成本一行、消除整类风险。

### F-2（question/tradeoff, P2）active Team 相等约束使单 operator 同时只能订阅一个 Team
- 依据：plan.md 决策 1、contracts/agent-cli.md「`--team` 必须等于登录 session 的当前 active Team…需要操作者明确选择新 Team 重启」。
- 核验：rbac/index.ts:20-26 `resolveActiveTeam` + rbac.test.ts:117-128 证明 requested≠active 即 forbidden，实现路径真实存在。
- 影响：owner 想同时看两个 Team 的 Issue 事件必须两个登录/两份 session file，或切换 active Team 杀掉现有连接。这是复用 human session 的直接代价，文档已写明。
- 问题：请 Owner 明确确认此取舍可接受；若不可接受，替代是专用窄权限订阅凭据（plan 已列 alternative，成本为 issuance/revocation 合同）。属用户决策，非缺陷。

### F-3（improvement, P2）当前生产 systemd 实际运行 `next dev`，统一 server 的「production start」是全新生产路径而非切换
- 依据：scripts/deploy-dev-machine.sh:81 `ExecStart=… pnpm --filter @mystra/control-plane exec next dev -H 0.0.0.0 -p 3000`。
- 影响：plan/research 说「所有启动入口一并切换」，但现状根本没有非 dev 的生产启动可切换。esbuild server bundle + `next build --webpack` 产物 + 同端口组合是第一次上生产化路径；research 已正确引用 Next custom server 不能与 standalone 混用、需保留 public/static assets（output tracing），风险已列。补充要求：quickstart 部署验收应显式加入「production build 下真实 Linear webhook → CLI 全链路」而不是仅 dev；quickstart 第 2 条已含 production build 要求 ✓，但建议再加「与 dev 行为逐条对照」避免两入口行为分叉。
- 另注：同 script 注入 `SENTRY_TRACES_SAMPLE_RATE=1.0` 与 `MYSTRA_ENABLE_DEBUG_ENDPOINTS=1`；token 脱敏验收已覆盖 Sentry，属既有部署状态，不算本计划引入。

### F-4（question/tradeoff, P3）全局 32 并发 ingress：单 token 洪泛可饿死其他来源
- 依据：contracts/webhook-and-integration.md「全 ingress 最多 32 个并发请求，饱和 503」。
- 场景：恶意或失控的一个 webhook token 持续占满 32 槽 → 其他合法 integration 的投递得 503 → Linear 重试加剧。有界且 fail-closed，故非缺陷；但 per-token（或 per-connection）并发配额（如每 token 8）可把故障域隔离，成本一个 Map 计数。
- 替代：接受全局配额（首版可接受，写入文档即可）。

### F-5（correction, P3）Content-Encoding 压缩请求的拒绝状态码未指定
- 依据：contracts/webhook-and-integration.md「拒绝 content encoding 压缩，避免体积限制被绕过」——未给出 4xx 码；同表 415 只定义给非 JSON Content-Type。
- 建议：明确 `415 WEBHOOK_UNSUPPORTED_MEDIA_TYPE` 或独立 code，避免实现时自造。

### F-6（correction, P3）spec Key Entities 残留「integration 级或 connection 级」token 表述
- 依据：spec.md Key Entities「Webhook Endpoint Token: integration 级或 connection 级的 capability token」vs data-model.md「只新增 connection-bound IntegrationWebhookEndpoint」与 webhook 合同「一 connection 一 endpoint」。
- 影响：spec 是 superseded 语义残留，会让后续读者以为 integration 级 token 仍在选项内。建议在 spec 该实体下加一句「plan 阶段已收敛为 connection 级」。

### F-7（correction, P3）CLI 合同对 session file 的要求超出既有 operator store 实际保证
- 依据：contracts/agent-cli.md 要求「普通文件、权限不超过 0600、不跟随 symlink」；scripts/operator-cli.mjs createSessionStore（:60-63）仅保证 mkdir 0700 + write/chmod 0600，无 symlink 检查（open-by-path 会跟随）。
- 影响：「只读复用现有 store」表述轻微夸大——symlink 防护是新增实现要求，需在 events client 侧读取路径加 `lstat` 判定，或在合同中标注为新增校验。否则验收矩阵里的该项会意外失败或被静默跳过。

### F-8（test-gap 补充, P3）同一 Delivery 在窗口内因 Project 绑定时机不同产生不同 outcome
- 依据：webhook 合同流水线顺序为 source/organization check → dedup reserve；无 Project 归属时 `ignored` 且不 reserve（dedup 只在 source check 之后）。
- 场景：用户完成五步前 Linear 已投递事件 A（200 ignored，未占 key）；数分钟后完成 step 5，Linear 因某种重试再投同一 Delivery → 这次 200 accepted 并投递。行为合理（甚至更优），但与「去重窗口内同一稳定事件 ID 至多一次投递」直觉表面冲突。
- 建议：quickstart 合同矩阵加一行「同一 Delivery：绑定前 ignored / 绑定后 accepted」的显式用例，防实现者把 reserve 提到 source check 之前造成相反的错误行为。

### F-9（question, P3）CLI `--control-stdin` 下「EOF 视为正常停止」语义
- 依据：contracts/agent-cli.md「有 flag 时 EOF 视为正常停止」。
- 场景：`mystra-agent events subscribe … --control-stdin < config.ndjson`（文件重定向）会在读完配置后立即退出，而非长驻订阅。这是 NDJSON 通道的自然语义，但对「从文件喂订阅」的使用方式是陷阱。
- 建议：文档一句话点明「stdin EOF 即停止，长驻订阅需保持管道打开（如 tail -f / 保持 writer）」，或在 CLI 中对「EOF 且无活跃期望订阅」与「EOF 且有活跃订阅」区分诊断输出。属文档澄清，非行为变更。

## 范围挑战记录

- `IntegrationEventCapability`（descriptors + requiredHeaders + parse/validate/match + schemas）针对首个真实事件类型 `linear.issue.state_changed` 是不成比例的基础设施。判定：**保留**。SC-002「第二 fixture 零修改接入」是 Issue #29 的硬性架构门槛，且该抽象把 Linear payload 语义隔离在 capability 内、router 无 `if integration === linear`，删除它会在验收时被迫回填。justified abstraction，不是 unjustified。
- 去重内存表、8h TTL、100k key、队列限额、心跳、退避全部是有界可测合同，无无限缓存；plan 自己标注「首版可测合同，不是压测容量声明」——诚实。
- 未见需要砍掉的范围。NOT in scope 清单（signing secret、专用订阅身份、Redis/replay、独立网关、GitHub/GitLab、write-back、Task 自动动作、全局 ACL）每条有一行理由，且四项排除被 SC-009 锚定为修订后必须显式保留——通过。

## What already exists（复用清单，全部经源码核验）

| 能力 | 位置 | 复用判定 |
|---|---|---|
| capability enum | packages/shared/src/issue-core.ts:105 `z.enum(["repositories","issues"])` | 计划扩展正确，research 描述准确 |
| registry 一致性校验 | apps/control-plane/src/lib/integrations/registry.ts:16-35 | 新增 events 需同步 actualCapabilities 构造——计划已列一次性扩展点 ✓ |
| Token 模式 | auth/session.ts:8-14 `randomBytes(32).base64url` + SHA-256 hex | webhook token 仿同模式 ✓（43 字符 base64url 与合同一致） |
| AuthSession | auth/service.ts:28（30 天 TTL）、:62-70 过期清理 | Bearer 复用成立 ✓ |
| RBAC | rbac/index.ts:20-52、permissions.ts:11/20 | `team.resource.access` 存在；`team.integration.manage` 存在（:9）✓ |
| 045 schema | prisma/{sqlite,postgresql}/schema.prisma（均 :80 `@@unique([projectId, integration])`） | research「两套均只有正向 unique」属实，反向 unique 确为 058 新增 ✓ |
| SecretProvider | secrets/rdb-secret-provider.ts:1,128-135 AES-256-GCM 可逆 | 「不能当 hash verifier store」陈述属实 ✓ |
| operator session | scripts/operator-cli.mjs:24,44-63（version 1、0600、token 正则） | 合同复用成立；symlink 检查缺失见 F-7 |
| Linear connection | integrations/linear-api-key-service.ts:136 `connectionConfig.workspaceId` | 组织一致性检查键存在 ✓ |
| 部署 | scripts/deploy-dev-machine.sh:69-88 systemd `next dev` | 见 F-3 |
| PRODUCT/Constitution | PRODUCT.md:229-246、constitution.md:94-95 amendment | FR-023 修订已落地 ✓ |

## 架构与代码质量评估

- **单进程 custom server**（plan 复杂度表第一行）：App Router 不暴露 WS Upgrade 控制，独立进程需 IPC 共享 EventRuntime——两个更简单选项确实不足。composition root 显式注入、防 Next bundling 双 Map 的告诫（research §3）是该平台最常见的坑，已正确预防。**通过**。
- **RDB 生命周期**：plan 明确「保留现有 instrumentation/RDB 生命周期；禁止二次初始化 SkillContentStore」——单例风险已点名。建议实施时对 `server.ts` 与既有 instrumentation 的初始化顺序写一行断言式测试（dev HMR 双入口是现实触发路径）。
- **auth DB 成本**：每心跳每连接一次 `resolveActiveTeam`（100 conn → ~3.3 qps）+ 每事件一次 token hash lookup + source 解析——SQLite/PG 均无压力。去重 100k×8h 内存约几十 MB 量级，有界。**通过**。
- **跨边界（consumer-side dispatch）**：新增 `events` capability 的消费点是 registry 一致性校验（registry.ts:19-35 硬编码 repositories/issues 数组）。计划已把它列为一次性扩展点，SC-002 把「漏改此处导致 fixture 注册即启动失败」变成 fail-fast 错误而非静默降级——方向正确，无静默丢弃路径。

## 测试/失败模式图与缺口

```text
Linear POST ─> admission(32并发/1MiB/4s) ─> token hash lookup ─┐
   401 未授权 / 503 饱和 / 408 读超时                          │ fail-closed
                                                              v
                              source 解析(teamId→唯一Project) ─┤ org mismatch→403
                                                              v
                              dedup reserve(8h/100k, 同步检查插入)
                                        │ duplicate→200 / 满→503
                                        v
                     capability parse (Zod 边界) ─> ignored(无team/未变/未知)
                                        │ events
                                        v
                     router: 订阅匹配 ─> per-sub queue(256帧/1MiB) ─> WS frame
                                        │                             │满→4410
                                        v
                     CLI stdout backpressure(256帧/1MiB) ─> 越界自断
```

失败模式逐条核对（合同已定义处理+验收用例的）：token 无效、超大 body、去重满、慢消费者、心跳超时、SIGTERM、DB fail-closed 1011、撤权清理——**均有测试归宿，无「无测试+无处理+静默」三无项**。缺口仅 F-8 一条补充用例。

## 性能边界结论

- 全部限额相互一致（plan Summary ↔ contracts 表逐值核对：100 WS、4/session、32 订阅、1 MiB、32 并发、16/64 KiB、256 帧/1 MiB、8h/100k、30s/10s 心跳、full-jitter 1–30s）✓。
- SC-001 10s 与 webhook 4s 目标在 F-1 修正后可达。
- 匹配复杂度 O(事件×订阅) ≤ 3200 次/事件（100 conn×32），内存匹配可行。

## 并行 lane 与依赖表（模块级）

| 步骤 | 模块 | 依赖 |
|---|---|---|
| A 评审+原型 | specs/, packages/ui, apps/spec-prototype | — |
| B schema/RDB | packages/shared, src/lib/db, prisma/* | A（合同冻结） |
| C server/ingress/router/token | apps/control-plane server.ts, src/lib/events, src/lib/integrations | B |
| D CLI events | packages/agent-cli | B（C 期间可用 fixture server） |
| E Linear adapter + detail UI | src/lib/integrations, app/_components | B + 原型通过；与 C 共享 integrations/ 需单 owner |
| F 集成验收 | 全仓 | C+D+E |

Lane：A → B → ‖(C, D)‖ → E → F。plan 的并行/串行约束（E 与 C 不同时改 registry、packages/ui 归 A 共同所有权、最终验证单 owner）与依赖表一致。**无冲突**。

## NOT in scope（本评审同样排除）

- 依赖版本升级审计（ws/esbuild 精确 pin 属实施期）；真实 Linear payload shape 核验（已列为验收前置）；DB reset/迁移操作；Taco 渲染产物；checklists/requirements.md 逐条评分（抽查无矛盾）；`MYSTRA_ENABLE_DEBUG_ENDPOINTS` 既有部署面。

## Completion Summary

- Step 0 Scope Challenge: accepted as-is（1 项抽象疑虑判定合理）
- Architecture: 2 issues（F-3 P2, F-4 P3）
- Code Quality/Contract: 4 issues（F-5/6/7/9 P3）
- Test Review: 图已产出，1 补充用例（F-8），0 critical gap
- Performance: 2 issues（F-1 P2, F-4 与架构共用）
- NOT in scope: written / What already exists: written
- TODOS: 不适用（spawned session，建议项已并入 F-1..F-9 由 parent 处置）
- Parallelization: 5 lanes, 2 并行段(C,D), 3 串行
- Verdict: **ENG PLAN CORRECT — 可进入 prototype/tasks 门禁序列；先处置 F-1/F-3，F-2/F-9 交 Owner 决策**
