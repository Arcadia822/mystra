# 功能规格：统一 Webhook 入口与 Integration 事件订阅协议

**Feature Branch**: `058-event-subscription-protocol`
**Created**: 2026-09-16
**Status**: Draft（设计规格；本规格不含实现任务）
**Input**: Issue #29 / MYST-10 —— 核验 Mystra 现有事件接入能力并明确统一订阅协议；扩展现有 mystra-server 与 mystra-agent-cli，不另建 Nexus 服务或新 CLI。本轮仅实现 Linear → server → 反向连接 → CLI 收到事件，不包含 CLI → Agent 插件适配、飞书 Thread 更新、Spec 生成，以及 GitHub/GitLab Webhook 的实际接入。

**Owner Setup Requirement（2026-09-16 确认）**:
最终用户的 Linear 配置流程收敛为且仅需五步：

1. 安装/启用 Mystra 内置 Linear Integration。
2. 将 Linear API key 配置到 Mystra（现有 045 connection 流程）。
3. 在 Linear Integration 配置界面复制 Mystra 提供的固定 webhook URL，粘贴到 Linear（URL 以 query 参数携带服务端生成的稳定 endpoint ID；不使用 Linear signing secret）。
4. 在 Project 中选择 Linear 作为 Issue 源（现有 045）。
5. 设置该 Project 关联的 Linear Team（现有 045）。

五步完成后，事件接收与订阅能力全部就绪；用户无需理解或配置订阅协议、事件类型、过滤规则、消息中间件或 relay 服务。

**Supersession Notice**:

- 本功能修订 `PRODUCT.md` 与 Constitution 中 "webhooks" 与 "attempt-owned event subscriptions" 的 out-of-scope 条目：以最窄边界开放 **Integration Webhook ingress** 与 **Project 授权范围内的在线事件订阅**。通用 callback URL、重试 API、离线补发、持久消息队列、Issue write-back 仍为 out of scope，需另行修订。
- 本功能复用 045 的 connection/Issue source 字段与配置流程；新增 Mystra Team 租户内 Linear Team 到 Project 的反向唯一约束及冲突错误。webhook URL 是 Linear Integration Detail 的新增引导区块，不引入新的 connection 类型。
- 本功能不改变 `mystra-agent` 的 execution-code 安全模型；订阅认证是新的独立能力，不扩大 execution code 的权限。

## 源码核验结论（2026-09-16）

已实现（可复用）：

| 能力 | 位置 | 结论 |
|---|---|---|
| Integration 注册表 | `apps/control-plane/src/lib/integrations/registry.ts`（`IntegrationRegistry` / `defaultIntegrationRegistry`） | 支持多 integration 与 capability 声明（repositories / issues）；但 `defaultIntegrationRegistry` 构造列表与 capability allowlist 为硬编码，新增 `events` capability 及注册第二个 integration 需一次性扩展该构造路径 + `@mystra/shared` 的 `integrationDescriptorSchema`，不触及 ingress/订阅路由核心 |
| IntegrationPlugin 合同 | `apps/control-plane/src/lib/integrations/types.ts` | capability map 结构清晰，新增 `events` capability 不破坏现有字段 |
| Linear Integration | `apps/control-plane/src/lib/integrations/linear.ts`（`createLinearIntegration`） | 现有 GraphQL 只读 IssueProvider 保留；新增 token 鉴权后的 webhook 解析与事件转换，不验证 Linear signing secret |
| Linear connection 生命周期 | `apps/control-plane/src/lib/integrations/linear-api-key-service.ts` + `app/api/integration-connections/linear/api-key/` | API key 创建/替换/删除/teams 列表已完成，045 成果直接复用 |
| SecretProvider | `apps/control-plane/src/lib/secrets/rdb-secret-provider.ts` | 继续负责 Linear API key 的加密；webhook 随机 token 只需经 RdbProvider 保存校验哈希，不复用可解密 secret envelope |
| Project Issue Source | `specs/045-project-issue-sources/`（`ProjectIssueSource`，exact connection + Linear Team ID） | 持久化关联字段已存在；当前只有 `(projectId, integration)` 唯一约束，Linear Team 反向唯一与归属查询须由 058 补齐 |
| Team RBAC / 认证 | `apps/control-plane/src/lib/auth/`、`rbac/` | server→CLI 长连接的认证可复用现有 token/hash 模式（`createSessionToken`/`hashSessionToken`） |
| `mystra-agent` CLI | `packages/agent-cli/src/`（`AgentExecutionClient`、`cli.ts`） | 现有 execution-code HTTP 请求客户端；新增独立认证的 events 命令族与长连接，保持既有 workload 命令行为 |

