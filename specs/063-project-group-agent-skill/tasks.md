# Tasks: MYST-38 可移植项目群 Agent 业务 Skill

**Input**: [spec.md](spec.md)、[plan.md](plan.md)，冻结业务设计 `MYST-38-SPEC-20260929-R2`。
**Prerequisites**: Linear 已改写；负责人仅批准项目群 spec/plan，其他设计不可替代。
**Tests**: Skill 无/有对照与读取冒烟是本单验收，真实 IM/工作区 E2E 不在本单。

## Phase 1：分诊与唯一任务入口（US1）
- [ ] T001 [US1] 在 `evidence/skill-verification.md` 记录无 Skill 情景的真实错误输出和判断，不把不带 Skill 的行为当新规程。
- [ ] T002 [US1] 在 `.agents/skills/project-group-agent/SKILL.md` 写明触发、输入、来源/权限核验，群内查询/讨论与明确委派分流，唯一 Thread+任务空间与局部失败恢复。
- [ ] T003 [US1] 对查询、歧义、首次/重复委派和局部失败做有 Skill 行为复测，逐项记录实际结果。

## Phase 2：多会话、跨空间协作及消息（US2）
- [ ] T004 [US2] 写明项目/任务空间的来源、Session/reset 续作、跨写授权/版本/冲突、敏感内容边界及父基线变化。
- [ ] T005 [US2] 写明周期/事件的证据、相关性、行动价值、去重、安静时段和无 Thread 时的安全目标；复测冲突、无变化/重复通知。

## Phase 3：设计、交付门禁及审查（US3）
- [ ] T006 [US3] 写明 spec/plan、非作者审查、Taco 或既有评审载体、人类明确批准，以及第二阶段仅到 PR 合并前；复测模糊批准和外部回执失败。
- [ ] T007 [US3] 静态检查 Agent Skills frontmatter，并从新的上下文读取 Skill 执行综合情景冒烟；将有/无对照、未接入限制写入 `evidence/skill-verification.md`。
- [ ] T008 [US3] 非作者审查全部变更，修正遗漏；刷新 `063-project-group-agent-skill.taco.html`，核对 bundle 内容；运行相关检查并提交 Mystra Draft PR（关联 MYST-38 与 #64）。

**Exit**: Skill 可复制、加载并在规定情景指导 Agent；审查及验证证据可读；Draft PR 未合并，不宣称连接了真实飞书或 DSH。