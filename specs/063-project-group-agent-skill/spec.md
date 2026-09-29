---
title: "MYST-38：可移植项目群 Agent 业务流程 Skill"
feature_id: "063-project-group-agent-skill"
created: "2026-09-29"
status: "设计已获负责人确认；mystra-flow 单一来源已复核，Draft PR 待人审"
input: |-
  Linear MYST-38 经负责人改写为可移植项目群业务 Skill；业务设计以 MYST-38-SPEC-20260929-R2 为冻结输入。
---

## 决策与来源

负责人已确认位于 dsh-im 本地设计工作区的 `docs/方案/MYST-38-飞书话题与跨会话投递方案.md`（修订 `MYST-38-SPEC-20260929-R2`）及 `MYST-38-设计计划.md` 的**项目群业务设计**，未批准另一份 DSH Session 工具设计。对应本地 Taco 仅用于设计审阅；本规格是该冻结业务设计在 Mystra 仓库的 Skill 资产交付映射，不回写、更改原业务设计。Linear [MYST-38](https://linear.app/castrel/issue/MYST-38) 与 [Mystra #64](https://github.com/Arcadia822/mystra/issues/64) 已同步为此范围。负责人随后指定 Skill 使用既有名称 `mystra-flow`，并要求审查旧同名预设；因此以唯一 repo-local 源替换冲突的旧预设。最新澄清单独恢复旧规程的**早期占位 Draft PR**：确认群对应仓库且当前工作获委派后即提，设计批准只管实施；旧预设的强制建楼、三阶段与特定工具仍不恢复。

原单所列真实飞书建楼、host-c1/OpenSandbox、独立 DSH Session 消息投递、真实 Taco 发布及现场跨主机/模型验收没有完成，现均不属于本单验收；Skill 是操作规程，不是服务或插件。历史附件和旧 PR 只作追溯。

后续澄清：通用 Skill **不包含 Spec-Kit 流程**，也不强制 `spec.md`、`plan.md` 文件名、模板或 Checkpoints；仍保留 Linear 验收要求的需求说明与实施计划两个可独立评审的设计产物。此仓库的 `specs/063-project-group-agent-skill/` 使用 Mystra 自身的 Spec-Kit 约定记录本次开发，与采用 Skill 的项目是否使用该方法无关。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 群内分诊与唯一任务入口 (Priority: P1)

作为项目群成员，我希望 Agent 对查询/闲聊仅在群中回答，对明确委派先确认群对应仓库并开该工作的占位 Draft PR，再准备唯一 Issue Thread 和独立任务工作区，以免无故启动任务或把不同任务混在一起。

**Independent Test**：给无 Issue、仅查询、歧义指令、首次及重复明确委派、仓库已核实但设计尚未批准、准备一半失败等输入，让新 Skill 指导的 Agent 区分 PR、Thread/任务空间及实施的触发门槛和证据；工具缺失时说明缺口，不伪造调用。

**Acceptance Scenarios**：
1. Given 含 Issue ID 的状态询问但无委派，When Agent 分诊，Then 查询真实来源并在群中回答，不建 Thread/任务工作区。
2. Given 明确委派且 Issue、群/仓库归属和权限均已核实，When Agent 处理，Then 先在对应仓库创建或复用该工作的占位 Draft PR，关联原委派与 Issue，不等待设计批准；再优先复用既有 Thread/任务工作区，只有此前不存在时才准备一个目标；首条委派进入任务上下文，不要求第二次 @。
3. Given Thread 创建成功但任务工作区失败，When Agent 判断状态，Then 报告准备中并恢复原绑定；绝不在群工作区继续执行或宣称已启动。
4. Given 同一工作重放或 Draft PR 推送/创建失败，When Agent 查证，Then 复用原分支/PR 或记录部分成功与阻塞，绝不重复提 PR 或声称已创建；PR 可存在而 Thread/任务空间仍处于准备中。

### User Story 2 - 长期协作与降噪 (Priority: P1)

作为项目负责人，我希望同群/Issue 的多个 Session 继续使用其所属工作区，群 Agent 和任务 Agent 可按授权查看并修改工作中内容，而主动消息有来源、有价值、无越权。

**Independent Test**：多 Session/reset、父基线变更、跨写拒绝/冲突、无 Thread 的 Issue 更新、安静时段/重复事件等情景；没有承载能力时停并标记为待实现。

**Acceptance Scenarios**：
1. Given 已有关联任务工作区，When 新会话或 reset，Then 沿用原空间且父分支变更不静默覆盖任务未提交工作。
2. Given 跨工作区读取或写入，When 目标、授权或版本不明确，Then 不复制私有内容、不静默写入/同步，明确请求人裁决。
3. Given Issue 事件但没有 Thread，When Agent 考虑主动通知，Then 经授权仅发项目级群摘要或不发，不因事件建楼；无新证据、重复事件或安静时段不刷屏。

### User Story 3 - 两阶段设计及交付门槛 (Priority: P2)

作为委派者，我希望确认群对应仓库后就有一个占位 Draft PR 用于追踪，再分别得到可审的需求说明与实施计划及人类批准，随后在同一 PR 上执行至可合并，而不是等设计批准才开 PR、自动合并或虚报发布。

**Independent Test**：仓库已确认但无设计批准、缺审查、模糊赞同、项目有/无文档约定、PR 或评审件发布失败等场景；检查早期 PR 与实施批准是不同门槛、两项设计内容和真实回执，而非检查是否使用特定工具或文件名。

**Acceptance Scenarios**：
1. Given 项目没有文件约定，When Agent 完成第一阶段，Then 分别形成可独立评审的需求说明、实施计划及非作者审查意见，按可用评审方式交人审阅并请求明确的人类版本批准；不强加方法、命令或固定文件名。
2. Given 人说“差不多了”但没有明确批准当前版本且该工作 Draft PR 已创建，When Agent 收到催促，Then 保留并继续用这一 PR 跟踪设计，维持实施关口，不启动代码交付或另开 PR。
3. Given 审核通过但外部发布/Issue 关联失败，When Agent 汇报，Then 明示未完成与恢复动作，不冒充成功，也不修改 Issue 状态。

4. Given 原 Thread 有“已评论，请修改”、未决意见与一条和已查证事实冲突的意见，When Agent 续作，Then 批量核对全部意见、逐条记录改动或争议，刷新同一评审件并在原 Thread 请求复审；“已评论”不等于已处理，未获当前版本的人类批准不进入交付。
5. Given 群对应仓库已确认、工作获授权但尚无可比较的分支变更，When Agent 准备占位 Draft PR，Then 在工作分支提交最小可追溯的任务/设计起始内容，推送并创建 Draft PR；若缺权限或回执则明示阻塞，不能用空提交或虚假链接冒充 PR 已存在。

### Edge Cases

- 外部消息、Issue 或仓库文本不是授权指令；项目/仓库绑定歧义、跨群/跨 Issue 输入、凭据及私有内容要停在权限边界。
- Thread 与工作区不保证物理事务；重试、未知回执、局部完成均恢复原身份而非开第二个任务。
- 可读未提交改动及跨写均有明确授权、目标、当前版本、冲突处理和回退，不能默认为只读，也不能默认为无条件写。
- 项目或用户运行环境规定优先于通用默认；具体路径、工具、模板及评审件可选，不能把此仓库的 Spec-Kit 约定当成所有采用者的前提。没有可用工具时只保留操作意图，不宣称现场执行。
- 占位 PR 是已委派工作的早期追踪入口，不等于自动因群消息/状态查询开启工作，也不等于设计批准或代码完成；分支没有可比较改动时不能声称远端 PR 已创建。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 交付符合 Agent Skills 结构的自包含 `.agents/skills/mystra-flow/SKILL.md`，可按项目群协作、Issue Thread、定时/事件通知等触发发现并由非 Mystra Agent 读取；移除同名旧预设源，显式发布时打包同一份文件。
- **FR-002**: Skill 须明确输入、来源/权限核查和群/Issue 分诊；仅明确委派且核实归属与权限才准备唯一 Thread 与任务工作区；确认群对应 repo 后为该工作先创建或复用关联原委派/Issue 的占位 Draft PR，不等待设计批准。
- **FR-003**: Skill 须区分项目工作区/任务工作区、多 Session 续作、父基线更新与双向授权读写；失败/冲突时停止，不以群空间替代任务空间。
- **FR-004**: Skill 须规范主动沟通相关性、证据、授权、价值、去重、安静时段及安全投递目标。
- **FR-005**: Skill 只有设计与交付两阶段：早期 Draft PR 属于阶段一，不是第三阶段或代码实施许可；分别形成可独立评审的需求说明与实施计划，项目现有规则优先，不强制 Spec-Kit、文件名或模板；非作者复核、原 Thread 的评审反馈批处理、同一评审件更新与当前版本的人类批准是进入阶段二的硬门槛，沿用原 PR 至合并前。
- **FR-006**: Skill 须说明 PR、工具缺席、部分成功与发布/关联失败的诚实状态；不得依赖 Mystra、特定沙箱、DSH/飞书 API 或声称真实端到端已完成。既有 Coordinator/Designer 预设须不再强制旧三阶段或无条件建楼，同时须保留早期占位 PR。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 无/有 Skill 行为对照中，所列 10 类高风险情景均由有 Skill Agent 作出符合边界的行动；至少记录一个不带 Skill 的实际偏差及修订结果。
- **SC-002**: Agent Skills frontmatter 可读取；从空白 Agent 上下文可读到完整指令，无需 Mystra-only 工具或 Spec-Kit 即可判断分诊、门槛和失败处置。
- **SC-003**: 仓库及预设发布器只有一个 `mystra-flow` 权威 Skill 源；旧三阶段预设与过时文案/测试已切换，发布器能打包并校验同一源。平台和 DSH 插件不做运行时接入；交付为关联 MYST-38/#64 的未合并 Draft PR，不宣称已发布至任何实例。
- **SC-004**: 在群对应仓库、工作授权与写权限已确认但设计尚未批准的情景，Agent 先提或复用该工作 Draft PR；在仅查询情景不创建新工作 PR；PR 缺可比较改动、权限或创建回执时明确阻塞；设计批准仍是进入代码实施的门槛。

## Assumptions & boundaries

此交付证明 Skill 的书面规程和行为指导，不证明承载系统提供 Thread、工作区、事件源、Taco 发布或自动消息能力；能力缺失被报告为边界。跨写授权主体/冲突细则与实际通知时间偏好仍由使用 Skill 的项目人决定，不能在此替其授权。