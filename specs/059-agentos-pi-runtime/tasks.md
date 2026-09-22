---
title: "059 实施任务与验收状态"
status: "进行中"
---

## 门禁与研究

- [x] T001 建立用户裁定的正式规范，明确修订固定研发指令、禁止将 caller instruction 提升为 system prompt。
- [x] T002 独立审查启动字段、两个入口、幂等与持久化设计；采用单一中立标准提示词。
- [x] T003 读取安装版 AgentOS/Pi 源码，确认 session.env 会持久化、additionalInstructions通道和Pi无native load能力。
- [x] T004 真实两轮跨VM实验通过：第一轮ACK，第二轮新VM正确回忆未重发随机marker，8.93秒；安装版open恢复可用，非Mystra完整链验收。

## Lane A：首条指令合同

- [x] T005 定义 initialInstruction 请求输入和有效默认，冻结有效文本；更新两套数据库模型及映射。
- [x] T006 生产start指纹与TaskSessionLaunch重放比较包含指令；Session首条消息使用冻结文本。
- [x] T007 API/MCP/CLI入口、帮助与可见schema同步；省略时中立默认，无UI新控件。
- [x] T008 标准提示词改为按任务要求交付；保留系统优先级、live上下文和生命周期约束。
- [x] T009 更新受影响fixtures，增加延后启动和同键不同指令的必要回归场景。

## Lane B：AgentOS/Pi

- [x] T010 锁定实际SDK依赖、消除部署绝对导入和假版本探测。
- [x] T011 显式传递Mystra会话标识及启动/续接意图，additionalInstructions承载系统提示词，非秘密env承载CLI路径。
- [x] T012 最小host binding环境、只读共享CLI、真实JSON解码；缺失作用域能力失败关闭，不持久化execution code。
- [x] T013 修正流文本拼接、stopReason映射、有界超时与VM释放；不得释放其他会话的共享sidecar。
- [x] T014 落实源码支持且通过实验的跨VM恢复；恢复失败不静默新建。

## 部署与验收

- [x] T015 host-a1受限常驻代理，host-c1已切换；允许来源真实git成功，非法来源/目标403，笔记本代理停止。
- [x] T016 Main统一执行针对性测试、依赖安装与数据库生成，修复错误后独立代码审查。
- [x] T017 通过正常授权Task入口执行文档任务，核对真实文件内容与归属。
- [x] T018 重建VM后继续同一Session并验证对话事实和产物修改。
- [x] T019 记录实际运行证据并刷新同目录Taco；不把Session ready算作完成。

## 复核加固

- [x] T020 独立正确性复核确认合同面成立；两项P2、两项P3进入本lane。
- [x] T021 模型凭据改为ephemeral挂载并在caller prompt前删除；遮蔽仓库`.pi/extensions`；显式`network`默认拒绝，仅放行`tcp://<模型主机>:<端口>`。本地与host-c1实测见`research.md`。
- [x] T022 组合失败关闭：`MYSTRA_PI_PATH`与`MYSTRA_RUNNER_RUNTIME_TYPE`不一致时拒绝启动，并在quickstart记录该变量。
- [x] T023 AgentOS deadline提前到`AgentOs.create`之前，create/模型配置/凭据删除全部纳入`bounded()`；失败时不再对不存在的VM调用cancel/dispose。
- [x] T024 保留adapter提供的`MYSTRA_SESSION_ID`，仅在adapter未提供时回填Mystra Session id，Pi续接身份合同可达。
- [x] T025 部署更新后的runner与adapter到host-c1并跑一次真实验收，确认凭据/出口加固不破坏Pi执行与跨VM续接；证据见`quickstart.md`「加固后复验」。

## 独立审查整改（PR #43）

- [x] T026 处理独立审查四项发现：Pi `exitCode=124` 映射为可续接的`session.response_canceled`；`end_turn` 无 assistant 文本不再判失败；AgentOS deadline/idle 环境变量改为正整数并在 Runner 启动与适配器加载时 fail fast；恢复 Standard Execution Prompt 正向责任断言；新增 guest workload binding 探测并在写入凭据前失败关闭。证据见`quickstart.md`「独立审查整改」。
- [ ] T027 **阻断项，需产品决策**：agentos-core 0.2.19 的 binding CLI 只支持宿主侧 `vm.process.execFile`，guest 内不可分派（实测见`research.md`），因此 FR-006 在当前 SDK 版本未达成，AgentOS Session 会在写入凭据前失败关闭。处置方案（三选一，均需 owner 决定）：
  - (a) 等待/推动上游修复 binding 的 guest 分派，本特性维持失败关闭；
  - (b) 改为 host-side 会话代理：Runner 内起一个只服务该 Session 的本地代理，guest 经 `loopbackExemptPorts` + 定向 `tcp://127.0.0.1:<port>` 放行访问，execution code 仍留在宿主，guest 只持有会话级 token（需要新规格、计划与评审）；
  - (c) 明确本版本 AgentOS Session 不提供能力回报（放弃 FR-006 的该条），仅把 Agent 产物作为交付物。

## 并发约束

Lane A拥有shared指令、控制面、MCP、CLI及相关测试；Lane B拥有Runner/session、agent-adapters及其包依赖。Main拥有锁文件统一安装、生成、运行验证、部署与特性文档。代理实现者不运行build/lint/tests。T014取决于T004结果；其余修复不依赖该实验。
