# Tasks: MYST-38 可移植项目群 Agent 业务 Skill

**Input**: [spec.md](spec.md)、[plan.md](plan.md)，冻结业务设计 `MYST-38-SPEC-20260929-R2`。
**Prerequisites**: Linear 已改写；负责人仅批准项目群 spec/plan，其他设计不可替代。
**Tests**: Skill 无/有对照与读取冒烟是本单验收，真实 IM/工作区 E2E 不在本单。

## Phase 1：分诊与唯一任务入口（US1）
- [x] T001 [US1] 在 `evidence/skill-verification.md` 记录无 Skill 情景的真实错误输出和判断，不把不带 Skill 的行为当新规程。
- [x] T002 [US1] 在 `.agents/skills/mystra-flow/SKILL.md` 写明触发、输入、来源/权限核验，群内查询/讨论与明确委派分流，唯一 Thread+任务空间与局部失败恢复。
- [x] T003 [US1] 对查询、歧义、首次/重复委派和局部失败做有 Skill 行为复测，逐项记录实际结果。

## Phase 2：多会话、跨空间协作及消息（US2）
- [x] T004 [US2] 写明项目/任务空间的来源、Session/reset 续作、跨写授权/版本/冲突、敏感内容边界及父基线变化。
- [x] T005 [US2] 写明周期/事件的证据、相关性、行动价值、去重、安静时段和无 Thread 时的安全目标；复测冲突、无变化/重复通知。

## Phase 3：设计、交付门禁及审查（US3）
- [x] T006 [US3] 写明分别可审的需求说明与实施计划（不强加 Spec-Kit 或文件名）、非作者审查、原 Thread 批量处理意见、复用同一评审件、人类明确批准，以及第二阶段仅到 PR 合并前；复测模糊批准和外部回执失败。
- [x] T007 [US3] 静态检查 Agent Skills frontmatter，并从新的上下文读取 Skill 执行综合情景冒烟；将有/无对照、未接入限制写入 `evidence/skill-verification.md`。
- [x] T008 [US3] 非作者审查最初交付，修正遗漏；刷新 `063-project-group-agent-skill.taco.html`，核对 bundle 内容；运行相关检查并提交 Mystra Draft PR（关联 MYST-38 与 #64）。
- [x] T009 [US3] 按负责人后续命名决定切换唯一源为 `.agents/skills/mystra-flow/SKILL.md`；删除同名旧预设，更新发布入口及 Coordinator/Designer 旧三阶段文案，移除过时的测试断言。
- [x] T010 [US3] 记录旧规则保留/淘汰依据；新名称从空白 Agent 上下文加载并复测评审反馈及无 Spec-Kit 项目，验证预设 ZIP、相关测试与 Taco 一致性；非作者指出的发布文档路径已修正并更新 Draft PR，保持未合并且不执行实例发布。
- [x] T011 [US1/US3] 按负责人更正保留群仓库确认后的早期占位 Draft PR，将 PR 创建与设计批准/代码实施分开；同步 Skill、Coordinator/Designer、规格/计划及证据，复测无设计批准、重复委派和 PR 权限失败，刷新 Taco，更新现有 Draft PR。
- [x] T012 [US1/US2] 从稳定群身份发现 repo 与 IST 双绑定，分别判权 repo 查询/推送/PR/合并及 IST Issue 查询/创建/评论/状态/指派，拒绝跨群、错范围和凭据越权；同步 Coordinator/Designer、spec/plan/清单与证据，复测正反情景并刷新 Taco；保持 Draft PR 未合并。验证见 `evidence/skill-verification.md`（2026-09-29 双端权限节）。

**Exit**: Skill 可复制、加载并在规定情景指导 Agent；审查及验证证据可读；Draft PR 未合并，不宣称连接了真实飞书或 DSH。