# Implementation Plan: 可移植项目群 Agent 业务 Skill

**Branch**: `063-project-group-agent-skill` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)（冻结业务来源 `MYST-38-SPEC-20260929-R2`）
**Input**: Feature specification from `specs/063-project-group-agent-skill/spec.md`；Linear MYST-38 已改写。

## Summary

沿用已有资产名 `mystra-flow`，以 `.agents/skills/mystra-flow/SKILL.md` 为唯一可复制、可发现的业务规程源。删除同名过时预设，令既有发布工具显式打包这一份文件；更新 Coordinator/Designer 提示词。先由可信群身份/配置或**已核验属于当前群的项目 workspace 内受控配置**取得分别绑定的 repo 与 IST（Issue 跟踪系统/来源）及精确 Issue 范围，不强制群 ID；群绑定仅路由目标，对 repo、IST 的实际读取和写入按动作独立核对委派人/项目策略及 Agent 权限。满足 repo PR 写入条件后在阶段一创建/复用占位 Draft PR，设计批准只控制实施。仍先查证真实行为再宣称成功；本方案是**业务规程资产及分发源切换**，不是将飞书/工作区能力伪装成服务端实现。

## Technical Context

**Language/Version**: Markdown + YAML frontmatter（Agent Skills 规范）；Node 24.14.0 用于静态检查。
**Primary Dependencies**: 无运行依赖；本仓库 `.agents/skills/` 的可发现路径。
**Storage**: Git 版本化的单一 Skill 文件；已有发布工具仅在操作者显式运行时可上传其 ZIP，本单不对任何实例发布。
**Testing**: Agent 无/有 Skill 压力测试、新名称发现/读取冒烟、预设 ZIP 校验与出版工具相关测试；本仓库特性文档另做 Spec-Kit/Taco 静态核对，不把它们写进通用 Skill。
**Target Platform**: 能读取 Agent Skills 的任意 Agent 环境；本仓库仅是存放与版本控制位置。
**Project Type**: 便携流程 Skill，不是服务或 UI。
**Performance Goals**: 不适用（静态文本）。
**Constraints**: Skill 内容不能调用不存在的 API，不引入配置、网络、存储或 Mystra 依赖；唯一同名源，不能把旧版三阶段预设留作第二套权威。仓库未定义 IST 专有实体，通用文案仅按 Issue 跟踪系统/来源处理；群配置、可信 workspace 关联及运行时可用权限由采用者提供，不臆造可用服务；workspace 普通文件不是授权配置。
**Scale/Scope**: 单一 Skill 与必要的预设发布入口/预设提示词切换，以及本仓库所需的最小特性文档；采用者无需 Spec-Kit，也不预设需求或计划文件名；不改平台执行、飞书或 DSH 实现。

## Constitution Check

- I：已正式改写 Linear，本 Skill 仅书面指导，不扩展 Mystra MVP/触发器/API。
- II–IV：不新增服务边界、持久化、执行凭据或沙箱接口；强调来源和权限，不对外宣称部署。
- V：用无/有 Skill 的行为证据、静态结构与独立审查验证资产；包括未绑定、跨域目标、凭据越权与两端授权独立的压力题；无真实飞书/IST 接入不声称端到端通过。
- UI：无用户界面，`apps/spec-prototype` 不适用。GitNexus 对 `readSkillPresets` 上游评估 LOW（直接调用者 `publishPresets`、下游发布脚本及 E2E，未识别业务执行流程）；切换预设发布入口后需验 ZIP 与更新/未变两条路径，不声称运行端已经装载。

## Project Structure

### Documentation (this feature)

```text
specs/063-project-group-agent-skill/
├── spec.md
├── plan.md
├── tasks.md
├── checklists/requirements.md
├── evidence/skill-verification.md
└── 063-project-group-agent-skill.taco.html
```

### Source Code (repository root)

```text
.agents/skills/mystra-flow/SKILL.md
presets/agents/coordinator.md
presets/agents/requirement-designer.md
scripts/publish-presets.mjs
scripts/testing/publish-presets.test.ts
```

**Structure Decision**: repo-local `.agents/skills/mystra-flow/` 是唯一权威源；`presets/skills/mystra-flow/` 的旧正文与新两阶段门槛冲突，因此直接移除。显式运行 `publish-presets.mjs` 时，从 repo-local 源打包同名 Skill；不自动上传，也不把上传/安装等同于宿主飞书/工作区能力。预设提示词只按可用能力协调，不再硬编码旧三阶段调度。

## Design and verification gates

