---
title: "060 实施计划：Coordinator Flow 技能与配置落地"
status: "规划中"
spec: "spec.md"
---

## 概要

本规划定义如何在 host-a1 DSH Coordinator 环境中落地研发全流程第一阶段的控制闭环。包括：
1. 编写版本化技能 `mystra-flow`（`SKILL.md`），明确第一阶段（需求设计、Taco 评审与开发设计移交）的操作步骤、防重入逻辑、飞书消息模板与意图门禁；
2. 规范 Coordinator 的 Agent Profile，固化其协调、调度与汇报职责，杜绝越俎代庖；
3. 规划在 DSH 测试环境中的端到端模拟验证。

## 技术上下文

- **调度运行端**：host-a1 DSH（DeepSeek Harness），基于 Cordis / TypeScript 插件体系。
- **服务调用端**：Mystra Control Plane（通过标准 MCP 协议或 HTTP API 提供 `mystra_create_task`、`mystra_start_task_production` 等能力）。
- **工作执行端**：host-c1 AgentOS Runtime + Pi Provider（负责实际 Git 分支、Draft PR、Spec 编写与 Taco 发布）。

## 架构与宪章检查

- **职责边界隔离**：第一阶段的跨阶段审批、飞书 Thread 互动、Taco 待评审与移交门禁全部由 Coordinator Skill 承载；现有的固定 `mystra.workflow` 仅作为单个 Task 内部的执行指引，两者不冲突、不混淆。
- **凭据最小化**：Coordinator 调度仅持有访问 Mystra 控制面的 MCP / API Token，不持有 Project 仓库密钥，也不持有 Linear 个人令牌。
- **确定性与无伪造**：所有状态流转以实际结果为准，执行失败必须如实上报，不自动伪装完成。

## 实施步骤

1. **结构定义与 Skill 编写**：
   - 在 DSH 技能标准路径准备 `mystra-flow/SKILL.md`；
   - 细化三个阶段定义，并将阶段 1 的六大操作规程（触发隔离、复杂度分流、显式启动、人类评审中继、批注循环、批准收尾）编入技能。
2. **Coordinator Profile 规范化**：
   - 定义标准的 Coordinator 系统提示词骨架；
   - 声明其作为“协调管家”的责任断言，禁止在本地代替沙盒编写具体代码和规范文件。
3. **消息模板与错误处理固化**：
   - 导入 `contracts/coordinator-templates.md` 中约定的结构化输出模板，确保通知清晰、链接明确。

## 风险与应对

| 风险 | 表现 | 应对方案 |
|---|---|---|
| 用户意图识别模糊 | 用户在 Thread 发言“好像还行，再看看”，被误判为“通过” | 严格遵循确定性匹配原则：非明确“通过/批准”一律视为普通讨论或继续修改，绝不触发收尾 |
| 外部网络超时 | 沙盒调用 `taco-cli publish` 超时或失败 | Coordinator 捕获 Session 异常，如实输出失败阶段，提示人工介入重试 |
| 重复触发竞争 | 主群短时间内被多次 `@Bot` 触发同一 Issue | Coordinator 内部维护 `Issue -> Thread` 映射表，对已在执行的任务做拦截并附带已有 Thread 链接 |
