# Mystra Web UI 演示规划

**用途**: 为老板演示 Mystra 当前 MVP 能力，并争取项目支持。  
**定位**: UI 是演示和操作外壳，不是产品真相。Mystra 的核心管理能力仍按 `API -> Skill/MCP -> CLI -> UI` 的优先级建设。  
**当前规范边界**: `specs/025-webui/spec.md` 现在只定义前端框架层：主题功能与 Claude design-system 对齐、国际化、主侧边栏、`chatLayout` / `dashboardLayout` / `readLayout` 三种核心 layout、基础组件、响应式，以及后续页面能力接入和未来 Electron 兼容的边界。  
**本文角色**: 本 README 中的页面地图、草图和演示叙事属于非规范性的探索材料，不代表页面行为已经交付。原 `026` 到 `031` 的有效材料已合并到 `page-designs/`，025 是唯一保留的未完成 UI spec。
**参考风格**: Codex Desktop 的浅灰桌面、左侧固定导航、中间工作画布、右侧详情/配置栏、低饱和边框、克制按钮和少量状态色。

## 事实来源

本规划基于当前仓库能力与已实现/规划中的 Spec-Kit 事实：

- `PRODUCT.md`: Mystra 的核心路径是 Task intent、独立 child Session、稳定 Runner 和可审查仓库 artifact。
- `PLATFORM.md`: 当前形态是 Next.js control plane、SQLite RDB、pull-based Runner daemon、单机 sandbox，以及 Agent/Repository/Sandbox provider 边界。
- `specs/006-control-plane-ui`: 已有原型覆盖健康概览、任务列表、任务详情、任务提交、MCP 信息和技能发现。
- `specs/007-mcp-server` / `specs/008-mcp-skills`: MCP 提交、查询、取消、项目/上下文管理，以及 companion skills 已经是 MVP 可解释的入口。
- `specs/013` 到 `018`: 产品重心是 agent-first 管理面，HTTP API 为真相，MCP/skill/CLI 是主要操作面，UI 只负责解释和辅助。
- `specs/002` / `015`: 配置必须覆盖 project lane、runtime image、context bundle、runner capability、resolved runtime contract。

GitNexus 已重新索引当前工作树，用于校准管理 API、MCP、runner、UI 的现有执行面。此处没有修改运行时代码。

## 演示叙事

老板需要看到的不是“又一个任务面板”，而是这条闭环：

1. 选择一个项目 lane，例如 `mystra` 或 `skrya`。
2. 在新工作页选择 project，并像新对话一样描述要交给 Mystra 的工作。
3. Mystra 为显式创建的 Session 解析 Agent、branch、runtime 和 Runner eligibility。
4. runner 执行工作流，UI 显示紧凑进度和关键里程碑。
5. 完成后返回 branch / PR / MR / summary，可直接进入审查。
6. 配置页面说明系统不是一次性脚本，而是可扩展的控制平面。

## 页面地图（025 内实现切片）

| 页面 | 025 内材料 | 当前状态 |
| --- | --- | --- |
| Overview | [`page-designs/overview-analytics.md`](page-designs/overview-analytics.md), [`01-overview.png`](page-designs/screenshots/01-overview.png) | 探索材料 |
| Inbox | 无 | placeholder |
| New Task | [`page-designs/new-work.md`](page-designs/new-work.md), [`02-new-work-intake.png`](page-designs/screenshots/02-new-work-intake.png) | 探索材料 |
| Projects | [`04-project-config.png`](page-designs/screenshots/04-project-config.png) | 已有对象页，截图为演示输入 |
| Settings | [`05-skills-mcp.png`](page-designs/screenshots/05-skills-mcp.png), [`06-platform-settings.png`](page-designs/screenshots/06-platform-settings.png) | 探索材料 |
| Recent Sessions | [`03-session-detail.png`](page-designs/screenshots/03-session-detail.png) | 探索材料 |

## 页面能力

### 页面拆分

025 仍以 shell/framework 为第一实施边界；页面材料集中在本目录，后续以 025 内独立实现切片推进。Inbox 当前没有可迁移材料，保持 placeholder，不再创建空 feature 目录。

## 演示顺序

1. 打开 Overview，说明 Mystra 当前的 Agent 开发效率、质量、成本和容量状态。
2. 点击 New Task，选择 project，并输入一段自然语言工作描述。
3. 切到 Recent Sessions，解释 compact summary 如何让协调 agent 轮询。
4. 打开交付 artifact 区，说明输出是 branch / PR / MR / summary。
5. 进入项目配置，展示 runtime/context 是可配置合同，不是硬编码脚本。
6. 进入 Settings 中的技能与 MCP 材料，说明 Codex/Copilot/其他 agent 如何接入。
7. 最后进入 Settings 中的平台配置材料，说明 runner/sandbox/provider 可演进。

## 视觉方向

- 背景：浅灰 `#e6e7eb`，左 rail 稍深，内容 sheet 稍亮。
- 字体：系统 UI 字体，代码/ID 使用 mono。
- 布局：桌面优先，固定左 rail；主要内容最大宽度受控；详情页允许右 inspector。
- 控件：pill、segmented control、细边框输入框、低饱和状态 badge。
- 卡片：半径不超过 8px；阴影极弱；层级主要靠间距和边框。
- 状态色：绿色/蓝色/橙色/红色只用于状态，不成为主题。
- 避免：大面积紫蓝渐变、营销 hero、装饰性图形、解释性长文嵌在 UI 中。

## 生成截图

历史页面截图已合并到 025：

- [`page-designs/screenshots/01-overview.png`](page-designs/screenshots/01-overview.png)
- [`page-designs/screenshots/02-new-work-intake.png`](page-designs/screenshots/02-new-work-intake.png)
- [`page-designs/screenshots/03-session-detail.png`](page-designs/screenshots/03-session-detail.png)
- [`page-designs/screenshots/04-project-config.png`](page-designs/screenshots/04-project-config.png)
- [`page-designs/screenshots/05-skills-mcp.png`](page-designs/screenshots/05-skills-mcp.png)
- [`page-designs/screenshots/06-platform-settings.png`](page-designs/screenshots/06-platform-settings.png)

可复现渲染脚本位于 [mockups/render-mockups.cjs](mockups/render-mockups.cjs)。生成命令：

```sh
CHROME_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
NODE_PATH=/Users/arcadia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
/Users/arcadia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
specs/025-webui/mockups/render-mockups.cjs
```

视觉复查记录位于 [VISION_CHECK.md](VISION_CHECK.md)。

说明：本轮只合并现有页面材料，不把探索性页面内容声明为已实现能力。

## 需求质量评估

需求质量评分：94/100

分项：
- 业务价值与目标：29/30
- 功能需求：24/25
- 用户或操作员体验：19/20
- 技术约束：14/15
- 范围与优先级：8/10

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
