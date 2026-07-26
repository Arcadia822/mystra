# 功能规格：Control Plane 对象页与 Codex 浏览器入口

**Feature Branch**: `codex/webui`
**Created**: 2026-07-25
**Status**: Complete
**Baseline**: `main@bc50ac3`
**Owner Story Review**: Owner 已明确要求以最新 `main` 和真实 CLI 旅程为准，
不沿用 `025-webui` 的旧旅程；因此本规格直接采用下述故事集。

## User Scenarios & Testing

### User Story 1 - 查看 Control Plane 当前状态 (Priority: P1)

作为 Mystra 操作员，我希望打开唯一的 Control Plane 概览页，立即看到 Task
状态分布、Runner 可用容量和最近活动，以便判断平台是否能接收和执行工作。

**Independent Test**: 同一临时数据库下，CLI `control-plane inspect` 与 Web `/`
展示相同的 Task、Runner 和容量计数。

**Acceptance Scenarios**:

1. **Given** 控制面可访问，**When** 操作员打开 `/`，**Then** 页面展示 Task 总数、
   queued、active、waiting for review、failed、Runner online/stale 和可用容量。
2. **Given** API 暂时失败，**When** 页面刷新，**Then** 页面保留清晰错误状态和重试操作，
   不展示伪造的零值。
3. **Given** CLI 访问同一控制面，**When**执行 `control-plane inspect`，**Then**关键计数
   与页面一致。

### User Story 2 - 检查 Runner 列表与单个 Runner (Priority: P1)

作为 Mystra 操作员，我希望 Runner 有独立列表和详情页，以便检查心跳、能力、并发、
正在执行的 Task 和身份信息，而不是在一张混合仪表盘里寻找节点。

**Independent Test**: CLI `runners list/inspect` 与 Web `/runners`、
`/runners/:id` 读取同一 API，字段一致。

**Acceptance Scenarios**:

1. **Given** 存在 Runner session，**When** 打开 `/runners`，**Then**每个 Runner
   显示 online/stale、active/max concurrency、executor、agents、image 和最近心跳。
2. **Given** 打开 Runner 详情，**When**该 Runner 有已分配 Task，**Then**详情页链接
   到对应 Task；没有分配时显示诚实空状态。
3. **Given** Runner ID 不存在，**When**打开详情页或运行 CLI inspect，**Then**返回稳定
   404/缺失错误，而不是空白页面。

### User Story 3 - 完成 Task 列表、详情与操作旅程 (Priority: P1)

作为 Mystra 操作员，我希望 Task 有独立列表和详情页，并能执行与 CLI 相同的
inspect、wait/refresh、cancel、result/failure 检查，以便 Web 和 CLI 是同一产品的两个入口。

**Independent Test**: 对同一组 Job/Run fixture，CLI `tasks list/inspect/cancel/result/failure`
与 Web `/tasks`、`/tasks/:id` 展示相同状态并产生相同取消结果。

**Acceptance Scenarios**:

1. **Given** 存在多个状态的 Task，**When**打开 `/tasks`，**Then**可按状态筛选并进入详情。
2. **Given** 打开 Task 详情，**When** Run 仍在进行，**Then**页面自动刷新并显示事件、
   Issue snapshot、Project、runtime、Runner 和当前阶段。
3. **Given** Task 可取消，**When**点击 Cancel 并确认，**Then**页面调用现有 canonical
   cancel API，随后展示最新状态；终态 Task 不提供虚假可用操作。
4. **Given** Task 到达 `waiting_for_review`，**When**打开详情，**Then**展示 test/build、
   preview、PR、sandbox 和 Agent 证据，并提供外部链接。
5. **Given** CLI 使用旧 `runs` 命令，**When**升级后继续执行，**Then**行为保持兼容；
   新 `tasks` 命令是同一实现的对象命名别名。

### User Story 4 - 从 Codex 打开 Mystra Web UI (Priority: P1)

作为在 Codex 中操作 Mystra 的用户，我希望 Mystra Plugin 能检查本地控制面并在
Codex 内置浏览器打开目标页面，以便聊天负责指令，Web UI 负责检查和操作。

**Independent Test**: 安装/验证 repo-local `plugins/mystra` 后，调用
`mystra-open-control-plane` 技能可返回并打开精确 URL；控制面不可达时明确失败。