待实现（本规格范围）：

- Integration `events` capability（事件类型目录 + 过滤能力声明 + 注册）；含 `defaultIntegrationRegistry` 构造路径与 `integrationDescriptorSchema` capability allowlist 的一次性扩展，此扩展不属于 ingress/订阅路由核心。
- 统一 webhook ingress route（token 校验 → integration 分发 → envelope 规范化）。
- 事件 envelope 契约（Zod shared schema）。
- server 订阅路由器（Project 归属解析 + 订阅匹配 + 投递）。
- CLI ↔ server 反向长连接（outbound WS）与订阅协议消息。
- Linear integration 的 webhook payload 解析与事件转换；不启用 Linear signing secret 验签。
- Linear Integration Detail 的 webhook URL 引导区块。

明确不存在（无需绕开）：

- 任何现成 webhook 接收端点、WS server、事件持久化或消息队列。
- Hookdeck/Nexus/Convoy 等外部 relay——不引入。

## User Scenarios & Testing

### User Story 1 - 五步完成 Linear 配置并自动具备事件能力 (Priority: P1)

作为 self-hosted Mystra 的 Owner/Admin，我希望按五步固定流程完成 Linear 集成配置——启用 integration、配置 API key、复制 webhook URL 到 Linear、Project 选择 Linear Issue 源、Project 关联 Linear Team——之后无需任何额外配置即可让 Mystra 接收 Linear 事件并供已授权订阅者消费。

**Why this priority**: 这是 Owner 对本功能最直接的验收面；任何要求用户理解内部协议的流程都算失败。

**Independent Test**: 全新安装上，仅执行五步（不触碰任何 CLI/订阅命令/环境变量），在专用测试 Linear Issue 上产生状态变化，已连接的授权订阅客户端在数秒内收到该事件。

**Acceptance Scenarios**:

1. **Given** Linear Integration Detail 已打开，**When** connection 就绪，**Then** 界面展示可直接复制的 webhook URL（含 opaque token），并给出"粘贴到 Linear Webhook 设置"的引导文案。
2. **Given** 用户将 webhook URL 配置到 Linear，**When** Linear 发送测试/真实事件，**Then** Mystra 统一入口接收、校验 token、路由至 Linear integration，事件进入订阅投递；全程无用户参与的配置步骤。
3. **Given** 五步全部完成，**When** 用户查看任何配置界面，**Then** 不存在要求用户配置事件类型、订阅规则、CLI 参数或 relay 服务的入口。
4. **Given** API key 或 connection 未就绪，**When** 查看 webhook URL 区块，**Then** 界面明确说明前置条件，不展示可用的 URL。

---

### User Story 2 - 统一 Webhook 入口接收与分发 (Priority: P1)

作为 Mystra 平台，我需要一个统一 webhook endpoint，按 token 识别来源、校验合法性、保留原始请求体，将平台相关的解析工作路由到对应 integration，使新增 integration 无需修改统一入口。

**Why this priority**: ingress 是事件链路的物理起点，归属解析、订阅投递全部依赖它；且"第二个测试 integration 可注册"是本验收的硬性架构要求。

**Independent Test**: 使用 Linear 真实 webhook 与一个测试 integration 的 fixture webhook 分别发送请求；两者均经同一 endpoint 正确分发，未注册 integration 的请求得到明确错误。

**Acceptance Scenarios**:

