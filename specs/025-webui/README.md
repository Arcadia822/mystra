# Mystra Web UI 演示规划

**用途**: 为老板演示 Mystra 当前 MVP 能力，并争取项目支持。  
**定位**: UI 是演示和操作外壳，不是产品真相。Mystra 的核心管理能力仍按 `API -> Skill/MCP -> CLI -> UI` 的优先级建设。  
**参考风格**: Codex Desktop 的浅灰桌面、左侧固定导航、中间工作画布、右侧详情/配置栏、低饱和边框、克制按钮和少量状态色。

## 事实来源

本规划基于当前仓库能力与已实现/规划中的 Spec-Kit 事实：

- `PRODUCT.md`: Mystra 是 self-use coding-agent orchestration platform；核心路径是提交任务、分配 runner、执行 workflow、返回可审查仓库 artifact。
- `PLATFORM.md`: 当前形态是 Next.js control plane、SQLite RDB、pull-based runner daemon、单机 sandbox、agent/repo/workflow provider 边界。
- `specs/006-control-plane-ui`: 已有原型覆盖健康概览、任务列表、任务详情、任务提交、MCP 信息和技能发现。
- `specs/007-mcp-server` / `specs/008-mcp-skills`: MCP 提交、查询、取消、项目/上下文管理，以及 companion skills 已经是 MVP 可解释的入口。
- `specs/013` 到 `018`: 产品重心是 agent-first 管理面，HTTP API 为真相，MCP/skill/CLI 是主要操作面，UI 只负责解释和辅助。
- `specs/002` / `015`: 配置必须覆盖 project lane、runtime image、context bundle、runner capability、resolved runtime contract。

GitNexus 已重新索引当前工作树，用于校准管理 API、MCP、runner、UI 的现有执行面。此处没有修改运行时代码。

## 演示叙事

老板需要看到的不是“又一个任务面板”，而是这条闭环：

1. 选择一个项目 lane，例如 `mystra` 或 `skrya`。
2. 在新工作页选择 project，并像新对话一样描述要交给 Mystra 的工作。
3. Mystra 基于 project 默认配置解析 workflow、agent、repo、base branch、runtime 和 runner 能力。
4. runner 执行工作流，UI 显示紧凑进度和关键里程碑。
5. 完成后返回 branch / PR / MR / summary，可直接进入审查。
6. 配置页面说明系统不是一次性脚本，而是可扩展的控制平面。

## 页面地图

| 页面 | 主要观众 | 必须展示的能力 | 演示价值 |
| --- | --- | --- | --- |
| 1. Overview | 研发经理、Agent 提效负责人 | task、项目、agent、model、runner 的高层效率与健康指标 | 3 秒内说明 Agent 开发体系是否有效、哪里需要关注 |
| 2. 新工作 | 内部工程师、协调 agent | 必选 project、对话式任务输入、基于 project 默认配置创建 task | 证明用户只需要表达目标，不需要理解运行配置 |
| 3. 运行详情 Run Detail | reviewer、操作者 | compact run summary、当前阶段、runner、workflow 节点、事件摘要、交付 artifact | 证明无需读日志也能解释执行 |
| 4. 项目配置 Project Lane | 平台操作者 | repo、base branch、default agent、runtime image、context bundles、mount/cache/secret refs、workflow hint | 证明多项目与运行配置有边界 |
| 5. 技能与 MCP Integrations | agent 集成方 | MCP endpoint、tools/list、companion skills、安装/调用片段、连接状态 | 证明 Mystra 是 agent-first，而非 UI-first |
| 6. 平台配置 Platform Settings | 平台操作者 | runner pool、sandbox provider、资源容量、trust boundary、主题、私有网络说明 | 证明可运营，不只是 demo 页面 |

## 页面能力

### 1. Overview

- 左侧 sidebar 是全局应用壳，独立于 Overview 页面设计。
- Overview 不提供发起任务的输入入口；发起任务只进入 `新工作`。
- 主画布是克制的管理仪表盘，面向研发经理和 Agent 提效负责人。
- 主题围绕 `task`、`项目`、`agent`、`model`、`runner`。
- 主仪表盘只展示 tasks、success rate、time to artifact、LLM cost、run time composition 和 toplist。
- MVP 不做深入 analytics 仪表盘；下钻只带条件跳转到对应列表页。
- Overview 不做 More filters、环比展示、右侧便览或页面内重复大标题。
- Overview 的筛选控件收缩为两个按钮：`Time` 与 `Project`，并放在主图表区上方单独一行。
- 详细分析设计见 [overview-analytics.md](overview-analytics.md)。

### 2. 新工作

- 页面形态接近 agent/chat AI 产品的 `新对话`，不是弹层、配置表单或执行预检页。
- 用户必须先选择一个 `project`，然后在 composer 中描述要做的工作。
- workflow 来自 project 的默认 workflow 配置；agent 来自 workflow 中的 agent 配置。
- repo、base branch、context bundles、runtime image、runner eligibility 都由 project 配置和 workflow 解析得到。
- 开发 branch 不要求用户填写；名称可以由 agent 在执行过程中按 project 规则生成。
- 首屏不展示右侧 inspector，不拆成上下区，不展示预检区。
- 详细页面设计见 [new-work.md](new-work.md)。

