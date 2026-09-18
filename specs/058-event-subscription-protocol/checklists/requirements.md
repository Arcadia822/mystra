# Specification Quality Checklist: 统一 Webhook 入口与 Integration 事件订阅协议

**Purpose**: 在进入规划前验证规格完整性与质量
**Created**: 2026-09-16
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 聚焦于用户价值与业务需要（五步 setup、多 integration 契约），实现细节限制在源码核验与待实现区分节
- [x] 面向非技术干系人的叙事可读（Story 1 用纯旅程描述）
- [x] 所有必填章节完成

## Requirement Completeness

- [x] 无 [NEEDS CLARIFICATION] 残留（token/验签、架构归属两个高风险决策均已由 Owner 拍板）
- [x] 需求可测试且无歧义（FR-001..023 均有可观测判据）
- [x] 成功标准可度量（SC-001..010 含具体数值/计数；SC-001 计时口径限定为 Mystra 收到 webhook 起）
- [x] 所有验收场景已定义（5 个 user story × Given/When/Then + 负向）
- [x] 边界情况已识别（token 泄露、伪造风险、慢消费者、server 重启、归属失败、In Review 判定）
- [x] 范围清晰（Out of scope 明确排除 write-back/持久化/中间件/Agent 适配）
- [x] 依赖与假设已记录

## Feature Readiness

- [x] 所有 FR 有对应验收覆盖（FR-019→SC-010、FR-023→SC-009 已补齐）
- [x] 用户场景覆盖主流程（setup → ingress → 多 integration → 订阅 → 端到端）
- [x] 满足 Success Criteria 定义的度量
- [x] 实现细节未泄漏进验收标准

## Notes

- 源码与官方协议核验已记录在 `research.md`：GitNexus 对 IntegrationRegistry / RdbProvider 的 upstream impact 均为 CRITICAL；实施前仍需按具体 symbol 做 references/impact。
- plan 已选择现有 human AuthSession Bearer、双端 ws、单进程 custom Next server；这是待工程评审的技术设计，不是生产能力声明。
- FR-023 已落实 PRODUCT 与 Constitution 2.17.0 dated amendment；PLATFORM/AGENTS 同步记录窄例外。任务分解仍受工程评审和共享 UI 原型门禁约束。

## Product Requirements Review

Reviewed with the project-local `product-requirements` rubric, adapted to Spec-Kit output rules.

**历史规格评分（规划前）**: 93/100（原文 95 为加总错误；以下分项合计 93）。不是本轮工程评审评分。

- Business Value & Goals: 28/30（问题清晰、SC 可度量；"现在做"的理由隐含在 MYST-4 依赖链中，未单列）
- Functional Requirements: 24/25（23 条 FR 完整可测；SC-002 已区分 ingress/订阅核心零修改与 registry 构造一次性扩展；线性最小事件集边界留给 plan）
- User Or Operator Experience: 17/20（五步 setup 是强验收面；CLI 诊断输出的具体形态留给 plan）
- Technical Constraints: 14/15（安全边界、内存态订阅、单实例假设明确；WS/凭据选型待定）
- Scope & Priorities: 10/10（P1–P3 分层与 out-of-scope 清晰）

Notes:

- 历史结论：Ready for planning（≥90）；SpecReview058 当时确认无 Blocker。本轮源码研究进一步发现并修正事实性缺口，不能把历史结论当作技术计划批准。
- 已按评审修订：SC-002 区分核心零修改与 registry 一次性扩展（Major）；`AgentExecutionClient` 符号名订正；FR-023 点名修订目标与 amendment 机制并补 SC-009；FR-019 补 SC-010；SC-001 计时口径限定为 Mystra 收到 webhook 起。
- 关键假设：Owner 接受固定 endpoint URL 持有者可伪造事件的风险；TLS、connection 校验和不可信 payload 边界仍保留。
- 本轮勘误：045 未有反向唯一约束；Delivery ID 不是 webhookId。2026-09-17 Owner 最终简化：稳定 endpoint UUID 直接作为 query 参数，可重复读取；移除 verifier/hash、一次性原值、regenerate、轮换/吊销、revision CAS 与日志脱敏。

## Plan Readiness Gate

- [x] plan、research、data-model、三份 contracts、quickstart 与 prototype 门禁记录齐全。
- [x] 认证、传输、composition root、归属唯一性、去重与资源上限已有明确设计。
- [x] FR-023 产品边界窄修订已落地；未开放 callback/retry/offline replay/write-back。
- [x] plan-eng-review 由独立 session 完成全量及两次定向复核；原 9 项全部处置，Owner 明确立即应答、多 Team membership 授权和全局上限取舍。工程门禁通过，详见 [eng-review.md](../eng-review.md)，原型仍待完成。
- [x] `/event-subscription-protocol` 共享代码原型已实现并通过浏览器逐状态验收，见 [prototype.md](prototype.md)。
- [x] 生产统一服务入口、`mystra-agent events` CLI、共享 UI 设置弹窗与端到端自动化验收均已落地；本地端到端测试覆盖 26/26 验收项（见 `evidence/e2e-local-run.md`）。真实 Linear 公网入站依赖外部网络条件。
- [x] 已按 Owner 修订 FR-004/006/013、SC-003、inbox 模型及验收：接收后立即 200，后续全异步；异步失败不伪造 HTTP 错误，明确已确认事件可能丢失。
