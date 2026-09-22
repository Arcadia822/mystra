---
title: "059：AgentOS Runtime 与 Pi Provider"
branch: "059-agentos-pi-runtime"
created: "2026-09-20"
status: "设计审查中"
issue: "MYST-17"
---

## 用户场景与验证

本规范承接用户已确认的技术场景：在 host-c1 的 Mystra 中提交任务，由独立 AgentOS Runtime 的 Pi Provider 写设计文档或 Taco；启动指令由调用者控制；使用常驻内网出口。这里的启动指令是 Agent 首条用户消息，不是任意宿主 shell 命令。用户要求设计与开发完成后分别进行独立子代理审查。

### 场景一：调用者控制任务首条指令（P1）

操作者通过既有 API、MCP 或 CLI 发起 Task，明确要求读仓库并编写设计文档，不被平台强制改代码、跑测试或建 PR。

独立验证：提交非代码工作指令，读取持久化首条消息并检查真实工作区产物。

1. Given 合法的 Project-bound pending Task，When 调用者给出启动指令，Then 指令与执行上下文一起冻结，工作区准备完成后成为首条用户消息。
2. Given 相同幂等键，When 更换指令重放，Then 返回冲突，不创建第二次生产上下文或 Session。
3. Given 工作区延后就绪或控制面重启，When 恢复启动，Then 使用原先冻结的指令。
4. Given 调用者未提供指令，Then 使用平台拥有的工作负载中立默认指令，不强制 PR。

### 场景二：同机独立 Runtime 执行文档任务（P1）

平台操作者保留 Host Runtime，并注册独立的 AgentOS Runtime；Pi 在沙箱内获取合法 Task 上下文、读取代码、写入该 Task 的共享工作区。

独立验证：通过正常鉴权和 Task API 启动，跟踪 Task、Workspace、Session、Runtime 身份以及工作区产物。

1. 两个 Runtime 的注册身份、进程、工作区根和 Provider 能力不得串用。
2. 任务生产沿用 Project 精确连接与基准分支的仓库准备流程，不注入任意 clone URL。
3. 上下文或执行凭据缺失时明确失败，不伪造 capability 或成功结果。
4. 沙箱只能写自己的任务工作区；共用 CLI 目录只读，执行凭据不进入提示词、日志或持久化会话数据库。

### 场景三：销毁沙箱后续接同一会话（P1）

Runner 维护者重建 AgentOS 沙箱后继续同一个 Mystra Session，而不是新建一个只保留相同标签的对话。

独立验证：第一轮提供仅在对话中出现的随机事实，销毁 VM，第二轮不重发该事实，要求继续运用该事实并修改原工作区文档。检查 Provider 会话身份与实际产物。

1. 会话历史与工作区状态均保留，Task Runtime 锁定不变。
2. 无法恢复已有 Provider 会话时失败，不能静默创建新会话冒充续接。
3. Provider 超时、取消或非成功停止原因不能映射为执行成功。

### 场景四：脱离操作者笔记本的仓库出口（P1）

host-c1 使用常驻内网 HTTPS CONNECT 代理访问 GitHub，关闭操作者笔记本临时代理仍能解析远程分支。

1. 仅允许 host-c1 来源访问 GitHub 443；其他来源、目标与端口均拒绝。
2. 代理不解密 TLS，不读取或记录 Project 凭据，不经过第三方代码镜像。
3. 服务由宿主服务管理器管理并启用自动启动。

### 边界情况

- 空白、超长启动指令按既有消息限制拒绝；指令只是用户文本，不提升为系统提示词。
- 同一 Session 标识用不同有效指令重放必须冲突。
- 可选 Agent Context 与启动指令是两个输入，不互相覆盖。
- 启用固定 workflow 的 Task 仍遵循其明确的阶段约束；本验收不静默关闭或重写用户启用的 workflow。
- Session ready 仅表示可接受下一条消息，不证明任务完成。

## 需求

### 功能需求

- FR-001：沿用既有 Runtime、Provider、Workspace、TaskExecutionContext 和 Session 合同，不新增业务对象或第二条生产状态机。
- FR-002：增加调用者可控首条启动指令，覆盖两个 Task 启动入口、API、MCP、CLI，纳入验证、冻结、幂等指纹和首条消息审计。
- FR-003：保留单一程序拥有的 Standard Execution Prompt 及其内容哈希；改为任务类型中立的执行约束。仅在任务本身要求代码交付时要求相应自测、PR，不强制所有任务使用研发工具。
- FR-004：FR-002、FR-003 是用户本轮裁定对 052 固定研发指令与 054 禁止覆盖 firstUserMessage 决策的明确修订；不开放系统提示词编辑或通用 workflow 配方。
- FR-005：AgentOS 为独立 Runtime 类型，Pi 为 Provider。仅实现 Host 与 AgentOS，不启用 opensandbox 或其他未经授权的 Runtime。
- FR-006：沙箱必须实际获取短期 Session 作用域上下文能力，保留系统提示词、可选 Agent Context、适用 Skill 投影和工作区语义。
- FR-007：Provider 会话恢复必须有 SDK 源码与真实双轮实验支撑。仅持久化 SQLite 文件或返回稳定 UUID 不满足恢复要求。
- FR-008：对超时、非成功停止、不可用 Provider 及上下文缺失返回明确错误；释放沙箱与子进程。
- FR-009：仓库准备使用常驻、受限出口；不依赖用户笔记本在线。
- FR-010：验收必须由正常授权入口创建和启动真实 Task，记录工作区文件和结果证据；禁止插入登录会话绕过鉴权。

### 关键实体

- TaskExecutionContext：冻结启动时的任务事实、可选 Agent 快照和有效首条指令。
- Session：实际多轮执行对话及 Provider 续接身份，拥有既有消息与事件历史。
- Runtime：Host 或 AgentOS 的独立注册与可用 Provider 能力。
- Workspace：既有 Task/Runtime 共享工作目录，保留 Runtime 锁定规则。

## 成功标准

- SC-001：一条通过 Mystra 正常生产链执行的真实 Task 在其工作区产生可阅读、符合启动指令的设计文档或 Taco，并提供路径与内容核验。
- SC-002：重建沙箱后第二轮成功运用第一轮仅存于对话的事实，继续修改同一工作区产物。
- SC-003：Host 与 AgentOS Runtime 同时在线，工作区和能力没有串用。
- SC-004：相同请求重放不重复启动；同键不同指令被拒绝。
- SC-005：笔记本临时代理停止时 host-c1 仍能解析 GitHub 分支；越权来源和非许可目标返回拒绝。
- SC-006：独立设计审查及独立开发后审查均完成，阻断项解决或由用户明确裁定。

## 不在范围内

不新增代码研发工具链、PR 自动化、通用 Artifact 产品、任意宿主命令代理、外部 Issue 写回、跨 Runtime 迁移、OpenSandbox、通用工作流或平台代管外部 CLI 凭据。文档交付复用现有可写工作区，不引入新的输出存储服务。