1. **Given** 携带有效 token 的完整 Linear webhook 请求，**When** 入口完成传输校验并接纳到有界内存 inbox，**Then** 立即返回 HTTP 200；Linear payload 解析、归属、去重及订阅投递在后续异步 worker 执行。
2. **Given** token 无效、缺失或 connection 已停用，**When** 请求进入，**Then** 在解析 payload 之前被拒绝，返回稳定错误码，不进入投递、不泄露内部信息。
3. **Given** 未注册 integration、传输畸形或超限请求，**When** 进入，**Then** 同步返回明确 HTTP 错误且不接纳。对已接纳后才发现的畸形 JSON/schema 或组织不匹配，异步丢弃并记录脱敏原因，不改写已返回的 200、不广播。
4. **Given** 同一事件被 Linear 重复投递（`Linear-Delivery` 相同），**When** 在去重窗口内进入，**Then** 依据稳定事件标识去重，订阅者不重复收到；同一 `webhookId` 的不同 delivery 不得互相去重。
5. **Given** 后续处理被测试屏障暂停，**When** 事件完成接收与内存接纳，**Then** HTTP 200 已返回且不含业务 outcome，解除屏障后才开始解析与投递；响应不等待任何订阅者或 Agent。

---

### User Story 3 - 多 Integration 事件目录与订阅契约 (Priority: P1)

作为未来 integration 的实现者，我希望通过注册方式声明本 integration 提供的可订阅事件类型与过滤能力，客户端可发现这些事件，使订阅协议不硬编码 Linear。

**Why this priority**: 这是 #29 验收中"不修改通用订阅协议即可新增 integration"的架构门槛。

**Independent Test**: 注册第二个测试 integration（fixture），验证其事件类型出现在事件目录中、可被订阅、可与 Linear 事件并存投递且不串流；其间统一 ingress 与订阅路由核心零修改（`events` capability 的 registry 构造与 allowlist 一次性扩展除外）。

**Acceptance Scenarios**:

1. **Given** Linear 与测试 integration 均已注册，**When** 客户端查询事件目录，**Then** 返回按来源区分的事件类型列表与各自支持的过滤能力，无命名冲突。
2. **Given** 订阅请求指定测试 integration 的事件类型，**When** 该 integration 的 fixture 事件进入，**Then** 订阅者收到该事件；Linear 事件不会投递给该订阅。
3. **Given** 订阅请求使用了 integration 未注册的过滤条件或未知事件类型，**When** 提交，**Then** 得到明确错误，不被静默忽略。

---

### User Story 4 - 反向连接与事件订阅投递 (Priority: P2)

作为 `mystra-agent-cli` 的操作者，我希望 CLI 主动向 server 建立出站长连接，在本身份被授权的 Project 范围内订阅、退订并接收 integration 事件，无需入站端口。

**Why this priority**: 依赖 Story 2/3 的协议先冻结；是端到端链路的最后一段实现。

**Independent Test**: CLI 经出站连接订阅指定 Project 的事件，fixture 事件在连接存活时按匹配规则投递；断开后订阅清理，重连后重新提交期望订阅。

**Acceptance Scenarios**:

1. **Given** CLI 以合法凭据连接，**When** 提交订阅（Project、integration、事件类型、过滤条件），**Then** server 校验 Project 归属与权限后确认订阅；未经授权的 Project 订阅被拒绝并给出明确错误。
2. **Given** 多个客户端对同一事件各有匹配订阅，**When** 事件进入，**Then** 按广播语义分别投递，不隐式竞争消费；各订阅标识相互隔离，客户端不能覆盖他人订阅。
3. **Given** 连接断开，**When** server 检测到，**Then** 该连接的在线订阅被清理；心跳超时、发送队列上限与慢消费者行为有明确实现与测试。
4. **Given** 网络断开，**When** CLI 重连，**Then** 自动重新提交期望订阅；首版为仅在线投递——断线窗口内产生的事件不补发，协议与文档必须明示这一点。
5. **Given** 事件按协议投递，**When** CLI 接收，**Then** 结构化事件数据输出与诊断日志可区分，供后续 Agent 插件消费；本功能不实现 CLI → Agent 插件适配。

---

### User Story 5 - 端到端真实链路验收 (Priority: P3)

作为功能验收者，我希望在专用测试资源上验证真实 Linear → server → 反向连接 → CLI 的完整链路，只证明传输闭环，不声称 Agent/飞书闭环完成。