**Acceptance Scenarios**:

1. **Given** 本地控制面可达，**When**用户要求打开 Mystra，**Then** Plugin 使用
   `http://127.0.0.1:3000`（或显式配置 URL）在 Codex internal browser 打开页面。
2. **Given**用户指定 Task 或 Runner ID，**When**打开界面，**Then**直接打开对应详情路由。
3. **Given**控制面不可达，**When**技能执行，**Then**报告连接失败，不打开伪造页面。

## Requirements

### Functional Requirements

- **FR-001**: Web MUST 提供 `/` 作为唯一 Control Plane 概览/详情页。
- **FR-002**: Web MUST 提供 `/runners` 与 `/runners/:id`。
- **FR-003**: Web MUST 提供 `/tasks` 与 `/tasks/:id`；Task MUST 投影现有 Job/Run，
  不新增第三套持久化实体。
- **FR-004**: 页面 MUST 通过 canonical Web API 读取和操作，不直接访问 SQLite。
- **FR-005**: Control Plane、Runner、Task 的用户可见操作 MUST 有 CLI 对应。
- **FR-006**: CLI MUST 新增 `control-plane inspect`、`runners list/inspect` 和
  `tasks list/inspect/wait/cancel/result/failure`，同时保留 `runs` 兼容。
- **FR-007**: API MUST 新增稳定的 Control Plane projection 与 Runner detail 读取路由。
- **FR-008**: Task cancel MUST 复用现有 `/api/jobs/:id/cancel`。
- **FR-009**: 页面 MUST 提供 loading、empty、error、not-found、active、terminal 和
  `waiting_for_review` 状态。
- **FR-010**: 页面 MUST 可键盘操作、具备可见 focus、语义化 heading 和可访问标签。
- **FR-011**: 页面颜色 MUST 使用 Mystra 语义 token，不在 route component 中硬编码颜色。
- **FR-012**: Codex Plugin MUST 通过 browser handoff 打开 Web URL；MUST NOT 声称注册
  原生 Codex tab 或任意 right-panel React surface。
- **FR-013**: Plugin MUST 保持可移除；Mystra API/CLI/Runner 不依赖 Plugin 存在。
- **FR-014**: 本功能测试 MUST NOT 调用或修改远端 Linear。
- **FR-015**: 旧 `025-webui` 旅程 MUST NOT 作为验收证据。

### Key Entities

- **ControlPlaneProjection**: 当前 Task/Runner/容量的只读聚合。
- **RunnerProjection**: 现有 `PublicRunnerSession` 的页面与 CLI 投影。
- **TaskProjection**: 现有 `JobSnapshot` 的页面与 CLI 投影。
- **BrowserHandoff**: Plugin 输出的目标 URL 与 `codex-internal-browser` 打开策略。

## Assumptions

- Runner 当前没有 drain/restart 等管理 API，因此本功能的 Runner 操作为 list、
  inspect、refresh 和跳转到已分配 Task；不伪造 mutation。
- `Task` 是面向操作员的对象名，底层继续使用 Job/Run schema 和 API 路径。
- Linear Issue list/get/dispatch 仍由既有 API/CLI 提供，但不在本功能的外部验收中调用。

## Explicitly Out of Scope

- Linear Project 创建、Issue 写回或任何远端 Linear mutation。
- Runner drain/restart/delete、Kubernetes 管理或新 Runner 协议。
- 新数据库表或 Job/Run 状态机。
- 自动 merge/deploy。
- Codex 原生 tab 注册或自定义 browser bridge。

## Success Criteria

- **SC-001**: 五个页面路由可直接打开，列表与详情均有真实数据状态。
- **SC-002**: 页面与 CLI 对同一 fixture 的核心字段和操作结果一致。
- **SC-003**: 一名用户可在 Web 中完成 overview → runners → runner detail →
  task detail → cancel/result review 的完整旅程。
- **SC-004**: 页面在 320、768、1024、1440px 下无不可恢复的水平溢出。
- **SC-005**: 浏览器控制台无 error/warning，关键交互可键盘完成。
- **SC-006**: Plugin validator 通过，技能可以打开 overview、Runner detail 和 Task detail。
- **SC-007**: focused tests、lint、typecheck、test、build 和 GitNexus change detection 通过。
