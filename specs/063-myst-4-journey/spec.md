---
title: "063：飞书触发需求设计、Taco 评审与开发设计移交（MYST-4）"
feature_id: "063-myst-4-journey"
created: "2026-09-23"
status: "Draft"
issue: "MYST-4"
input: |-
  User description: "把 MYST-4 整体用户旅程及六个实施断点记录为独立 Spec，并说明第一步是否完成。不要将 MYST-7 的实施清单误当作 MYST-4。"
---

## 范围与定位

本规格记录 [MYST-4](https://linear.app/castrel/issue/MYST-4/用户旅程-1飞书触发需求设计taco-评审与开发设计移交) 的**端到端用户旅程及验收门禁**，不是 MYST-7 的工作清单。`060-coordinator-flow-myst-7` 只负责其中 Coordinator Profile、`mystra-flow` 及其 a1 消费侧契约；`061-agentos-taco-cli` 定义 Taco CLI 与 Skill 的版本配对与预装契约（本旅程由 Host Runtime 承载该能力）；`062-session-continuation-entrypoints` 对应 Session 读取和续接入口。子规格/代码局部完成不等于本旅程通过。此前与负责人已讨论角色、触发、人工 Handoff、批准及六个断点；本稿依据该讨论固化，不重新猜测交互。

目标：使用者在飞书群提供 Issue ID，a1 的 Coordinator 在 C1 Mystra 创建并启动 Project-bound、Issue-referenced Task；Host Runtime 上的 `requirement-designer`（Provider `pi`）在**同一 Session** 内提交 Spec-Kit Markdown、Draft PR、Taco，接受人工批注的完整 Handoff 并重新发布；明确批准后固化最终成果并移交开发设计。Linear Issue 只读，不更改其状态。该旅程不增加 Mystra 自有 Web UI；飞书与 Tacobin 是外部现成界面，Taco 是评审传输而非 `apps/spec-prototype` 中的新 Mystra 页面。本规格不定义新页面，故暂不制作共享代码 UI prototype；若后续规划增加 Mystra UI，必须先补 `prototype.md` 和独立原型。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 从群消息交付首版可评审需求（Priority: P1）

作为在飞书群发起需求的使用者，我希望只给出明确的 Issue ID，就获得与正确 Project/Repo 绑定的首版需求、Draft PR 与真实 Taco 链接，而不是需要亲自操作 Mystra。

**Why this priority**：没有真实任务启动和可审阅首版，就没有后续批注或批准对象。

**Independent Test**：在已配置的测试群发送 `@Bot + 有效 Issue ID`，检查绑定、Task/Session、Spec Markdown、远程 Draft PR 和实际发布 URL；核对 Linear Issue 状态未被写回。

**Acceptance Scenarios**：

1. **Given** Issue 可解析为唯一的已配置 Project/Repo，且该 Issue 尚无本旅程的 Task，**When** 用户在群内 `@Bot + Issue ID`，**Then** Coordinator 仅创建一个 Project-bound、Issue-referenced Task，显式启动生产，并在同一任务下取得原 Session；不创建独立 Thread。
2. **Given** 原 Session 完成首轮工作，**When** Coordinator 读取实际完成结果，**Then** 群内回复真实 Spec 路径、远程 Draft PR 链接与 Taco 发布返回的 URL，并告知评审者使用 Tacobin Handoff；仅发送启动请求不算交付。
3. **Given** 同一 Issue 已有 Task/Session，**When** 再次 `@Bot + Issue ID`，**Then** Coordinator 复用关联、报告当前进度，不创建重复任务或并发首轮生产。

### User Story 2 - 人工反馈回到原 Session（Priority: P1）

作为 Taco 评审者，我希望集中批注后手动从 Tacobin 复制**完整 Handoff**，随 Issue ID 发到飞书群，让原 Agent 在原 Session 中批量更新，而非靠机器人猜测或拉取远端批注。

**Why this priority**：Handoff 是评审意见及文件变更的实际输入；同一 Session 保留工作上下文。

**Independent Test**：在首版 Taco 留评论，复制 Handoff 发到群内，验证原 Session 接收完整文本，Spec 和 Draft PR 更新且新发布的 URL 被准确报告。

**Acceptance Scenarios**：

1. **Given** 已交付首版 Taco/PR，**When** 评审者发送 `@Bot + Issue ID + 完整 Handoff`，**Then** Coordinator 将原文转给该 Issue 的原 Session；Agent 对照原文件和评论修改 canonical Markdown、更新同一 Draft PR、重新发布 Taco；群内只报告本轮真实返回 URL，不承诺沿用旧 URL。
2. **Given** 只有“已评论”或缺失 Issue ID / Handoff 正文，**When** Coordinator 收到消息，**Then** 要求补全信息，不自行拉取评论、不启动修改任务。

### User Story 3 - 人工批准后固化并移交（Priority: P2）

作为最终批准人，我希望明确同意某个 Issue 的需求版本后，原 Session 固化最终 Spec、Taco 与 PR，再得到可核验的归档路径和开发设计移交信息。

**Why this priority**：避免含糊讨论被当作审批，以及草案在未获批准时进入开发设计。

**Independent Test**：分别发送含糊肯定和明确 `@Bot + Issue ID + 通过`；只有后者能触发原 Session 收尾，验证最终文件、PR、Taco URL 和群内回报。

**Acceptance Scenarios**：

1. **Given** 指定 Issue 的需求已完成评审，**When** 人在群内针对该 Issue 明确说“通过/批准”，**Then** Coordinator 向原 Session 发收尾指令；Agent 固化最终 Spec/Taco 并更新 PR，实际完成后群内汇报产物并提示开发设计移交。
2. **Given** “这部分可以，但还要修改”之类含糊表述，**When** Coordinator 处理，**Then** 不触发固化和阶段移交，必要时请求明确指令。

### Edge Cases

- Issue 找不到、没有唯一 Project/Repo 绑定、Project/Integration 未配置、权限不足或远程仓库不可达：停止在可观测失败点，不建立虚假 Task/交付；不得用本地任意 clone URL 代替 Project 绑定。
- 多个 Issue 并行或同一 Issue 连续 Handoff：按 Issue → Task → 原 Session 关联路由，busy 时报告不能即时追加并在可续接时由调用方重试；不声称 Mystra 已排队，不跨 Issue 串话。
- Session 失败、`gh` / `linctl` 不可用、Taco 发布失败或 PR 创建失败：说明具体失败环节，不捏造成功 URL、PR 或 Agent 结论。
- Taco 0.1.4 不保证网络 update 或稳定 URL；每轮报告实际返回 URL，不写“原 URL 已更新”。
- 公开 Taco 不得包含凭据、execution code 或私有仓库数据；若内容未经公开授权，不执行公开发布，并将受阻原因报给人类。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**：C1 必须提供已发布且可供本旅程选择的 `requirement-designer` Profile、可用的 Host Runtime（`pi` Provider）、工作区，以及 Worker 侧 Taco CLI 与离线 Skill；工作 Agent 使用其授权环境中的 `gh`、`linctl`，不经 Mystra 代理其凭据。
- **FR-002**：a1 DSH 必须加载 `coordinator` Profile 和 `mystra-flow` Skill，并以被授权的目标 Team 身份调用 Mystra MCP；能实际读取 Agent 列表、创建/启动 Task、列出/读取/续接 Session。不能仅凭资产已发布推定 MCP 连通。
- **FR-003**：Coordinator 必须从群内 Issue ID 确认唯一 Project/Repo 关联、查重后创建 Project-bound 且带精确 Issue 引用的 Task，明确启动生产；不建立独立 Thread、不写回 Linear Issue 状态。
- **FR-004**：首轮 Agent 必须在目标仓库创建可追踪的 Spec-Kit Markdown、远程 Draft PR，并发布可访问的 Taco；Coordinator 只在核验真实结果后向群返回链接。
- **FR-005**：评审者通过 Tacobin Handoff 人工将完整内容和 Issue ID 发回群；Coordinator 把原文交给同一 Task 的原 Session，Agent 批量处理并更新 canonical 文件及 Draft PR，重新发布后回报实际 URL。
- **FR-006**：只有与 Issue ID 关联的明确人类批准才能触发原 Session 固化最终 Spec/Taco/PR 和开发设计移交；含糊肯定、跳过设计和普通讨论不等于批准。跳过设计须按 `mystra-flow` 的独立显式授权规则处理。
- **FR-007**：Coordinator 必须把受阻、超时、权限错误与未完成的执行状态如实报告；Session busy 不承诺排队或已处理，消息送达不等于工作已完成。
- **FR-008**：整个旅程不得把控制面 Secret、外部令牌、execution code 或未授权私有内容注入飞书公开回复、Taco 或 PR；不新增 Linear 写回。

### Key Entities

- **Issue / Project / IntegrationConnection**：Issue 是外部只读需求引用；Project 持有稳定仓库 ID、基线分支及连接，是任务执行的必需上下文。
- **Task / TaskExecutionContext / Workspace / Session**：Task 是 Team 范围的生产意图；一次起手选择 Agent 与 Runtime，Workspace 为实际执行目录；原 Session 承载多轮需求设计及收尾，不另造 Thread。
- **Spec-Kit Markdown / Draft PR / Taco**：Markdown 是仓库中的 canonical 规范；PR 是远端变更载体；Taco 是可分享的人工评审/Handoff 载体，URL 以每次真实发布结果为准。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**：一次有效群触发产生且仅产生一个与正确 Issue、Project、Repo 绑定的 Task，并可定位其首轮 Session；重复触发不增加 Task。
- **SC-002**：首轮交付同时存在可读取的 Spec Markdown、远程 Draft PR 及可打开的 Taco URL；任一项缺失不得宣布交付成功。
- **SC-003**：一次带完整 Handoff 的反馈由原 Session 处理，更新后的 Markdown/PR 与新 Taco 可逐项核验；两个不同 Issue 并行时互不串话。
- **SC-004**：没有明确群内批准时，零次误触发固化/开发设计移交；明确批准后能核验最终文件、PR 与群内汇报。
- **SC-005**：全程 Linear Issue 状态保持不变；所有失败均报告真实阶段，不用推测链接或状态代替证据。

## 实施断点与当前证据（2026-09-26；2026-09-28 复核）

这里是**旅程级验收顺序**，不是 MYST-7 `tasks.md` 的完成勾选。每步需有当次目标环境的证据；旧测试环境的成功不自动延续到重置后的 C1。

| 断点 | 验收门槛 | 当前判定 |
| --- | --- | --- |
| 1. C1 执行准备 | 目标 Runtime、Profile、Taco CLI/Skill、六个必要 MCP 能力、Worker 侧 `gh`/`linctl` 及真实 Project-bound Task/Session 的可达执行路径有证据 | **环境已迁移到 Host Runtime，组件级证据已刷新（2026-09-26）；端到端 Task/Session 待重跑**。当前执行后端为 Host Runtime `host-c1`（`3e08041c-7e02-4fc5-a3bd-2cd0e1ebf0fe`，provider `codex`/`copilot`/`pi` 均可用）；OpenSandbox 仅作为独立服务运行且已停用，**不是** Mystra Runtime。已实测：box-c1 控制面在线，`taco` Project 绑定 `Arcadia822/taco` 与 Linear `TACO` 团队；host-a1 DSH 的六个 MCP 工具（含 Session 读写三项）全部 AVAILABLE 且调用返回正确 JSON；host-c1 上 `taco-cli 0.2.0` + Taco skill v0.10.0 可组装并 `publish --dry-run`；`gh` 已认证 `Arcadia822`、`linctl` 可读 Linear Issue、`git ls-remote` 经宿主 Clash 代理成功。**此行取代 2026-09-23 的 AgentOS/Pi 断点记录**：原记录中的 AgentOS guest、挂载与 VM 证据属于已被替换的环境，不再作为当前目标环境的证据；`TACO-15` 端到端记录同样只属于该旧环境。 |
| 2. a1 Coordinator 接入 | DSH / a1 实际消费指定 Team 的 MCP 与 `coordinator`/`mystra-flow`，能定位 Issue→Project→Repo 并查重 | **已完成连通性与工具集核验（2026-09-23）**。在 host-a1 使用授权凭据直连 C1 MCP 端点实测：6 个核心工具（`mystra_list_agents`、`mystra_create_task`、`mystra_start_task_production`、`mystra_list_task_sessions`、`mystra_get_session`、`mystra_send_session_message`）全部 AVAILABLE 且调用成功返回正确 JSON。 |
| 3. 群触发生产 | 在真实群 `@Bot + Issue ID` 创建并启动唯一 Project-bound、Issue-referenced Task/Session，不创建独立 Thread | **未验收**。 |
| 4. 首版交付 | 原 Session 提交 Spec-Kit Markdown、远程 Draft PR、Taco；群内返回真实 URL，Linear Issue 不变 | **未验收**。 |
| 5. Handoff 反馈循环 | 人工发送完整 Handoff；同一 Session 更新原文件/PR 并发布新 Taco，群内返回本轮真实 URL | **未验收**。 |
| 6. 批准与移交 | 人工明确批准后原 Session 固化最终产物并移交开发设计，模糊肯定不触发 | **未验收**。 |

**下一验证动作**：a1 的六个 MCP 工具与 host-c1 的 Worker 侧能力已完成核验，改在 **Host Runtime** `host-c1` 上走真实 Project-bound Task/Session，完成端到端需求生成验证（断点 3 起）。不得为了“测通”擅自向第三方仓库推送或公开私有内容。六个 MCP 名称按 `mystra-flow` 约定为 `mystra_list_agents`、`mystra_create_task`、`mystra_start_task_production`、`mystra_list_task_sessions`、`mystra_get_session`、`mystra_send_session_message`。

**2026-09-28 复核（只读实测）**：box-c1 控制面 `http://10.1.23.87:3000` 在线；该 Team 下只有一个 Project `taco`（`Arcadia822/taco`，基线 `main`，2026-09-24 建立）；`coordinator`、`requirement-designer` 各 revision 1 与 `mystra-flow` Skill active revision 1 均在；`host-c1` Runtime `online`（最近心跳 2026-09-28T08:10Z），host 侧 `workloadInstruction` 已含 Taco capability 段落；host-a1 `dsh-web` active，`mystra-flow` 指向 `runtimeId 3e08041c-…` / `provider pi` / `agentId requirement-designer`，MCP 端点 `http://100.68.219.107:3000/api/mcp`。控制面 `Task` / `Session` / `SessionEvent` 计数均为 0，证实断点 3 及其后从未执行过。断点 1、2 借此重新具备**当前环境**的组件级证据，但仍不等于端到端验收。

## 依赖与非目标

- 依赖 `060-coordinator-flow-myst-7` 的 Coordinator 资产与消费流程、`061-agentos-taco-cli` 定义的 Taco CLI 版本配对（本旅程由 Host Runtime 承载：`MYSTRA_TACO_SKILL_PATH` + `MYSTRA_TACO_HOST_URL`）、`062-session-continuation-entrypoints` 的 Session 可达入口，以及目标 Team/Project/Integration、外部 DSH/飞书授权、仓库写入和 Taco 公开权限。以上规格的通过需分别复核，不代替本旅程验收。
- 不实现新的 Mystra Web 页面、独立 Thread、Linear Issue 状态写回、Mystra 代理 `gh`/`linctl`、自动拉取 Tacobin 评论、Taco URL 原地更新、平台持久消息队列或无条件跳过人工批准。
- 本稿仅固化需求及当下证据，不宣称已完成设计评审、技术计划或六步实测；后续实施须按 Spec-Kit 规划、工程评审与任务分解门禁推进。