**Why this priority**: 联调项，依赖全部实现子项；验收证据要求真实环境。

**Independent Test**: 在专用测试 Issue 上产生进入 In Review 的状态变化，目标 CLI 收到含正确 Project、Issue、事件 ID 与状态变化的事件；无效 token、无关 Team、重复 delivery 均按约定处理。不把伪造签名作为拒绝条件，因为本版未验证 Linear 签名。

**Acceptance Scenarios**:

1. **Given** 真实 Linear webhook，**When** 测试 Issue 状态变为 In Review（按状态 ID 判定，非可改名文本），**Then** 目标 CLI 收到该事件；已处于 In Review 的普通标题/描述修改不伪装为进入评审事件。
2. **Given** 断线重连、server 重启、慢消费者场景，**When** 验证执行，**Then** 行为符合协议约定，事件丢失窗口被明确记录。
3. **Given** 验收完成，**When** 出具证据，**Then** 包含输入、输出与版本信息；本地 fixture 不替代真实 Linear webhook 验收。

---

### Edge Cases

- **Webhook ID 暴露**：webhook URL 的 query 参数是稳定 endpoint ID，不按 secret 管理；它可以出现在 UI、日志与 access log。任何持有 URL 者均可投递事件，因此系统仍须在解析 payload 前验证 endpoint 存在、connection active/ready，并把 payload 当作不可信第三方输入处理。connection 删除后 endpoint ID 失效。
- **无签名验证的伪造风险**：本设计不使用 Linear signing secret，无法密码学证明发送方是 Linear。缓解：TLS、endpoint/connection 校验先于 payload 解析、事件数据按不可信输入处理（Zod 边界验证、不作为 HTML 或指令执行）。该风险在文档中明示，Owner 已接受。
- **归属解析失败**：payload 缺少 Team 信息的事件直接丢弃；teamId 未关联任何 Project 的事件不广播、不自动建 Project，记录可诊断原因。
- **重复与乱序**：稳定事件 ID 使用 integration 命名空间与 `Linear-Delivery`（官方定义的 payload 唯一 UUID），不能只用 webhook 配置的 `webhookId`。去重窗口内同一在线订阅不重复投递；进程重启或窗口结束后不承诺跨窗口去重。首版不修复乱序，协议包含发生与接收时间供消费者判断。
- **慢消费者**：每连接发送队列有上限；超过上限按协议断开该连接并清理订阅，不阻塞其他连接。
- **Linear Team 删除/归档**：payload 缺少 Team 或本地未关联时丢弃。045 不持久化 Team 归档状态，本版也不为每个 webhook 回源查询；不能承诺从仍携带已关联 Team ID 的 payload 推断远端已归档。显式移除 Project source 后的新事件不再归属该 Project。
- **In Review 判定**：以 Linear 状态 ID（provider-stable）判定，配置于订阅过滤条件；不使用可改名文本。已处于目标状态下的普通修改不产生"进入状态"事件——这要求 envelope 携带状态变化前后信息，Linear payload 无法提供旧值时该事件不伪装为状态变化事件。
- **server 重启/退出**：在线订阅和未完成的易失 inbox 全部丢失；已回 200 不意味着持久保存。客户端重连只恢复订阅，不补发队列事件；异步失败也不触发内部重试。
- **多 connection 同 Team**：token 所属 connection 确定 Mystra 租户及 integration，payload 的 Linear Team ID 在该租户内解析唯一 Project。connection ID 不作为 Project 选择键，但不得越过租户边界；组织标识必须与 connection 的已验证 Linear organization 一致。058 补齐租户内反向唯一约束，重复关联返回冲突，不任选一个 Project 或广播。

## Requirements

### Functional Requirements

**统一 Webhook 入口**

