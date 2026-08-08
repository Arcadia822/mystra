# Research: Task 上下文容器与 Multica 对照

**Date**: 2026-08-08
**Reference snapshot**: Multica `main` at commit `9f2b1c50c1674fb481e0045be420419d196e9281`

## Decision

Mystra 不复制 Multica 的对象命名。Multica `Issue` 更接近 Mystra 的 durable Task；Multica `Task` 是一次 Agent run record，更接近 Mystra 的 Session。因此，Multica 的 Task lifecycle 不能成为 Mystra Task 状态机。

```text
Multica Issue  ≈ Mystra Task
Multica Task   ≈ Mystra Session
```

## Findings

### 1. Multica 的 Issue 保存目标，Task 保存一次运行

Multica Tasks 文档把 Issue 描述为 durable goal/discussion/status，把 Task 描述为一次 Agent run，并允许一个 Issue 产生多个 Tasks。Mystra 当前边界则要求 Task 保存稳定上下文，未来 Session 表达一次执行。名称相同，层级不同。直接照抄只会制造一个非常自信的错位。

Source: https://multica.ai/docs/tasks

### 2. Multica 可以在没有 Issue 的 Chat 中运行

Multica Chat 支持不附着 Issue 的对话，并可选携带 Project context。这支持“执行不应依赖需求对象”的方向，但 047 不据此设计 Mystra Session；它只用来验证 Task 不应成为 Session 前置条件。

Source: https://multica.ai/docs/chat

### 3. Agent-mode New Issue 与 Manual New Issue 是两个创建模式

Multica quick-create 允许选择 agent/squad、输入 prompt、可选 Project 等，然后异步让 Agent 生成 Issue；manual create 则显式编辑 Issue 字段。Mystra 047 只借用“保留草稿、可选 Project、创建后清理”的交互经验，不引入 Agent-mode Task 生成，也不复制需求管理字段。

Sources:

- https://github.com/multica-ai/multica/blob/main/packages/views/modals/quick-create-issue.tsx
- https://github.com/multica-ai/multica/blob/main/packages/views/modals/create-issue.tsx
- https://github.com/multica-ai/multica/blob/main/server/internal/handler/issue.go

### 4. 创建上下文不应在成功后静默继承

Multica 当前主分支调整了 quick-create 的记忆行为：模式和 actor 可以保留，但成功后不继续记住之前的 Project。047 采用更严格的 Task 草稿边界：失败保留合法草稿；成功清空；Project/Issue 不成为下一次创建的隐式默认值。

Source: https://github.com/multica-ai/multica/commit/9f2b1c50c1674fb481e0045be420419d196e9281

### 5. Desktop tab 是导航状态，不是对象创建语义

Multica desktop tabs 管理 workspace 内页面导航。047 不把“New tab”理解为浏览器/桌面 tab 生命周期；Mystra 的 `New` 是主导航页面，合同是手动创建 Task。

Source: https://github.com/multica-ai/multica/blob/main/apps/docs/content/docs/desktop-app.mdx

## Adopted

- 快速输入优先，Project 可选。
- 未完成草稿在失败和页面往返时可恢复。
- 创建成功后清空草稿与可选关联，避免静默继承。
- 将 durable intent/context 与一次执行记录分开。

## Rejected

- 将 Multica Task lifecycle 移植到 Mystra Task。
- 在 New Task 中选择 Agent 或启动执行。
- 把 priority、status、assignee、cycle、due date 等 Issue 管理字段复制进 Task。
- 通过 agent-mode prompt 异步生成 Task。
- 把 desktop navigation tabs 当成 Task 创建合同。

## Local Dependencies

- `045-project-issue-sources` 提供 Project-scoped GitHub/Linear Issue 列表与 exact source scope，但明确不拥有 Issue → Task。
- `046-agent-definition` 单独维护 Agent 与 Session 四要素边界；047 不修改它。
- 当前代码把 Task 强制绑定 Project，并让 `/new` 强制选择 Project。047 将在 plan 中评估该替代合同的持久化、API 和 UI blast radius。

## Implementation Research Decisions

### 6. Task 自有文本使用显式列，不再藏入 metadata

**Decision**: `title` 使用 trim 后 1..500 字符；`description` 为 nullable、最大 100,000 字符。移除 Task 公共 `metadata`。

**Rationale**: 500 与现有 GitHub/Linear list item title 上限一致，避免 Issue-derived 标题在创建边界二次截断；100,000 与现有 Issue 文本边界一致，但这里保存的是 Mystra-owned 工作说明，不复制 Issue description。显式列使更新白名单、搜索和安全呈现可验证，避免 metadata 成为需求状态机或 Session 参数的逃生舱。