### 3. 运行详情 Run Detail

- 顶部展示 `task id`、`run id`、项目、状态、当前 phase。
- 主区域展示 compact run summary，而不是完整事件流。
- 时间线展示 queued、assigned、workflow running、artifact delivered、terminal。
- 右侧 inspector 展示 runner、runtime image、context bundle、result links。
- 事件和 JSON 只作为折叠诊断，不抢占主要叙事。

### 4. 项目配置 Project Lane

- 基础身份：名称、slug、repo、base branch、default agent、archive 状态。
- Runtime：provider、image、override policy、context bundles、mounts、cache、secret refs。
- Workflow：provider、blueprint name/version、prewarm config。
- Lane 隔离：提交到 `mystra` 不应复用 `skrya` 的上下文。
- Secret 页面只展示引用，不展示 secret 值。这个约束令人遗憾地理性。

### 5. 技能与 MCP Integrations

- MCP endpoint：`/api/mcp`、transport、health、tools/list。
- Companion skills：
  - submit user journey
  - submit implementation request
  - check job status
- 展示 install/call snippet，但保持简短。
- 强调 UI 是观察与配置面，默认提交路径仍是 skill/MCP。

### 6. 平台配置 Platform Settings

- Runner pool：注册状态、capacity、stale window、eligible projects/providers。
- Sandbox provider：当前单机 Docker，未来可替换 provider。
- Management surfaces：API truth、Skill/MCP、CLI、UI 的启用状态。
- Theme/appearance：沿用 `023-control-plane-design-system` 的 token mood。
- Trust boundary：MVP 为 private ops surface，caller auth 不在 MVP。

## 演示顺序

1. 打开 Overview，说明 Mystra 当前的 Agent 开发效率、质量、成本和容量状态。
2. 点击“新工作”，选择 project，并输入一段自然语言工作描述。
3. 切到运行详情，解释 compact summary 如何让协调 agent 轮询。
4. 打开交付 artifact 区，说明输出是 branch / PR / MR / summary。
5. 进入项目配置，展示 runtime/context 是可配置合同，不是硬编码脚本。
6. 进入技能与 MCP，说明 Codex/Copilot/其他 agent 如何接入。
7. 最后进入平台配置，说明 runner/sandbox/provider 可演进。

## 视觉方向

- 背景：浅灰 `#e6e7eb`，左 rail 稍深，内容 sheet 稍亮。
- 字体：系统 UI 字体，代码/ID 使用 mono。
- 布局：桌面优先，固定左 rail；主要内容最大宽度受控；详情页允许右 inspector。
- 控件：pill、segmented control、细边框输入框、低饱和状态 badge。
- 卡片：半径不超过 8px；阴影极弱；层级主要靠间距和边框。
- 状态色：绿色/蓝色/橙色/红色只用于状态，不成为主题。
- 避免：大面积紫蓝渐变、营销 hero、装饰性图形、解释性长文嵌在 UI 中。

## 生成截图

截图位于 `specs/025-webui/screenshots/`：

- [01-overview.png](screenshots/01-overview.png)
- [02-new-work-intake.png](screenshots/02-new-work-intake.png)
- [03-run-detail.png](screenshots/03-run-detail.png)
- [04-project-config.png](screenshots/04-project-config.png)
- [05-skills-mcp.png](screenshots/05-skills-mcp.png)
- [06-platform-settings.png](screenshots/06-platform-settings.png)

可复现渲染脚本位于 [mockups/render-mockups.cjs](mockups/render-mockups.cjs)。生成命令：

```sh
NODE_PATH=/Users/arcadia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
/Users/arcadia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
specs/025-webui/mockups/render-mockups.cjs
```

视觉复查记录位于 [VISION_CHECK.md](VISION_CHECK.md)。

说明：本轮只更新新工作页面文档，不重新生成 UI 图；当前 `02-new-work-intake.png` 仍是上一轮视觉草图，后续重绘时应以 [new-work.md](new-work.md) 为准。

## 需求质量评估

Requirements Quality Score: 94/100

Breakdown:
- Business Value & Goals: 29/30
- Functional Requirements: 24/25
- User Or Operator Experience: 19/20
- Technical Constraints: 14/15
- Scope & Priorities: 8/10

剩余不确定项：

- 老板最关心的是“成本/效率”还是“平台可控性”，演示话术可再压一次。
- 第一版真实 UI 是否继续复用现有单页实现，还是只先替换 Overview 区块，需要在开发前确认。
- 配置页是否允许编辑，还是先只做只读 inspection，需要按后端接口成熟度决定。

## 明确不做

- 不在 MVP UI 中设计 caller auth。
- 不设计 logs API 或日志持久化页面。
- 不设计 retry API 或自动修复循环。
- 不设计 Kubernetes sandbox。
- 不做公开多租户账单、组织、成员邀请等 SaaS 页面。