- **FR-001**: 系统 MUST 提供统一 webhook endpoint，所有 integration 的 webhook 请求经此入口接收，MUST NOT 为单个平台建立独立接收端点。
- **FR-002**: 统一入口 MUST 依据 URL query 参数中的稳定 endpoint ID 定位目标 integration 与其 connection，并在解析任何 payload 前完成 endpoint/connection 校验；无效 ID MUST 被拒绝且不泄露内部信息。
- **FR-003**: 系统 MUST 为每个 ready connection 创建一个稳定 `IntegrationWebhookEndpoint.id`，并以 `?token=<endpointId>` 组成固定 webhook URL。管理 API MUST 可重复读取并返回同一 URL；connection 删除时 endpoint 同事务删除并立即失效。本版 MUST NOT 实现轮换、吊销、regenerate、额外 token/hash/verifier、revision CAS 或日志脱敏。
- **FR-004**: 统一入口 MUST 有界接收原始请求体与 allowlisted headers；传输错误、超限、鉴权失败或内存接纳失败 MUST 同步返回明确错误。已接纳请求的 JSON/schema 与业务校验 MUST 异步执行，失败记录脱敏原因且不投递，不得伪造第二个 HTTP 结果。
- **FR-005**: Integration MUST 通过注册方式接入统一入口（提供验签/校验与 payload 解析处理器、可订阅事件类型与过滤能力声明）；新增 integration MUST NOT 要求修改统一入口或订阅核心。
- **FR-006**: 完成入口鉴权、完整接收和有界内存接纳后 MUST 立即返回 HTTP 200 `{"received":true}`；payload 解析、归属、去重、订阅匹配与投递 MUST 全部异步，HTTP handler MUST NOT 等待。成功仅表示易失接收，不含业务 outcome，不代表已处理或可靠送达；过载必须在接纳前拒绝，不得先确认再因队列满丢弃。

**事件契约**

- **FR-007**: 规范事件 envelope MUST 包含：稳定事件 ID、来源 integration、事件类型（按来源命名空间区分）、归属 Project（可解析时）、subject 标识（如 Issue external ID/identifier）、发生时间、payload 摘要（含状态变化语义字段）与协议版本号。
- **FR-008**: 事件 envelope 与全部订阅/投递消息 MUST 以共享 Zod schema 定义并在服务边界验证。
- **FR-009**: 第三方 webhook payload MUST 按不可信输入处理：边界验证、字段白名单、文本不解释为 HTML 或指令；解析失败产生稳定错误且不进入投递。

**订阅与投递**

- **FR-010**: server MUST 维护内存订阅并验证目标 Team 的当前成员身份、权限与 Project 归属。复用 human 登录身份，允许同一人同时订阅其有权限的多个 Team；MUST NOT 以界面/session 的 active Team 选择限制事件订阅或在切换时断开。每连接显式固定一个 Team，各连接隔离；成员撤销只影响对应 Team，身份/session 失效影响其全部连接。事件归属仍限定 webhook token 所属租户，Linear Team 反向关联在租户内唯一，重复关联返回冲突。
- **FR-011**: 订阅标识 MUST 按连接隔离；一个事件匹配多个订阅时 MUST 广播至各订阅，MUST NOT 隐式做竞争消费。
- **FR-012**: 连接断开或心跳超时 MUST 清理该连接全部订阅；server MUST 实现心跳、发送队列上限与慢消费者断开策略。
- **FR-013**: 首版投递语义 MUST 为仅在线、无 server 重投：不补发、不持久化事件队列；同一稳定事件 ID 在去重窗口内至同一在线订阅最多一次。异步 inbox 仅投递给接纳时已存在且发送时仍有效的订阅，不向新订阅/重连补发 backlog。断线、异步失败、进程退出可能丢失已确认事件，重启/窗口外可能重复；协议与 CLI MUST 明示风险，不宣称全局严格 at-most-once、可靠送达或 Agent 已处理。
- **FR-014**: 客户端 MUST 能发现已注册 integration 的事件目录（事件类型与过滤能力）；对未知事件类型或不支持过滤条件的订阅请求 MUST 返回明确错误。
- **FR-015**: 重复投递（同一稳定事件 ID 在去重窗口内）MUST NOT 重复送达同一订阅。

**反向连接（CLI ↔ server）**

