---
title: "规格质量清单：Session 四态业务状态"
---

**Purpose**: 在进入 `/speckit.clarify` 或 `/speckit.plan` 前验证规格完整性与质量

**Created**: 2026-08-14

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 聚焦 Session 产品状态的用户价值与合同边界
- [x] 未把具体语言、框架、数据库或文件结构写成产品要求
- [x] 面向 product owner、设计、API/CLI/MCP 与执行平台评审者可直接阅读
- [x] 所有必填章节已完成

## Requirement Completeness

- [x] 不存在 `[NEEDS CLARIFICATION]` 标记
- [x] 四个状态及其含义均明确且可测试
- [x] `INIT` 的单向离开约束和其余三态的两两迁移均明确
- [x] `DONE` 被明确规定为可继续状态，而非不可恢复终态
- [x] `INTERRUPTED` 明确合并 waiting-for-input、approval、external action 与 handoff
- [x] 旧九态的删除、合并和替换关系完整
- [x] 内部技术阶段与产品业务状态的边界明确
- [x] Edge cases 覆盖首次失败、后续消息、handoff、取消、关闭与失败原因
- [x] 范围、依赖、假设和 supersession 边界已识别
- [x] Success Criteria 可度量且不依赖特定实现技术

## Feature Readiness

- [x] 所有 Functional Requirements 均可映射到验收场景或 Success Criteria
- [x] User Stories 覆盖操作者读取、客户端迁移和工程诊断三类核心需求
- [x] 明确不新增内部阶段业务字段
- [x] 明确 Task、Harness、Workspace 与 Runtime 状态不受 Session 迁移驱动
- [x] 明确 pre-0.1 直接替换且无 alias、双读或双写
- [x] UI-facing spec 已提供独立 `apps/spec-prototype` route
- [x] Prototype 只验证四态语言和迁移，不冒充生产实现证据

## Notes

- Owner 已明确要求留在 `main`，因此本 feature directory 不依赖独立 feature branch。
- 进入 planning 时必须重点审查旧 `closed/failed` 事实到 `INTERRUPTED/DONE` 的确定性映射，以及内部阶段从产品投影中移除后的诊断来源。
