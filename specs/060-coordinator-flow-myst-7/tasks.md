---
title: "060 实施任务拆解与验收清单"
status: "资产已落地；流程行为验证待前置 MYST-28"
spec: "spec.md"
plan: "plan.md"
---

## 交付边界

本特性只交付 Mystra 托管的**资产**（Agent Profile 预设与 `mystra-flow` Skill），不实现控制面服务端接口。

`mystra-flow` 的步骤 5/6 在文本上依赖“向原 Session 追加一条 User Message”。该能力当前**在控制面无可达入口**（`SessionService.sendMessage` 已实现但无 HTTP/MCP/CLI 暴露），由 [MYST-28](https://linear.app/castrel/issue/MYST-28/为-session-续接与读取补齐可达入口http--mcp--cli) 补齐。在此之前，T007/T009/T012/T013 只能在资产层面成立，不能作为端到端可达行为验收。

## 阶段一：Profile 资产（User Story 1 基础）

- [x] T001 定义 Coordinator Agent Profile 资产 `presets/agents/coordinator.md`，包含责任边界、责任断言（禁止本地写代码/Spec）与飞书 Thread 隔离机制。
- [x] T002 定义 Requirement Designer Agent Profile 资产 `presets/agents/requirement-designer.md`，规范起手 Draft PR、Spec 撰写、Taco 发布/刷新、批注批处理与批准后固化收尾职责。

## 阶段二：mystra-flow Skill 资产（User Story 1 & 2 核心）

- [x] T003 创建 `presets/skills/mystra-flow/SKILL.md`，显式声明研发三阶段框架，并重点展开第一阶段（需求设计与 Taco 评审）规程。
- [x] T004 在 `mystra-flow` 中写入飞书 `@Bot` 触发与 Thread 隔离规范，建立 Issue、Project、Repo 与 Thread 的绑定映射及防重入规则。
- [x] T005 在 `mystra-flow` 中写入 `initialInstruction` 组装要求，覆盖“起手检出分支与 Draft PR、编写 Spec-Kit、执行 taco-cli publish、linctl 回填 In Review”四项执行标准。
- [x] T006 在 `mystra-flow` 中写入评审通知规范，要求向飞书 Thread 返回 Taco URL 与 Draft PR URL，并提示集中批注。

## 阶段三：反馈中继与批准门禁（User Story 2 & 3 核心）

- [x] T007 在 `mystra-flow` 中写入批注修改中继规范：仅由人类在 Thread 的显式汇总通知触发一次批处理续接消息，不逐条转发评论。
- [x] T008 在 `mystra-flow` 中写入确定性批准门禁：只有无歧义的“通过 / 批准”才触发收尾，模糊肯定一律不触发。
- [x] T009 在 `mystra-flow` 中写入固化收尾与总结汇报规范：输出最终 Spec 路径、Taco 归档与 PR 链接，且不得自动将 Linear Issue 置为 `Done`。

## 阶段四：资产发布与校验（平台侧）

- [x] T010 资产发布脚本 `scripts/publish-presets.mjs`：读取 `presets/` 全部 Profile 与 Skill，构建确定性 Skill ZIP，并通过 canonical 管理 API 完成创建/更新/跳过判定；支持 `--only=agents|skills` 分节发布（两侧基础设施依赖不同）。
- [x] T011 资产断言测试 `scripts/testing/publish-presets.test.ts`：覆盖责任断言、MCP 能力名引用、分节选择、以及 ZIP 通过控制面 `validateSkillZip` 真实校验。
- [x] T011b 按 `writing-skills` 的 RED→GREEN→REFACTOR 对 `mystra-flow` 做行为验证：基线测出批准门禁 2/3 违规、`纯琐碎修改` 豁免条款 3/3 绕过；改写后复验 6/6 合规。证据与逐字借口见 `evidence/skill-verification.md`。
- [x] T012 资产（Agent Profiles + mystra-flow Skill ZIP）发布到 host-c1 的真实 Mystra 验证全量通过（`scripts/e2e-publish-presets.mjs --with-skills`，9/9）：在 c1 落地本地 MinIO（解决并关闭 MYST-29），控制面经 canonical 管理 API 完成 Agent 创/更/退，以及 Skill 创建与 Revision 升级；MinIO 桶内已落盘 2 版不可变 ZIP（每版 3571 bytes）。证据见 `evidence/t012-real-publish.md`。
- [ ] T013 [阻塞：MYST-28] 端到端场景验证：触发、调度、Draft PR/Taco 交付、批注中继刷新同一 Taco、明确批准后固化收尾。
