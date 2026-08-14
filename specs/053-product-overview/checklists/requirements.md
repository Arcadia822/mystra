# Specification Quality Checklist: 产品概览

**Purpose**: 验证本轮五态看板与 Session attention 收敛后的规格完整性  
**Updated**: 2026-08-13  
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 只保留两个用户可见区域：五态卡和 attention Task 列表
- [x] 已删除原 User Story 3
- [x] 已删除 Runtime、当前生产和 Projects 列表
- [x] 每张卡只包含 label + number
- [x] 所有 mandatory section 已完成

## Requirement Completeness

- [x] 五态顺序与 canonical code 明确
- [x] 7d/30d/all 默认值和滚动窗口语义明确
- [x] 明确按 Task `createdAt` 入选、按当前 Task status 统计
- [x] 明确时间范围不影响 attention 列表
- [x] 明确 Task/Session 状态独立
- [x] 明确多个 Session 聚合为一个 Task 行
- [x] attention Session states 和 terminal suppression 明确
- [x] Task 行只导航到 Task 详情
- [x] unknown status fail closed，不增加第六卡
- [x] pagination、Team switch、cursor 与 N+1 边界明确

## Contract Readiness

- [x] 新 Overview read endpoint 有 typed request/response
- [x] route 不接受 caller `teamId`
- [x] attention list 有稳定 pagination
- [x] 不读取 SessionEvent，不持久化 snapshot
- [x] SQLite/PostgreSQL parity 与 performance gate 已进入 plan
- [ ] Canonical Task lifecycle 已替换为 `pending/in_progress/blocked/done/canceled`

## Product Requirements Review

Reviewed with the project-local `product-requirements` rubric.

**Quality Score**: 95/100

- Business Value & Goals: 29/30
- Functional Requirements: 25/25
- User Or Operator Experience: 20/20
- Technical Constraints: 14/15
- Scope & Priorities: 7/10

Notes:

- **Spec readiness**: 需求和 Overview read contract ready for owner review。
- **Implementation readiness**: blocked。当前 Task 状态仍额外包含 `waiting_for_review`；054 已冻结直接删除合同，但尚未实施。
- **Owner decisions incorporated**: 删除 US3；单组五卡；7d/30d/all；createdAt cohort + current status；一 Task 一 attention 行；移除三个列表；`blocked` 表达待接手。
- **Remaining upstream work**: 054 implementation 需删除 `waiting_for_review` 并同步 shared/RDB/API/CLI/UI/tests；具体 handoff reason 延后。

## Validation Notes

- 当前源码与 051 文档已核对：Task 没有 failed，但仍有 `waiting_for_review`；Session 独立包含 interrupted/waiting_for_handoff/failed。
- 规格不使用 UI alias 掩盖该冲突。
- 原型只演示 053 surface；054 shell/modal 保持独立 ownership。
