---
name: mystra-flow
description: "Use when a 飞书/Feishu thread starts or continues a Mystra requirement-design task — a bot @mention with a Linear Issue ID, a reviewer reply 已评论/请修改/通过, or any follow-up instruction in a thread where a Taco review is already open."
---

# Mystra Flow（第一阶段：需求设计、Taco 评审与开发设计移交）

本 Skill 指引 Coordinator 承接研发需求，并通过 Mystra 控制面驱动第一阶段的执行、评审反馈与移交闭环。

## 三阶段全景
- **第一阶段（本 Skill）**：需求分析、Spec-Kit 文档化、Taco 交互式评审与 Draft PR 建立。
- **第二阶段**：开发方案设计、架构/技术评审与任务拆解。
- **第三阶段**：代码实现、验证、PR 转正式 Review 与交付合并。

## 快速参考

| 用户在本 Thread 的回复 | 动作 |
|---|---|
| `@Bot + Issue ID`（主群首条） | 建独立 Thread，解析 Issue/Project/Repo，查活跃 Task 去重 |
| 「已评论，请修改」 | 向原 Session 发**一条**批处理指令 |
| 「通过」或「批准」 | 发「固化需求并收尾」，完成后报告移交 |
| 其它任何内容 | 仅在本 Thread 回应，不触发任何 Session 动作 |

---

## 第一阶段操作规程

### 步骤 1：需求接收与飞书 Thread 隔离
1. 当用户在飞书主群以 `@Bot + Issue ID` 提出需求时，**必须先在原消息下建立独立飞书 Thread 与会话**，所有后续交流均在此 Thread 内进行。
2. 解析目标 Linear Issue、对应 Mystra Project 以及绑定的 Git 仓库。
3. 检查是否已有对应活跃 Task（状态为 `in_progress`），若存在则引导用户至现有 Thread，禁止并发创建孤立重复 Task。

### 步骤 2：流程准入（默认走完整第一阶段）

**默认：所有需求执行完整第一阶段（Spec 规范化 + Taco 评审）。**

跳过第一阶段**只有**一个条件：用户在同一 Thread 中明确回复「**跳过设计**」四个字。

以下**一律不构成**跳过授权，必须按标准流程执行：
- 对改动规模的描述：「很小」「简单」「就一行」「纯文案」「很小的改动」「你直接改了吧」
- 进度压力：「别拖了」「时间很紧」「赶紧」
- 用户没有回复，或回复内容模糊

跳过时必须在 Thread 记录豁免原因，且**仍须执行步骤 3 创建 Task**（跳过的是 Spec 与 Taco，不是任务追踪）。

**违规的念头**——出现任一即回到标准流程：
- 「用户已经明确指示了，所以可以跳过」
- 「这么小的改动跑 Spec 是浪费」
- 「用户催得紧，先推进再说」

### 步骤 3：显式创建并调度 Mystra 任务
1. 调用 MCP `mystra_list_agents` 解析 `requirement-designer` 的 `agentId`。
2. 调用 MCP `mystra_create_task` 创建 Task（初始状态为 `pending`）。
3. 由 Coordinator 组装清晰的 `initialInstruction`：
   - 目标 Issue 标识；
   - 检出特性分支并提 Draft PR 要求（关联 Issue）；
   - 编写规范文件至 `specs/<feature>/spec.md` 要求；
   - 打包发布 Taco（执行 taco-cli publish）并回填 `linctl` 为 `In Review` 要求；
   - 交付 Taco URL 与 Draft PR 链接要求。
4. 调用 MCP `mystra_start_task_production` 显式启动沙盒执行：
   - 传入 `taskId`、`runtimeId`（host-c1 AgentOS）、`providerKey`（Pi）、`agentId`（`requirement-designer`）、`initialInstruction`、`expectedRevision` 与 `idempotencyKey`。

### 步骤 4：接收结果并组织人类评审
1. 通过 MCP `mystra_list_task_sessions` 与 `mystra_get_session` 观察该 Task 的 Session 状态；工作 Session 结束首轮执行后，从交付结果中提取 **Taco URL** 与 **Draft PR URL**。
2. 在原飞书 Thread 向用户发起评审通知：
   - 明确附带 Taco 交互式评审链接；
   - 附带 GitHub/GitLab Draft PR 链接供代码层级对照；
   - 提示用户：“请在 Taco 页面中划词批注或留下评论；全部批注完成后在 Thread 发送「已评论，请修改」告知”。

### 步骤 5：处理评审反馈（修改循环）
1. 用户在 Thread 明确告知“已评论，请修改”后：
   - 调用 MCP `mystra_send_session_message`，向原 Session 追加一条普通 User Message，指令其“批量读取 Taco 评论、更新规范并刷新同一 Taco 空间”；
   - 每次续接使用新的 `messageId`；同一 `(sessionId, messageId)` 同内容为幂等重放，不同内容为冲突，不得重试覆盖。
2. 工作 Session 刷新 Taco 并 push PR 后回报结果，Coordinator 再次通知用户确认新版本。
3. 反馈循环可多次进行，**在用户明确说“通过”前，严禁擅自收尾或流转**。

### 步骤 6：明确批准与阶段移交
1. 用户在 Thread 明确发出“通过”、“批准”时：
   - 调用 MCP `mystra_send_session_message` 向原 Session 发送“固化需求并收尾”指令；
   - 确认沙盒完成文件归档、更新远程 PR 并在本地结束需求 Session。
2. Coordinator 在 Thread 报告第一阶段圆满结束，列出最终 Spec 路径、Taco 归档与 PR 链接。
3. 宣布第一阶段完成，并提示准备进入**第二阶段（开发方案设计）**。

### 批准门禁（步骤 5/6 共用）

**不构成批准**（即使叠加进度压力）：
- 「差不多了」「没啥大问题」「应该没问题」「可以了」「看着办」
- 「你直接推进下一阶段吧」「别拖了」
- 用户是该 Issue 的发起人或负责人

| 借口 | 事实 |
|---|---|
| 「用户是 Issue 的主人，他有权批准」 | 身份不是口令。只有「通过」/「批准」才是。 |
| 「他说了『直接推进下一阶段』，这就是指令」 | 那是进度要求，不是评审结论。 |
| 「再问一次是多余的礼节」 | 一句确认的成本，远低于用未批准的规范启动开发设计。 |
| 「凭空加一道闸门会拖死工期」 | 闸门是既定的，不是临时发明的。 |
| 「没有规则要求正式签字」 | 本 Skill 就是那条规则。 |

---

## 依赖的外部能力（MYST-28）

`mystra_list_task_sessions`、`mystra_get_session`、`mystra_send_session_message` 由 MYST-28 交付，**当前可能尚未注册**。

调用前确认工具存在。**工具不存在时必须向 Thread 报告缺失能力并停止**：不得凭猜测构造调用，不得把「消息已发送」当成「Session 已处理」或「Taco 已更新」。
