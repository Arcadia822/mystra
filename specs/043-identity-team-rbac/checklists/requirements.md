# Specification Quality Checklist: 本地用户、Team 与 RBAC

**Purpose**: 验证 043 在进入 clarification/planning 前的完整性与质量
**Created**: 2026-08-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 需求聚焦用户结果，没有把具体 endpoint 或表结构伪装成产品故事
- [x] 默认账户、初始 Team、Team lifecycle 与 RBAC 的边界明确
- [x] 安装器实现与 043 post-install contract 明确分离
- [x] 所有 mandatory sections 已完成

## Requirement Completeness

- [x] 不存在未解决的 clarification marker
- [x] 三个 User Story 均有独立测试和 observable acceptance scenarios
- [x] Success criteria 可度量
- [x] Edge cases 覆盖默认密码、原子注册、初始 Team、last active Team、last Owner、成员和 Team context
- [x] First slice、extension boundary、out-of-scope 和外部 SaaS 仓库已分开
- [x] 040 合入与 5xP amendment 依赖已识别
- [x] pre-0.1 直接替换策略与项目规则一致

## Feature Readiness

- [x] 首期 Principal 仅为 Human User
- [x] self-host 只开放 username/password，不引入 email
- [x] 每个 User 注册即获得一个初始 Team，且始终至少属于一个 active Team
- [x] Team switch/create/rename/delete 及保护条件明确
- [x] Members 页面字段、动作和 Owner/Admin/Member 权限明确
- [x] SQLite/PostgreSQL/Supabase parity 与 Prisma ownership 明确
- [x] Agent/workload/factor 仅保留扩展合同，不进入实现
- [x] 规格可进入 Owner review
- [ ] Castrel AI Workspace Members 视觉参考材料已提供并完成映射
- [x] 040 Prisma RDB 已合入 `main`
- [x] 5xP/constitution 已移除与 043 冲突的 caller-auth/Team-admin 排除项
- [x] 规格可以进入 implementation

## Product Requirements Review

Reviewed with the project-local `product-requirements` rubric，adapted to Spec-Kit output rules。

**Quality Score**：97/100

- Business Value & Goals：30/30
- Functional Requirements：25/25
- User Or Operator Experience：18/20
- Technical Constraints：15/15
- Scope & Priorities：9/10

Notes：

- 行为规格达到正常 90+ readiness threshold；043 implementation 已完成，SQLite control-plane 验证通过。
- Castrel AI 页面尚未提供，因而只锁定 Members 信息结构和行为；视觉一致性扣 2 分并保留为 review item。
- `admin/admin` 是外部 installer 的 bootstrap contract，不授权 043 实现安装流程；首次登录强制改密是安全验收的一部分。
- Agent auth、workload identity 和强认证因子已移出 043 交付；扩展边界不构成预建实现授权。

## Validation Iteration

- **Iteration 4**：按 Owner 新需求加入默认登录、Account Settings、每 User 初始 Team、Team lifecycle 与 Members/Roles；现为 52 条 functional requirements、13 条 success criteria。
- **Iteration 5**：按 Owner 决策取消 Personal Team 特殊类别，改为注册即创建一个同构的初始 Team，并以“每 User 至少一个 active Team”替代 personal-owner 永久保护。
- **Known gate**：当前 `main` 与 feature number 不一致是 Owner 明确要求；后续命令必须设置 `SPECIFY_FEATURE=043-identity-team-rbac`。
- **Review surface**：`index.html` 与独立 prototype 是静态评审产物，不误报为运行时验收。
