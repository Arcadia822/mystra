# Specification Quality Checklist: MYST-38 可移植业务 Skill

**Purpose**: 在设计冻结且 Linear 范围已更新后，检查现行 `mystra-flow` 单一 Skill 源的产物规格。
**Created**: 2026-09-29
**Feature**: [spec.md](../spec.md)

## Content Quality
- [x] 三条用户旅程可独立验证，并说明书面指导与平台能力的界线。
- [x] 已经由负责人确认业务设计，仅原项目群业务 spec/plan 获批准，DSH 设计不在其中。
- [x] 业务验收不依赖文件、API 或特定承载方式；资产命名与显式分发源校验单独列为交付验收。

## Requirement Completeness
- [x] 无待澄清占位符；未获具体授权的跨写细则明确在使用时由项目人决定。
- [x] 边界、失败路径和非目标明确。
- [x] 无/有 Skill 验证包含可观测偏差与行为改善。
- [x] 与已改写 Linear MYST-38、冻结业务设计一致；旧现场验收未伪称已通过。
- [x] 后续命名裁决已纳入 SC-003；旧 `mystra-flow` 同名预设被清理，保留/淘汰的旧规则有逐项依据。
- [x] 通用 Skill 的两项设计产物不预设 Spec-Kit、文件名或审查工具；本仓库的 Spec-Kit/Taco 文档仅是自身交付约束。
- [x] 负责人更正已纳入 SC-004/005：已委派工作须核实群关联 repo/IST 双绑定、Issue 归属及 repo PR 授权后先提或复用占位 Draft PR；只有实施须等当前设计获批。纯查询不启动工作，PR 无分支差异/权限/回执时不得虚报成功。
- [x] 已区分“当前群绑定的 repo/IST 目标”与“发起者按精确动作的授权、Agent 执行凭据、项目规则”的交集；IST 仅作 Issue 跟踪来源通称，不假设特定产品/API。
- [x] 未知/冲突绑定、Issue 错范围、仅凭据有写权、PR 可提但 IST 写入未授权均有拒绝路径；群消息/默认登录/Issue repo 链接不得升级为授权。
- [x] 群 ID 是可选定位线索；已核验当前群所属 workspace 的受控配置也可提供双绑定，无群 ID 不单独阻塞。普通文件、未核归属的 workspace 和冲突配置不能授予 repo/IST 动作权限。

## Product Requirements Review

**Quality Score**: 93/100

- Business Value & Goals: 29/30
- Functional Requirements: 24/25
- User Or Operator Experience: 19/20
- Technical Constraints: 13/15
- Scope & Priorities: 8/10

**Readiness**: 可实施内容资产；真实 Thread/工作区/API 权限和通知时间窗由采用者环境及后续独立集成确定，不能作为本单已具备能力。用户故事由冻结业务设计及本轮负责人明确的范围裁决覆盖；没有另行编造批准。原 93/100 为最初产物的设计评分，后续命名及发布源切换按 SC-003 和本清单增项核对，不将该评分当作新运行验收。