**Alternatives considered**:

- 继续保存 `metadata.title`：拒绝；无法在 schema/数据库层表达必填、长度与 mutable 字段白名单。
- 增加 `objective`：拒绝；会与未来 Session objective 混淆，并重新暗示 Task 是 Session 父级。

### 7. Manual create 使用 Team-scoped idempotency key

**Decision**: canonical manual create 要求 UUID `idempotencyKey`；数据库内部保存并对 `{teamId, idempotencyKey}` 建唯一约束。Web draft 在失败重试间保留同一 key；CLI 可显式复用。

**Rationale**: 禁用按钮只能防住单页双击，不能覆盖网络重试、并发 tab 或 MCP/CLI 重放。数据库唯一约束是 SC-004 同类要求下唯一可信的最终边界。

**Alternatives considered**:

- 根据 title/project 去重：拒绝；同名 Task 合法。
- 只在内存中缓存请求：拒绝；进程重启和多实例下不安全。

### 8. Exact Issue identity 保存 source fingerprint

**Decision**: Issue reference 保存 provider、connection ID、source scope external ID、Issue external ID 与 lookup/display identifier；唯一性由前四项决定。

**Rationale**: 只存 provider + Issue ID 无法在 Project 切换 connection/source 后证明仍是同一作用域。保存 fingerprint 后，详情解析可在任何 provider 请求前比较当前 source，确保不 fallback 到另一 connection。identifier 是 GitHub number/Linear key 的 lookup/display 辅助，不承担唯一性。

**Alternatives considered**:

- 单个 `issueDispatchKey` 字符串：拒绝；字段不可验证、不可查询，且旧名称把 Task 创建与 Session dispatch 混为一谈。
- 保存 Issue URL/title/status snapshot：拒绝；可变且超出 047。

### 9. Issue create 先远端验证，再执行数据库原子 create-or-return

**Decision**: ProjectIssuesService 复用 exact Project connection/source/credential seam，并增加 provider-specific single Issue lookup。验证成功后把稳定 fingerprint 交给 `RdbProvider.createTaskFromIssue`。

**Rationale**: 外部 API 读取无法与本地数据库组成分布式事务。正确边界是“无本地写入地完成远端验证”，随后在一个数据库事务里 create-or-return；最终唯一约束处理竞态。

**Alternatives considered**:

- 信任 Issue 列表客户端提交的标题和 ID：拒绝；source 已撤销、Issue 已移动或请求被伪造时会创建孤立 Task。
- 创建后异步验证：拒绝；会产生 spec 明确禁止的无来源 Task。

### 10. Task detail 的 Issue availability 是瞬时投影

**Decision**: Task read 始终先返回持久 Task；若带 Issue ref，则 best-effort 解析为 `available` 或 `unavailable`，不持久化结果。

**Rationale**: 这同时满足“Task 自身在上游不可访问时仍可用”和“引用显示不可用”，又不引入 Issue cache/snapshot。source fingerprint 不匹配时直接 unavailable，不访问新 source。

**Alternatives considered**:

- Task read 因 provider 错误整体失败：拒绝；把外部可用性重新变成 Task 存在前提。
- 缓存最后一次 Issue：拒绝；属于未来 Integration cache spec。

### 11. pre-0.1 Task 表破坏性替换

**Decision**: SQLite/PostgreSQL migration drop/recreate Task table；legacy SQLite adoption 不复制旧 Task 行。

**Rationale**: 旧行只有 mandatory Project、metadata 和 opaque dispatch key，无法无推测地生成 047 的 title、manual idempotency 或 exact source fingerprint。项目 policy 明确不为 pre-0.1 快照建立兼容路径。

**Alternatives considered**:

- 从 metadata/title 猜测 backfill：拒绝；有些行没有 title，dispatch key 也无法可靠拆分 connection/scope。
- 双表/dual read：拒绝；保留错误 ownership 合同。

## GitNexus Findings

- `PrismaRdbProvider.createTask`: LOW risk，5 个 impacted symbols、2 条 execution processes；interface dispatch 使结果为 lower bound。
- `NewTaskComposer`: LOW risk，1 个直接上游。
- `ProjectIssuesBrowser`: LOW risk，4 个 impacted symbols。
- `groupTasksByProject`: LOW risk，2 个 impacted symbols。
- 新 CLI 索引包含 7,333 nodes、12,719 edges、300 flows。运行中 MCP 的 LadybugDB 存储版本落后，因此本阶段使用同一 GitNexus CLI 的 query/impact 输出并保留故障证据。