- **FR-016**: CLI MUST 通过主动出站连接订阅事件，MUST NOT 要求客户端入站端口；连接认证 MUST 复用/扩展现有认证边界（session token 体系或专用订阅凭据），MUST NOT 扩大 `MYSTRA_EXECUTION_CODE` 的权限范围。
- **FR-017**: CLI MUST 支持订阅确认、退订、结构化事件接收；事件数据输出与诊断日志 MUST 可区分。
- **FR-018**: CLI MUST 在网络断开后按退避策略重连并重新提交期望订阅；认证失败、权限不足与非法过滤器 MUST 明确报错，MUST NOT 无限重试永久性错误。
- **FR-019**: CLI 进程退出 MUST 清理连接与订阅资源，MUST NOT 泄露凭据，MUST 保留既有命令行为。

**Linear Integration 接入（首个真实 integration）**

- **FR-020**: Linear integration MUST 实现统一入口要求的事件处理器：token 校验（由统一入口完成）后的 payload 解析、事件识别与 envelope 转换。
- **FR-021**: In Review 等状态变化的订阅过滤 MUST 以 Linear 状态 ID（provider-stable）表达；MUST NOT 以可改名文本判定。
- **FR-022**: Linear Integration Detail MUST 展示 webhook URL 引导区块（含复制操作与 Linear 配置指引）；URL 生成与展示 MUST 遵循 FR-003 的 token 约束。

**Product boundary 修订**

- **FR-023**: 实现落地前 MUST 修订 durable context 的边界条目，保持最窄开放（Integration webhook ingress + Project 授权范围内在线订阅），并保留 out-of-scope 条目（通用 callback、重试 API、离线补发、Issue write-back）。修订目标明确为：`PRODUCT.md` out-of-scope 中的 `webhooks` 与 `Attempt-owned heartbeat/event subscriptions` 两条；Constitution 相关决策 MUST 以带日期的 amendment-log 条目形式追加（沿用 Constitution 自身的修订机制），MUST NOT 自由改写既有历史条目。

### Key Entities

- **Webhook Endpoint**: connection 级稳定 endpoint，每 connection 至多一个；其 UUID `id` 直接作为 query 参数中的路由标识，可重复读取；持有 URL 即可投递，connection 删除后失效。
- **Integration Event Capability**: integration 注册时声明的事件类型目录与过滤能力描述；按 integration 命名空间隔离。
- **Normalized Event (envelope)**: 跨 integration 统一的事件结构（FR-007 字段）；非持久业务对象。
- **Subscription**: 连接身份绑定的内存态过滤器集合；不持久化；随连接生命周期存亡。
- **Subscription Connection**: CLI 与 server 间经认证的出站长连接；承载订阅控制消息与事件投递。
- **ReceivedWebhook**: 完整接收后放入有界内存 inbox 的易失记录；先回复接收，再异步处理；非持久业务对象。

## Scope

### In scope

- 统一 webhook ingress（token 鉴权、integration 分发、大小限制、错误语义）。
- Integration 事件 capability 注册契约与事件目录发现。
- 规范事件 envelope（Zod shared contract）。
- server 内存订阅路由与在线投递（含心跳、队列上限、慢消费者策略）。
- `mystra-agent-cli` 反向长连接、订阅/退订/接收/重连重订阅。
- Linear integration 的 webhook payload 解析与状态 ID 过滤。
- Linear Integration Detail 的 webhook URL 引导区块。
- PRODUCT/Constitution 边界修订与文档。

### Out of scope

- CLI → Agent 插件适配、DSH/飞书 Thread 更新、Spec 生成（MYST-16/MYST-7 后续）。
- GitHub/GitLab webhook 实际接入（仅预留注册契约，验证用测试 integration fixture 除外）。
- 事件持久化、离线补发、重试 API、通用 callback URL、消息中间件（NATS/Convoy/Hookdeck 等均不引入）。
- Issue write-back、评论/Document 事件（首版仅 Issue 状态变化语义所需的最小事件集，其余 Linear 事件类型可注册但非必需实现）。
- 订阅持久化与 server 重启后的订阅恢复。
- `MYSTRA_EXECUTION_CODE` 权限扩展。

## Assumptions

