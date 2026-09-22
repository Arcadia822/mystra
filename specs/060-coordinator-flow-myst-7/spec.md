---
title: "060：配置 a1 Coordinator 需求设计、Taco 评审与开发设计移交闭环 (MYST-7)"
feature_id: "060-coordinator-flow-myst-7"
created: "2026-09-22"
status: "Draft"
issue: "MYST-7"
parent_issue: "MYST-4"
input: |-
  User description: "配置 a1 Coordinator 的需求设计、Taco 评审与开发设计移交闭环 (MYST-7)。包含 Coordinator Profile 与 Skill mystra-flow（第一阶段）。"
---

## 用户场景与测试 *(mandatory)*

本特性为 [MYST-4](https://linear.app/castrel/issue/MYST-4/用户旅程-1飞书触发需求设计taco-评审与开发设计移交) 用户旅程 1 在 host-a1 DSH（DeepSeek Harness）调度端的落地。核心目标是在 a1 Coordinator 侧提供版本化流程控制技能 `mystra-flow`（明确为全生命周期三个阶段中的第一阶段：需求设计与 Taco 评审闭环）以及对应的 Coordinator Agent Profile，实现由调度 Agent 自主判断并显式触发 Mystra Task 生产生命周期，中继 Taco 批处理反馈循环，并在获得人类明确批准后固化归档。

### User Story 1 - 飞书触发、上下文解析与 Mystra 任务显式调度 (Priority: P1)

用户在飞书主群通过 `@Bot + Issue ID` 提出开发需求时，Coordinator 自动在该消息下建立独立 Thread，解析出对应的 Linear Issue、Mystra Project 与代码仓库，并由 Coordinator 显式在 Mystra 控制面创建 Task 并启动生产。

**Why this priority**: 这是整个用户旅程 1 的入口与核心触发链路。没有这一步，后续所有的沙盒执行与评审流转均无法启动。

**Independent Test**: 在飞书测试群发送 `@Bot MYST-4`，验证 Coordinator 成功建立 Thread，解析出 Project 与绑定的 Git 仓库，并在 Mystra 控制面通过 MCP 成功创建 Task 与调用 `mystra_start_task_production`。

**Acceptance Scenarios**:

1. **Given** 飞书主群中收到用户包含有效 Issue ID（如 `MYST-4`）的 `@Bot` 消息；  
   **When** Coordinator 接收并处理该消息；  
   **Then** Coordinator 优先在该消息下创建独立 Thread，解析其绑定的 Project 与 Repo，调用 Mystra MCP `mystra_create_task` 创建 Task，随后调用 `mystra_start_task_production` 传入起手指令（要求检出分支、提 Draft PR、写 Spec 与发布 Taco），并将状态与 Thread 绑定。
2. **Given** 某个 Issue 已有处于 `in_progress` 的 Mystra Task / Session；  
   **When** 用户在主群重复对该 Issue 发起 `@Bot`；  
   **Then** Coordinator 识别现有活跃会话并引导至已有 Thread，明确拒绝并发重复调度。

---

### User Story 2 - 评审反馈中继与 Taco 刷新通知 (Priority: P2)

需求评审人在 Taco 评审空间留下多条批注后，在飞书 Thread 发送“已评论，请修改”，由 Coordinator 将修改指令转发给原沙盒 Session 进行批处理修改，并提示复核新版本。

**Why this priority**: 需求规范的制定是一个迭代过程，评审人批注需要低成本、同上下文回流到原 Session，避免因反复新建任务或手动转达丢失上下文。

**Independent Test**: 在既有 Taco 页面添加评论并在飞书 Thread 发送修改指令，验证 Coordinator 成功向原 Session 发送修改指令，沙盒刷新同一 Taco 空间后 Coordinator 在 Thread 提示复核。

**Acceptance Scenarios**:

1. **Given** 工作 Agent 已交付 Taco URL 与 Draft PR，Issue 处于 `In Review`；  
   **When** 评审人在飞书 Thread 发送修改指令（如“批注已完成，请针对修改”）；  
   **Then** Coordinator 识别此修改意图，向原 Session 发送继续执行消息，要求其批量处理 Taco 评论、更新本地 Spec、刷新同一 Taco 空间并 git push 更新远程 Draft PR；Coordinator 等待刷新完成后在 Thread 提示评审人复核。
2. **Given** 评审人发出的消息为普通讨论或澄清提问而非修改指令；  
   **When** Coordinator 处理该消息；  
   **Then** Coordinator 仅在 Thread 回答或与用户澄清，不触发沙盒 Session 的修改流转。

---

### User Story 3 - 显式批准、成果固化与移交开发设计 (Priority: P3)

需求规范评审满意后，评审人在飞书 Thread 明确说出“通过”指令，由 Coordinator 触发沙盒将最终 Spec 和 Taco 归档进 Git 并更新 PR，最后由 Coordinator 在 Thread 报告阶段完成并提示移交后续开发设计。

**Why this priority**: 建立严格的人类把关门禁（Human-in-the-loop），防止未达成一致的需求草案静默流转到开发阶段；固化需求资产至代码库。

**Independent Test**: 在 Thread 中明确发送“通过”，验证 Coordinator 触发沙盒固化归档、更新 PR，并在 Thread 输出包含最终 Spec 路径、Taco 归档与 PR 链接的总结报告。

**Acceptance Scenarios**:

1. **Given** 需求已经过多轮迭代，评审人对 Taco 内容满意；  
   **When** 评审人在飞书 Thread 明确发出“通过”或“确认批准”；  
   **Then** Coordinator 向原 Session 发送固化收尾指令，工作 Agent 将规范与 Taco 归档文件全量 Commit 并 Push，PR 保持或更新为 Ready，Coordinator 收到完成确认后在 Thread 给出最终汇总报告（含规范路径、PR 链接、Taco 链接），宣布第一阶段结束，并提示移交第二阶段。
2. **Given** 用户在 Thread 中仅表达部分肯定（如“这部分可以，但还要改改”）；  
   **When** Coordinator 进行意图判定；  
   **Then** Coordinator 严禁判定为“通过”，不得触发固化收尾动作。

---

### 边界与异常情况 (Edge Cases)

- **控制面或沙盒超时/异常**：当沙盒执行失败、网络超时或 Taco 发布失败时，Coordinator 必须将实际失败阶段和错误如实汇报至飞书 Thread，严禁把“消息已发出”谎称为“执行成功”或“Taco 已更新”。
- **飞书 Thread 重复并发输入**：用户在同一 Thread 内快速连续发送多条修改意见时，Coordinator 必须做去抖或合并，确保向原 Session 发送的是批处理指令，防止产生并发竞争。
- **目标 Issue 状态冲突**：如果外部 Linear Issue 已经被置为 Canceled 或 Done，Coordinator 在初次解析时应当直接拒绝并提示用户，禁止为其创建新生产任务。

---

## 需求项 *(mandatory)*

### 功能需求 (Functional Requirements)

- **FR-001**: Mystra 控制面必须提供并托管标准 `coordinator` Agent Profile 预设，明确其作为飞书群/Thread 协调中枢与 Mystra 控制面调度者的定位与责任断言，严禁其在本地编写具体业务代码或规范。
- **FR-002**: Mystra 控制面必须提供并托管标准 `requirement-designer` Agent Profile 预设，作为需求设计沙盒的系统提示词底座，规范其执行起手 Draft PR、Spec 撰写、Taco 发布、评论批处理与归档收尾职责。
- **FR-003**: Mystra Skill Library 必须托管并分发版本化流程控制技能 `mystra-flow`（ZIP 与 Manifest），显式将其定义为三阶段研发工作流的「第一阶段：需求设计与 Taco 评审闭环」。
- **FR-004**: `mystra-flow` 必须包含飞书 `@Bot` 触发与 Thread 隔离规范，建立 Issue、Project、Repo 与 Thread 的绑定映射及防重入规则。
- **FR-005**: `mystra-flow` 必须规范 Coordinator 通过 Mystra MCP 工具显式发起调度的标准：先调用 `mystra_create_task` 创建 `pending` 任务，组装包含起手提 Draft PR、撰写 Spec、发布 Taco 等标准的 `initialInstruction` 后，再显式调用 `mystra_start_task_production`。
- **FR-006**: `mystra-flow` 必须规范人类评审通知格式，显式向飞书 Thread 返回 Taco 评审 URL 与远程 Draft PR URL，并提示用户在 Taco 集中批注。
- **FR-007**: `mystra-flow` 必须实现批注修改中继逻辑：由人类在飞书 Thread 的显式汇总通知触发，通过 MCP `mystra_send_session_message` 向原 Session 追加一条普通 User Message，驱动工作 Agent 批量处理评论并刷新同一 Taco 空间；不得逐条转发评论。
- **FR-008**: `mystra-flow` 必须包含严格的批准门禁判定，只有当用户在 Thread 发出无歧义的“通过 / 批准”指令后，才允许通过 MCP `mystra_send_session_message` 向 Session 发送“固化需求并收尾”指令。
- **FR-009**: `mystra-flow` 必须规范收尾报告，向飞书 Thread 汇总最终规范文件路径、Taco 归档与 PR 链接，宣布第一阶段完成，且明确声明第一阶段完成不自动将 Linear Issue 标为 `Done`。
- **FR-010**: Mystra 必须提供资产发布脚本 `scripts/publish-presets.mjs`，通过 canonical 管理 API 将 `presets/` 下的 Agent Profile 与 `mystra-flow` Skill 同步至 Mystra Server；已存在且内容相同的资产必须跳过，内容变化必须以新 Revision 发布，不得静默覆盖。
- **FR-011**: `mystra-flow` 必须显式引用其依赖的 Mystra MCP 能力名称：`mystra_list_agents`、`mystra_create_task`、`mystra_start_task_production`、`mystra_list_task_sessions`、`mystra_get_session`、`mystra_send_session_message`。
- **FR-012**: 跳过第一阶段必须由单一可观测谓词授权——用户在同一 Thread 明确回复「跳过设计」。对改动规模的描述（「很小」「就一行」「你直接改了吧」）与进度压力（「别拖了」「时间紧」）**不得**构成跳过授权；跳过仍须创建 Task 并记录豁免原因。
- **FR-013**: `mystra-flow` 必须显式列出「不构成批准」的表述清单，并为批准门禁提供借口对照表（记录自基线测试中观察到的真实合理化说辞）。
- **FR-014**: `mystra-flow` 必须声明其依赖的三个 Session MCP 工具由 MYST-28 交付；工具未注册时 Coordinator 必须报告缺失能力并停止，不得凭猜测构造调用，也不得把「消息已发送」当成「Session 已处理」。

### 成功标准 (Success Criteria)

- **SC-001**: 飞书 `@Bot + Issue ID` 触发后，Coordinator 在 5 秒内完成独立 Thread 创建并确认受理，10 秒内完成 Project/Repo 映射并在 Mystra 控制面生成 Task。
- **SC-002**: Coordinator 发起的 Task 生产启动请求必须准确携带 `initialInstruction`，其内容完整覆盖“起手 Draft PR”、“Spec-Kit Markdown”、“Taco 发布”、“linctl In Review 标记”四项执行要求。
- **SC-003**: 两个不同 Issue 并发触发时，飞书 Thread、Mystra Task、Session 与生成的 Taco/PR 严格隔离，无串话或状态覆盖。
- **SC-004**: 评审反馈循环支持同 Taco 空间多次刷新，刷新后向 Thread 输出的确认消息附带与首轮一致的 Taco URL。
- **SC-005**: 未经 Thread 明确“通过”指令，系统 100% 拦截对开发设计阶段的移交与收尾固化动作。

---

## 架构与工程约束 *(mandatory)*

1. **平台与消费端职责划分（非目标声明）**：
   - **Mystra 平台职责（核心 FR 范围）**：负责标准 Profile 的持久化、Skill Library 的版本化打包与存储、MCP 调度接口与分发能力。
   - **DSH / 飞书侧职责（实施消费范围）**：DSH 是当前 Mystra Server 的首期集成客户端，负责运行 Coordinator Agent 并通过 MCP 消费上述资产与接口。将技能部署进具体 DSH 机器人实例属于外部集成与落地验证，不属于 Mystra 平台持久化或核心服务端的开发范围。
2. **流程逻辑承载主体**：
   - 第一阶段的业务流转、Taco 待评审门禁、反馈循环、人类批准与阶段移交全部由 **Coordinator Skill (`mystra-flow`)** 承载。
   - 现有的 `mystra.workflow` 仅作为单 Task 内部的微观执行指引（`understand -> implement -> verify -> completed`），不作为跨阶段的业务审批状态机。
3. **工具调用解耦**：
   - 调度端（无论是 DSH 还是其他客户端）**不依赖全局 `mystra` CLI 或 `taco-cli`**，纯粹通过 Mystra MCP 工具进行任务管理与控制面调度。
   - 沙盒执行侧工具依赖（`taco-cli`、`gh`、`linctl`）由沙盒基础镜像与环境负责（见 `MYST-25`），调度端只传递目标与指令。
4. **真实性与安全隔离**：
   - 调度端严格隔离凭据，禁止将控制面 Secret 或外部 Token 注入飞书公开消息。
   - 所有执行状态与失败均如实回报，禁止伪造“已更新”或“已通过”。
5. **前置依赖（外部能力）**：
   - `mystra-flow` 的续接与观察步骤以 MCP 工具 `mystra_list_task_sessions`、`mystra_get_session`、`mystra_send_session_message` 为前提。这三个工具由 [MYST-28](https://linear.app/castrel/issue/MYST-28/为-session-续接与读取补齐可达入口http--mcp--cli) 交付；本特性只声明并消费该能力名称，不实现控制面入口。
   - 在该前置落地前，`mystra-flow` 的续接与固化步骤只能作为资产契约存在，不能作为端到端可达行为验收。