1. 需求门槛：确认源设计版本、Linear 新范围、用户的人审决定及原范围遗留；读取现有仓库 Skill/frontmatter 习惯。
2. RED：无 Skill 输入三类以上情景，保存模型原话与错误；包含仅查询却开楼、准备一半却退回群工作区、模糊批准等。
3. GREEN：写唯一完整 Skill，先从可信群上下文或已核验归属的项目 workspace 受控配置取得 repo/IST 双绑定及精确 Issue，不因缺少群 ID 就拒绝有效 workspace 绑定；再按 repo 与 IST 的读取/写入动作、发起者授权、项目规则及 Agent 执行身份逐项判权，仅在对应 repo PR 写权满足后，阶段一提或复用占位 Draft PR，再写空间协作/主动通知/两阶段。需求说明和实施计划分别可审，但采用者的文档约定优先，没有通用的 Spec-Kit 或固定文件名。对相同情景和额外权限变体复测。不写从未验收的具体命令。保留反馈批处理、原评审件复用、显式批准和真实回执；删除无条件建楼、旧三阶段、强制状态流转等冲突行为。
4. REVIEW：非作者检查遗漏、冻结设计一致性、措辞将内容与能力分开的真实性；修订后复测。Taco 只镜像本目录产物而非替代冻结源 Taco。
5. DELIVERY：校验 Skill frontmatter、新名称的独立 Agent 发现/读取、预设 ZIP 及发布差异路径、Taco bundle、相关静态检查、Draft PR 关联；PR 停在合并前，不发布到任何实例。

**工程评审**：业务 Skill 不增加接口/数据模型、并发代码或性能风险。切换现有预设读取路径会影响显式发布命令的内容，因此核对唯一源、ZIP 校验和既有版本发布/未变分支；发布不自动执行。最大风险仍是把书面规程当成飞书/工作区功能，通过前置条件、失败停机与明确验证界限解决。未来若要求真实承载，须另行设计并实测，不向当前 Skill 增加假的适配层。

## 群绑定与授权设计

| 步骤 | 可信证据与决策 | 缺失/冲突 |
| --- | --- | --- |
| 发现目标 | 可信群身份或经宿主核验属于当前群的项目 workspace → 有权维护、来源/版本可核的绑定配置；分别读 repo 的连接/稳定身份/分支与 IST 的连接/稳定 Issue 范围，服务读回核对，精确 Issue 必须属于范围；群 ID 可用但非必需。 | 不用普通 workspace 文件、群消息、Issue repo 链接、当前目录、默认 CLI 登录或 ID 前缀直接推断；workspace 归属/配置权限不可核、可信来源冲突或跨范围请有权维护者裁决，不自动建 PR/Thread。 |
| repo 动作 | 查询与外发要有可见权；推送/分支/PR 需具体工作的授权委派、项目分支规则与 Agent 在**绑定 repo** 的写入能力；合并/删除另行授权。 | IST 可读、群主身份或 Agent 持宽权限 token 均不能替代 repo 动作授权。 |
| IST 动作 | 有权读取该 Issue 才能用于分诊与 PR 关联；创建、评论、状态/指派/标签变更各自需 Issue 范围、发起者授权、项目规则与 Agent 的 IST 写入能力。 | PR/设计批准不自动触发 IST 写回；repo 写权限不授予 IST 写权限。 |
| 回执与隔离 | 分别记录当前群/所属 workspace 的可信身份、配置来源/版本、资源稳定身份、发起者、动作、授权依据和执行回执；只向有权接收方汇报可见事实。 | 缺一个条件只停受影响动作，不能借其他群/项目凭据绕过或把一端成功称为双端成功。 |

本单只交付操作规程；宿主是否提供可信群身份或群→workspace 关联、受控配置读取、外部授权判定及执行凭据是采用时的前置能力，不伪称 Mystra 现有控制面已实现。

## 旧预设逐项取舍（仅审查业务规则）

| 旧 `mystra-flow` 规则 | 取舍与当前落点 |
| --- | --- |
| 核实 Issue、项目、仓库及已有任务，防止重复创建 | 保留并扩展至原消息、权限、原 Thread/任务空间身份；见 Skill「先核实什么」「工作区与任务身份」。 |
| 原 Thread 集中评审，读完未决 Taco 评论后批量修订、刷新同一评审件并通知复审 | 保留为与具体产品无关的一轮反馈流程；提醒不等于已读，逐条记录争议、源版本和回执。 |
| 只有明确的人类批准才能进入下一阶段；模糊赞同和催促不算 | 保留并加强批准人权限、批准的需求说明/实施计划版本与未决意见核查；仅出现“通过”字样不自动过门。 |
| 工具未提供、消息已发送但未处理、Taco 未更新时不可虚报 | 保留为通用的缺能力停机与每一步独立回执；不绑定 MYST-28 具体工具或幂等字段。 |
| 主群只要 `@Bot + Issue ID` 就强制建楼及启动 Mystra Task | 淘汰：查询与提及不是委派；可追踪且授权的工作才进入唯一任务上下文。 |
| 三阶段以及四字“跳过设计”旁路、首轮占位提交/Draft PR、强制 `In Review` | 拆分取舍：**保留首轮占位 Draft PR**，确认群对应仓库和授权工作身份后在阶段一创建/复用，最小可追溯内容形成可比较分支；不等人审，也不授予实施权限。淘汰旧三阶段、跳过设计口令、无条件状态流转及特定平台工具。 |
| Coordinator 不得亲自写任何设计内容、必须选择特定 Agent/Runtime/Provider | 不作为可移植 Skill 规则；单人可兼任职责但审查须非作者，运行资源由采用者实际能力决定。 |

## Complexity Tracking

无宪章例外。