- Owner 已确认以 token URL 替代 Linear webhook signing secret，并接受相应伪造风险（缓解措施见 Edge Cases 与 FR-002/003）。
- 事件归属复用 045 的 `ProjectIssueSource` 字段与 exact-connection 配置；058 需新增租户内反向唯一约束、冲突映射与 Team→Project 查询。不新增平行的 Project 归属模型。
- server 为单实例部署（现有 self-hosted 形态），内存态订阅与单点投递满足首版需求。
- 订阅凭据与现有认证体系的关系（复用 session token vs 新专用凭据）在 plan 阶段依据源码核验确定，spec 只约束"不扩大 execution code 权限"。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 全新环境上，仅执行五步 setup（无任何订阅/CLI/环境配置操作），专用测试 Issue 状态变化产生的 webhook 到达 Mystra 统一入口后 10 秒内，被授权订阅客户端收到对应事件（计时从 Mystra 接收 webhook 起，不含 Linear→Mystra 外部投递延迟）。
- **SC-002**: 第二个测试 integration fixture 完成注册、目录发现、订阅与投递全流程，其间**统一 webhook ingress 与订阅路由核心零修改**；仅允许 `defaultIntegrationRegistry` 构造路径与 `integrationDescriptorSchema` capability allowlist 的一次性 `events` 扩展。
- **SC-003**: 无效 token、未注册 integration 和超限请求 100% 在 JSON/平台解析前同步拒绝；已接纳的畸形 JSON/schema 在 200 后异步丢弃，全部负向用例进入投递数量为 0。暂停 worker 时仍能先收到 200，响应不得等待解析/归属/匹配；inbox 满时必须返回 503，不能返回成功。
- **SC-004**: 去重窗口内重复 webhook 投递，订阅端重复接收数为 0。
- **SC-005**: 未加入的 Team、未授权 Project、Project 与连接 Team 不匹配及覆盖他人订阅的尝试 100% 拒绝。同一 human session 同时订阅两个有权限 Team 均成功；切 active Team 不断开；撤销其中一个 Team 的成员身份只停止该 Team，另一 Team 保持投递。
- **SC-006**: 断线重连后订阅自动恢复；心跳超时与慢消费者断开在注入测试中行为符合协议；连接清理后 server 侧残留订阅数为 0。
- **SC-007**: 同一 connection 的 webhook URL 在重复读取、页面刷新与服务重启后保持不变；connection 删除后该 endpoint ID 请求 100% 被拒。日志/query 记录不要求脱敏。
- **SC-008**: 真实 Linear 端到端验收（Story 5）在专用测试资源上完成，证据包含输入、输出与版本；无效 token/无关 Team/重复 delivery/In Review 普通修改四类负向用例全部按约定处理。持有效 URL 者可伪造请求的已接受风险仍须明示。
- **SC-009**: 实现落地前，`PRODUCT.md` 已修订的 out-of-scope 条目与 Constitution 带日期 amendment-log 条目同时存在，且四项排除（通用 callback、重试 API、离线补发、Issue write-back）在修订后文本中仍显式保留。
- **SC-010**: CLI 进程收到 SIGTERM/正常退出后，注入测试显示该连接在 server 侧的残留订阅数为 0，且退出路径无凭据落盘或日志泄露。

## 规划期源码与官方协议勘误（2026-09-16）

- Linear 官方 [Webhooks](https://linear.app/developers/webhooks) 将 `Linear-Delivery` 定义为 payload 唯一 UUID；`webhookId` 不是单个事件标识。接收成功需返回 HTTP 200，且 Linear 在 5 秒超时后可能重试。
- 2026-09-17 Owner 最终简化：安装/配置 connection 后获得固定、可重复读取和复制的 webhook URL；移除一次性原值、hash-only verifier、regenerate、常驻轮换/吊销与 revision CAS。
- 2026-09-17 Owner 决定：稳定 endpoint ID 从 URL 路径段改为 query 参数承载（`?token=…`），且日志/access log 不要求脱敏。
- SC-003 区分同步接纳失败与异步解析丢弃；FR-006 按 Owner 明确要求采用“收到立即返回，后续全异步”；FR-013 保留窗口内去重及易失边界。不引入签名配置、事件存储或离线补发。
- 两套 Prisma schema 当前均只含 `@@unique([projectId, integration])`；045 并未实现 Linear Team 反向唯一。058 在同一 Mystra Team 内补齐，不建立跨租户的全局唯一约束。
