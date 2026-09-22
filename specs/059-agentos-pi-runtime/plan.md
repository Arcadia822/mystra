---
title: "059 实施计划：启动指令与 AgentOS 文档执行"
status: "启动合同完成独立设计审查；SDK 跨 VM 实验通过，实施中"
spec: "spec.md"
---

## 概要

复用 Task production start、Task Session launch、Workspace preparation 和 SessionEvent 链。调用者输入 `initialInstruction`，共享 schema 在请求边界解析为非空有效文本；生产启动时冻结进 TaskExecutionContext，稍后创建 Session 时只读取冻结文本。单一 Standard Execution Prompt 改为工作负载中立，不增加变体选择器。

AgentOS 的 SDK 恢复、系统提示词与短期能力交付依据安装版本源码落实。显式 sessionId 加相同 SQLite 的真实双轮跨 VM 实验通过，详见 research.md；常驻 GitHub 出口已独立完成运行验证。

## 技术上下文

- TypeScript 5.9，Node24.14.0，pnpm10.25.0，Next16，Zod4，Prisma7.9.1，Vitest4。
- SQLite 与 PostgreSQL/Supabase-backed PostgreSQL 的相同领域字段，经 RdbProvider 持久化。
- 已部署 AgentOS core0.2.19、Pi0.2.7，但尚未纳入仓库依赖锁定，属于实现阻断项。
- host-c1 运行控制面和独立 Host/AgentOS Runner；host-a1 为内网 GitHub CONNECT 出口。
- 规模：一个真实文档任务，至少两轮同一 Session，其中第二轮重建 VM；不以性能调参替代正确性修复。

## 宪章检查

- 059 明确承接用户对可控启动指令、非代码文档工作负载和常驻代理的裁定；修订旧规范中全任务强制代码/PR的部分。
- API、MCP、CLI 使用共享 schema；UI 当前可继续省略可选字段，不在本次增加新输入界面。
- 单一程序拥有的 Standard Execution Prompt 保留优先级、hash和证据结构；用户指令只进入 user message。
- 执行 code 不能写入 AgentOS 持久化 env_json、会话文件、提示词或日志。不可使用伪造登录会话完成验收。
- Pre0.1 不添加旧格式双读、别名或恢复 shim。现有已部署数据的任何破坏性重建必须先由用户批准；新增功能所需数据库字段由两种数据库同等定义。

## 数据流

```text
API / MCP / CLI
    -> shared request schema: initialInstruction or neutral default
    -> start fingerprint + TaskExecutionContext frozen initialInstruction
    -> Workspace preparing / ready
    -> Session firstUserMessage from frozen instruction
    -> frozen system prompt + short-lived workload capability
    -> AgentOS Runtime -> Pi -> Task Workspace document
    -> typed SessionEvent; ready is not document acceptance
```

后续新 Session 可接收自己的首条指令；省略时使用同一个中立默认。恢复同一 Session 使用已有消息接口，不重新定义 bootstrap 指令。

## 源码结构与变更顺序

1. shared/task-execution-context.ts 定义中立默认和指令 schema。复用现有消息长度上限，避免循环依赖；必要时将消息常量放入现有依赖安全的基础模块。
2. taskStartRequestSchema 与 taskSessionLaunchInputSchema 增加可选输入；解析结果为有效字符串。TaskExecutionContext 保存必需的已解析文本，不能等到 launch 时重新取默认。
3. TaskProductionService.start 的指纹和冻结对象保存该字段。TaskSessionLaunchService 的首次启动传递它、plannedSessionId 重放比较它。
4. SessionService.launchExecutionContext/launchForTask 使用有效指令；现有 session launchPayload 比较负责后续新 Session 幂等。
5. MCP Zod 与公开 JSON inputSchema、CLI 参数白名单/帮助/请求体同步。pass-through API 不重复验证。UI 无新控件，省略字段有中立默认。
6. 两种 Prisma schema 和 provider 映射保持同构，更新真实行为受影响的 fixtures；禁止为了兼容旧测试省略必需持久化字段。
7. 单一 Standard Execution Prompt 只在任务要求代码交付时指导代码自测/PR；保留 live mystra-agent 上下文与 lifecycle 约束。
8. AgentOS 修复独立子流：依赖锁定、相对导入、身份、真实恢复、正确 stopReason、短期能力、只读共享 CLI、deadline与释放。具体 API 由源码研究补齐后实施。

