# 研究与基线判断

## Decision 1：Project API 与 CLI 已满足最小能力

- **Decision**: 不新增 Project API 或 CLI。
- **Evidence**: 已有 `GET /api/projects`、`GET /api/projects/:slug`，
  CLI 已有 `projects list` 与 `projects inspect <slug>`。
- **Rationale**: 本功能缺口是 Web surface，而不是领域或 transport 能力。
- **Alternatives considered**: 新增 UI 专用 projection route；拒绝，因为会制造第二套 schema。

## Decision 2：Project 页面只读

- **Decision**: Web 提供 list/inspect，与 CLI 当前用户旅程一致。
- **Rationale**: create/edit/archive 并非用户要求；暴露 mutation 会扩大验收和风险。
- **Alternatives considered**: 把现有 PATCH/DELETE 都做成按钮；拒绝。

## Decision 3：Issue UI 按 Integration 分开

- **Decision**: 删除 Tasks 中通用 `IssueDispatchPanel`，不新建 `/issues`。
- **Rationale**: Linear 与 GitHub Issue 的字段、筛选、状态和操作并不相同；通用面板会提前
  固化错误展示契约。
- **Compatibility**: 现有 Issue snapshot、dispatch API 和 CLI 不删除；只是 Web 不再主动
  浏览远端 Issue。

## Decision 4：秘密配置只展示引用

- **Decision**: 页面展示 secret reference 的 name/mode/target，不读取值。
- **Rationale**: Project API 已包含引用 metadata；详情页需要可审计配置，但不需要 secret
  provider 或 credential access。

## GitNexus Evidence

- `AppShell`: LOW，只直接影响 `RootLayout`。
- `routeTitle`: LOW，只被 `AppShell` 使用。
- `TasksPage`: LOW，无上游调用。
- `IssueDispatchPanel`: LOW，唯一直接 consumer 是 `TasksPage`。
