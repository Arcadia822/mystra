# 功能规格：Project 对象页与 Issue UI 延期

**Feature Branch**: `codex/webui`
**Created**: 2026-07-25
**Status**: Complete
**Baseline**: `be7d584`
**Owner Story Review**: Owner 已同意将 Projects 增加为一级对象，同时明确要求暂不实现
Issues，因为 Linear Issue 与 GitHub Issue 必须由各自 Integration 提供，展示逻辑也不同。

## User Scenarios & Testing

### User Story 1 - 查看 Project 列表 (Priority: P1)

作为 Mystra 操作员，我希望从一级导航进入 Project 列表，以便查看当前可用于执行任务的
仓库、默认 Agent、runtime 和最近更新时间。

**Independent Test**: 对同一临时数据库，CLI `projects list` 与 Web `/projects`
展示相同的 Project slug、repo、agent 和 runtime。

**Acceptance Scenarios**:

1. **Given** 存在 active Project，**When** 操作员打开 `/projects`，**Then** 页面展示
   Project 名称、slug、repo、默认 Agent、runtime provider/image 和更新时间。
2. **Given** 不存在 active Project，**When** 打开 `/projects`，**Then** 页面展示诚实空状态，
   只指向 canonical API，不要求用户先加载任何 Issue Integration，也不声称 CLI 支持创建。
3. **Given** Project API 失败，**When** 页面加载，**Then** 页面展示错误和重试操作，
   不渲染伪造数据。

### User Story 2 - 检查单个 Project 配置 (Priority: P1)

作为 Mystra 操作员，我希望打开 Project 详情，以便检查 repo、base branch、默认 Agent、
runtime image、context bundles、mounts、ports、cache 和 override policy。

**Independent Test**: CLI `projects inspect <slug>` 与 Web `/projects/:slug`
读取同一 canonical API，并展示同一核心配置。

**Acceptance Scenarios**:

1. **Given** Project 存在，**When** 打开详情，**Then** 页面展示身份、仓库、runtime、
   context 和策略字段。
2. **Given** Project 没有 context bundle、mount、port 或 cache entry，**When** 打开详情，
   **Then** 对应区域展示明确的 none/empty 值。
3. **Given** slug 不存在，**When** 打开详情，**Then** 页面展示稳定的 not-found 错误和重试，
   不显示空白页。
4. **Given** Project 引用了 secret，**When** 打开详情，**Then** 页面只展示 secret reference
   名称与挂载模式，不读取或暴露 secret value。

### User Story 3 - Tasks 不承载通用 Issue 入口 (Priority: P1)

作为 Mystra 操作员，我希望 Tasks 只展示已经进入控制面的任务，而不是假装所有 Issue
Provider 都能使用同一种选择和分派界面。

**Independent Test**: 打开 `/tasks` 后不存在 `Dispatch from Issue`，且浏览器 network
不请求 `/api/integrations/*/issues`。

**Acceptance Scenarios**:

1. **Given** 操作员打开 `/tasks`，**When** 页面加载，**Then** 页面只读取 Task 数据，
   不展示通用 Issue 分派面板。
2. **Given** 当前筛选没有结果，**When** 展示空状态，**Then** 文案只建议调整筛选或刷新，
   不暗示必须配置 Linear。
3. **Given** 未来增加 Linear 或 GitHub Issue UI，**When** 设计该功能，**Then** 它必须由
   provider-specific Integration 契约单独定义，而不是恢复本功能删除的通用面板。

## Requirements

### Functional Requirements

- **FR-001**: 主导航 MUST 增加 `/projects` 一级入口。
- **FR-002**: Web MUST 提供 `/projects` 列表页。
- **FR-003**: Web MUST 提供 `/projects/:slug` 详情页。
- **FR-004**: 两个页面 MUST 通过现有 `/api/projects` canonical API 读取数据，
  MUST NOT 直接访问 SQLite。
- **FR-005**: 页面可见字段 MUST 与既有 CLI `projects list/inspect` 同源，不增加第二套
  Project 业务逻辑。
- **FR-006**: 页面 MUST 提供 loading、empty、error 和 not-found 状态。
- **FR-007**: 页面 MUST 可键盘操作、使用语义化 heading、可见 focus 和现有 Mystra token。
- **FR-008**: `/tasks` MUST 移除 `Dispatch from Issue` 及其 Integration 网络请求。
- **FR-009**: 本功能 MUST NOT 调用或修改远端 Linear、GitHub Issue 或其他 Integration。
- **FR-010**: 本功能 MUST NOT 新增数据库 schema、Project API、CLI command 或 Runner contract。
- **FR-011**: Project secret 配置只可展示 reference metadata，MUST NOT 读取或展示值。
- **FR-012**: 页面 MUST 在 320px 至 1440px viewport 下可用。

### Key Entities

- **Project**: 现有 `projectSchema` 的只读 Web 投影。
- **ProjectRuntimeConfig**: Project 的 sandbox provider、image、context、mount、port、
  cache、secret references 和 override policy。
- **TaskProjection**: 现有 Job/Run 的操作员投影；本功能只移除 intake UI，不修改实体。

## Assumptions

- `/api/projects` 与 `/api/projects/:slug` 已返回完整 Project。
- CLI `projects list/inspect` 已覆盖当前最小只读操作。
- Project 创建、编辑和归档虽有 API，但不是本次用户旅程要求，因此不在页面暴露。
- Tasks 仍可展示持久化的 Issue snapshot；删除的是通用远端 Issue 浏览/分派入口。

## Explicitly Out of Scope

- `/issues` 一级页面、Issue 列表、Issue 详情和 Issue dispatch UI。
- Linear、GitHub Issue 或其他 provider-specific Integration 页面。
- Project create/edit/archive mutation UI。
- API、CLI、RdbProvider、SQLite schema 或 Runner 行为变更。
- 远端 Integration 请求、凭据读取或数据迁移。
- Project 关联 Task 筛选和 Project 运行统计。

## Success Criteria

- **SC-001**: `/projects` 与 `/projects/:slug` 可直接打开并展示真实 Project 数据。
- **SC-002**: Web 与 CLI 对同一 fixture 的 slug、repo、agent、runtime、context 和策略一致。
- **SC-003**: `/tasks` 不包含 Issue dispatch UI，加载期间没有 `/api/integrations/*/issues` 请求。
- **SC-004**: 320、768、1024、1440px 下无不可恢复的水平溢出。
- **SC-005**: 浏览器 console 无 error/warning，链接、刷新和重试可键盘操作。
- **SC-006**: focused tests、lint、typecheck、test、build 和 GitNexus change detection 通过。