## 验证

- 永久回归测试重点：同键不同指令冲突、延后 Workspace 后指令不丢失、首条 user message不进入系统提示词、非成功停止不报成功。
- 精确运行现有 shared、task-production、task-session-launch、session-service、MCP和CLI相关测试；修复因领域字段变化失效的 fixtures。
- host-c1 正常授权启动设计文档 Task；检查最终文件存在、内容满足指令、路径属于该 Task Workspace，不能只采信 Agent 自述。
- 第一轮对话注入随机事实，第二轮重建 VM 后不重发事实，验证真实续接与文件修改。
- 代理已验证：host-c1 git ls-remote 返回7ecf239d3e096499eea8735453f048adff008c13；非host-c1来源及example.com目标均403；临时笔记本代理已停止。

## 独立审查与现有能力

LaunchContractReview 第二轮接受 narrowed instruction contract 与单一中立系统提示词。早期建议多标准提示词变体被源码复核否定，不采纳。保留其有效发现：指纹、持久化、两个启动入口和SDK可复现性必须完整覆盖。

已有 launchPayload 对完整 launch request 执行重放比较；复用，不另建幂等机制。已有 TaskExecutionContext 支持延后启动；只增加冻结字段。已有工作区是文档产物的交付载体；不新增 Artifact 服务。

GitNexus 使用仓库固定版本；全局 mystra 名称冲突通过当前工作区 `.gitnexus/session-registry` 的 GITNEXUS_HOME 隔离解决，不改变全局 registry。TaskProductionService impact HIGH，5直接依赖、13总影响、2流程；实现前已向用户报告。LSP references确认生产start、MCP、TaskSessionLaunchService及测试调用者。

## 风险与失败模式

|路径|失败|处理和证据|
|---|---|---|
|启动参数|空白或超长|共享消息边界验证|
|请求重放|不同指令被忽略|指纹及plannedSessionId比较，回归测试|
|延后启动|默认变化导致旧请求改变|冻结有效文本，回归测试|
|AgentOS恢复|相同UUID但新会话|真实双轮实验，恢复失败必须显式报错|
|能力交付|code持久化或宿主环境泄漏|binding/env源码审查与最小环境|
|Provider结束|非成功stopReason报成功|枚举映射，错误路径验证|
|进程释放|dispose挂住|源码研究后制定有界释放，不靠打印警告|
|沙箱凭据|guest读取模型apiKey或写入持久化面|credential只放ephemeral挂载并在首个caller prompt前删除；实测见`research.md`|
|仓库扩展|工作区`.pi/extensions`在凭据存在时执行|只读`memory`挂载遮蔽该路径；实测`.pi/extensions`对guest为空|
|出口扩散|guest把内容发往任意公网主机|`network`默认`deny`，只放行`tcp://<模型主机>:<端口>`；pattern匹配规范化资源串，写法与实测见`research.md`|
|配置漂移|Runner按host类型启动但不探测Pi|`MYSTRA_RUNNER_RUNTIME_TYPE`与`MYSTRA_PI_PATH`不一致时启动失败|

## 不在范围内

OpenSandbox、通用workflow变体、UI新输入控件、代理TLS解密、第三方镜像、Issue写回、PR自动化、宿主凭据代理、跨Runtime迁移。未新增性能/遥测框架。

## 并行策略

- Lane A：shared指令合同、控制面持久化和服务、MCP/CLI、标准提示词。
- Lane B：AgentOS SDK、Runner/Pi、会话恢复与上下文能力，等SDK研究后启动。
- Main：合同集成、数据库生成、统一验证、部署、真实Task与Taco刷新。
- 两条实现线不共享文件；公共Provider key已存在，不由Lane A修改。子代理不运行构建、lint或测试，Main在整合后统一验证。
