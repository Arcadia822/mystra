---
title: "Tasks：Skill Library"
taco_scope: tasks
---

## Phase 1：Setup

**Purpose**：建立仅服务端可用的 ZIP/S3 依赖与测试入口，不扩大第一阶段产品边界。

- [X] T001 在 `apps/control-plane/package.json` 与 `pnpm-lock.yaml` 添加并锁定 ZIP、YAML 与 S3-compatible SDK 依赖
- [X] T002 [P] 在 `apps/control-plane/src/lib/skills/README.md` 记录 S3-only 内容存储、ZIP 限制、凭据 fail-closed 与不执行内容的边界
- [X] T003 [P] 在 `apps/control-plane/src/lib/skills/skill-test-fixtures.ts` 建立有效 ZIP、恶意 ZIP 与可注入对象存储测试 fixture

---

## Phase 2：Foundational（Blocking Prerequisites）

**Purpose**：完成所有用户故事共享的合同、授权、持久化、安全 ZIP 扫描与对象存储端口。

**CRITICAL**：该阶段未通过 shared、schema parity 和完整 RdbProvider contract 前，不进入用户故事实现。

- [X] T004 [P] 在 `packages/shared/src/skill.test.ts` 先写 Skill、Revision、manifest、分页、preview、错误与 HTTP 输入输出合同的失败测试
- [X] T005 [P] 在 `packages/shared/src/team.test.ts` 先写 Owner/Admin 可管理而 Member 只可读取的 `team.skill.manage` 授权矩阵失败测试
- [X] T006 实现 `packages/shared/src/skill.ts`，并从 `packages/shared/src/management.ts` 与 `packages/shared/src/index.ts` 导出共享 Zod 合同
- [X] T007 实现 `packages/shared/src/team.ts` 与 `apps/control-plane/src/lib/rbac/permissions.ts` 的 `team.skill.manage` 权限映射
- [X] T008 [P] 在 `apps/control-plane/src/lib/db/prisma-schema-parity.test.ts` 与 `apps/control-plane/src/lib/db/rdb-provider.contract.ts` 先写 Skill/Revision 双 schema parity、唯一性、分页与事务状态机失败测试
- [X] T009 在 `apps/control-plane/prisma/sqlite/schema.prisma`、`apps/control-plane/prisma/postgresql/schema.prisma` 及两套 `20260824090000_skill_library/migration.sql` 实现 Skill/SkillRevision 模型、约束和索引
- [X] T010 在 `apps/control-plane/src/lib/db/rdb-provider.ts`、`apps/control-plane/src/lib/db/prisma-mappers.ts` 与 `apps/control-plane/src/lib/db/prisma-provider.ts` 实现增量 Skill persistence 方法及原子 reserve/finalize/archive 操作
- [X] T011 [P] 在 `apps/control-plane/src/lib/skills/skill-storage-config.test.ts` 先写显式 credential pair、默认 provider chain、缺失配置与秘密不泄漏测试
- [X] T012 [P] 在 `apps/control-plane/src/lib/skills/skill-content-store.test.ts` 先写 Put/Get/Head、checksum/length、错误映射、stream cancellation 与不可变 key 合同测试
- [X] T013 实现 `apps/control-plane/src/lib/skills/skill-storage-config.ts`、`skill-content-store.ts` 与 `s3-skill-content-store.ts` 的 S3-only port、启动期凭据解析和生产 adapter
- [X] T014 [P] 在 `apps/control-plane/src/lib/skills/skill-zip-validator.test.ts` 先写两阶段扫描、根解析、路径/Unicode/大小写碰撞、链接/加密/方法、CRC/大小、zip bomb、噪声与 canonical digest 对抗测试
- [X] T015 实现 `apps/control-plane/src/lib/skills/skill-zip-validator.ts` 的 bounded descriptor 扫描、单 entry stream 内容验证、manifest、frontmatter projection 与稳定错误码
- [X] T016 [P] 在 `apps/control-plane/src/lib/skills/skill-errors.test.ts` 先写领域错误到不泄漏 Team 资源存在性的 HTTP/CLI/MCP 稳定映射测试
- [X] T017 实现 `apps/control-plane/src/lib/skills/skill-errors.ts` 与 Skill service factory 的授权、错误和依赖组合基础

**Checkpoint**：共享合同、授权、数据库、ZIP 与 S3 基础可独立验证，且未引入 filesystem adapter 或 SkillCommand。

---

## Phase 3：User Story 1 — 上传 ZIP 创建可用 Skill（P1）

**Goal**：Owner/Admin 上传 ZIP，获得 ready Revision 1、文件树、摘要与原始 ZIP 下载入口。

**Independent Test**：根级或单公共目录 ZIP 发布后产生一个 Team-scoped Skill 与 Revision 1；原始下载 bytes 相同，失败上传不成为 current。

### Tests

- [X] T018 [P] [US1] 在 `apps/control-plane/src/lib/skills/skill-publication-service.test.ts` 先写首次 reserve、resourceRevision 0→1、同名同 hash 重试、Put/finalize failure injection 与对象保留测试
- [X] T019 [P] [US1] 在 `apps/control-plane/app/api/skills/skills-routes.test.ts` 先写 list/create 的原始 `application/zip` body、RBAC、Team 隔离、状态码与 ETag 合同测试
- [X] T020 [P] [US1] 在 `apps/control-plane/src/lib/operator-cli.test.ts` 先写 `mystra skills upload <bundle.zip>` 的参数、二进制传输与输出合同测试

### Implementation

- [X] T021 [US1] 实现 `apps/control-plane/src/lib/skills/skill-publication-service.ts` 的首次发布、恢复、ready finalize 与 terminal/retryable 状态机
- [X] T022 [US1] 实现 `apps/control-plane/app/api/skills/route.ts` 的授权分页列表与原始 ZIP body 创建端点
- [X] T023 [US1] 在 `scripts/operator-cli.mjs` 实现薄 `skills list` 与 `skills upload` 命令
- [X] T024 [US1] 在 `apps/control-plane/app/skills/_components/skill-library-model.test.ts` 先写列表、上传和错误 presentation model 测试
- [X] T025 [US1] 实现 `apps/control-plane/app/skills/page.tsx` 与 `apps/control-plane/app/skills/_components/skill-library.tsx` 的生产列表和上传流程

**Checkpoint**：US1 可由 API、CLI 与 Web 独立完成创建，且 Member 写入被拒绝。

---

## Phase 4：User Story 2 — 浏览、预览并下载 Revision（P1）

**Goal**：Team 成员可浏览 active/明确 archived Skill、历史 Revision、文件树、安全文本预览与授权下载。

**Independent Test**：普通 Member 切换 Revision、预览 allowlist UTF-8 文件、查看二进制原因并下载原始 ZIP；跨 Team ID 表现为不可访问。

### Tests

- [X] T026 [P] [US2] 在 `apps/control-plane/src/lib/skills/skill-query-service.test.ts` 先写列表/详情/history cursor、archived 可见性与跨 Team 隔离测试
- [X] T027 [P] [US2] 在 `apps/control-plane/src/lib/skills/skill-preview-service.test.ts` 先写 logical path 定位、256 KiB 上限、UTF-8 allowlist、HTML/SVG/binary 拒绝与下载流测试
- [X] T028 [P] [US2] 在 `apps/control-plane/app/api/skills/skills-routes.test.ts` 增加 detail/history/file/download、Content-Disposition、缓存与不暴露 object key 合同测试
- [X] T029 [P] [US2] 在 `apps/control-plane/app/api/mcp/route.test.ts` 先写 JSON-safe skill list/get/history/preview 工具与二进制边界测试

### Implementation

- [X] T030 [US2] 实现 `apps/control-plane/src/lib/skills/skill-query-service.ts` 与 `skill-preview-service.ts` 的授权查询、精确 Revision 文件读取和下载流
- [X] T031 [US2] 实现 `apps/control-plane/app/api/skills/[skillId]/route.ts`、`revisions/route.ts` 与 `revisions/[revisionId]/route.ts`
- [X] T032 [US2] 实现 `apps/control-plane/app/api/skills/[skillId]/revisions/[revisionId]/file/route.ts` 与 `download/route.ts` 的授权预览和流式下载
- [X] T033 [US2] 在 `apps/control-plane/app/api/mcp/route.ts` 实现 JSON-safe skill list/get/history/preview 工具，明确排除 ZIP base64 upload/download
- [X] T034 [US2] 在 `scripts/operator-cli.mjs` 实现 `skills show --revision`、`skills preview` 与 `skills download`
- [X] T035 [US2] 在 `apps/control-plane/app/skills/_components/skill-library-model.test.ts` 先写 Revision 切换、文件树、preview reason 与下载 model 测试
- [X] T036 [US2] 实现 `apps/control-plane/app/skills/[skillId]/page.tsx` 与 `apps/control-plane/app/skills/_components/skill-library.tsx` 的详情、文件树、预览和下载体验

**Checkpoint**：US2 可被 Member 独立使用，所有 read path 保持 Team 隔离且对象存储定位信息不出服务端。

---

## Phase 5：User Story 3 — 以新 Revision 更新 Skill（P1）

**Goal**：Owner/Admin 以 If-Match 发布不可变新 Revision，旧 Revision 内容保持不变。

**Independent Test**：正确 expected resource revision 发布 Revision 2 并切换 current；过期条件返回稳定冲突，同 tuple 重试复用原 Revision。

### Tests

- [X] T037 [P] [US3] 在 `apps/control-plane/src/lib/skills/skill-publication-service.test.ts` 增加 baseRevisionId + zipSha256 重试、name 不变、stale If-Match、archive/finalize race 与历史不变测试
- [X] T038 [P] [US3] 在 `apps/control-plane/app/api/skills/skills-routes.test.ts` 增加 revision publish 的 If-Match、原始 ZIP body、409 与恢复合同测试
- [X] T039 [P] [US3] 在 `apps/control-plane/src/lib/operator-cli.test.ts` 增加 `skills publish <skill-id> <bundle.zip> --expected-revision <n>` 薄适配器测试

### Implementation

- [X] T040 [US3] 扩展 `apps/control-plane/src/lib/skills/skill-publication-service.ts` 实现不可变更新、tuple 恢复、Head 校验、并发守卫与 current pointer 原子切换
- [X] T041 [US3] 实现 `apps/control-plane/app/api/skills/[skillId]/revisions/route.ts` 的原始 ZIP body Revision 发布端点
- [X] T042 [US3] 在 `scripts/operator-cli.mjs` 与 `apps/control-plane/app/skills/_components/skill-library.tsx` 实现 CLI/Web 新 Revision 发布及冲突反馈

**Checkpoint**：US3 不覆盖历史对象，重试恢复与 stale-write 拒绝均有故障注入证据。

---

## Phase 6：User Story 4 — Archive Skill 而不销毁历史（P2）

**Goal**：管理者 archive Skill、释放 active name，同时保留所有历史与对象。

**Independent Test**：archive 后默认列表排除，includeArchived 和按 ID 读取仍可预览/下载；重复 archive 幂等，同名新上传创建新 Skill ID。

### Tests

- [X] T043 [P] [US4] 在 `apps/control-plane/src/lib/skills/skill-publication-service.test.ts` 增加 archive 幂等、If-Match、activeName 释放、同名新 ID 与零对象删除测试
- [X] T044 [P] [US4] 在 `apps/control-plane/app/api/skills/skills-routes.test.ts` 与 `apps/control-plane/app/api/mcp/route.test.ts` 增加 archive 授权、幂等、includeArchived 和不存在性保护测试

### Implementation

- [X] T045 [US4] 实现 `apps/control-plane/app/api/skills/[skillId]/archive/route.ts`，并在 publication service 中完成原子 archive 状态转换
- [X] T046 [US4] 在 `scripts/operator-cli.mjs`、`apps/control-plane/app/api/mcp/route.ts` 与 `apps/control-plane/app/skills/_components/skill-library.tsx` 实现 archive 薄入口和确认体验

**Checkpoint**：US4 释放 active name，但不删除 Revision、manifest 或对象，也不提供 restore/hard-delete。

---

## Phase 7：Polish & Cross-Cutting Gates

**Purpose**：完成共享原型、容量/性能、安全、全量回归与 Spec-Kit 收口。

- [X] T047 [P] 验证并补齐 `apps/spec-prototype/app/056-skill-library/page.tsx` 与 `apps/spec-prototype/app/_components/skill-library-prototype*` 的共享 `@mystra/ui` 交互原型测试和 320/768/1024/1440px 证据
- [X] T048 [P] 在 `apps/control-plane/src/lib/skills/skill-performance.test.ts` 建立四个独立 fixture、至少 100 次 warmed samples、p50/p95 和内存模型报告
- [X] T049 运行 AWS S3 语义 mock 与一个非 AWS S3-compatible 实现的 Put/Get/Head/checksum/error/stream 合同，并把可复现命令和环境记录到 `specs/056-skill-library/quickstart.md`
- [X] T050 运行 `pnpm --filter @mystra/shared test`、Control Plane Skill/full provider/schema parity 测试、prototype test/typecheck/build、全仓 `pnpm typecheck && pnpm test && pnpm lint`
- [X] T051 使用真实浏览器验收 `/skills` 与 `/skills/{skillId}` 的列表、上传、Revision、预览、下载和 archive 响应式流程，并记录结果到 `specs/056-skill-library/quickstart.md`
- [X] T052 运行 GitNexus compare `detect_changes`、`pnpm gitnexus:doctor`、Spec-Kit status 与 Taco 更新，修复未覆盖影响后将本文件任务全部标记完成

---

## Dependencies & Execution Order

- Phase 1 无前置依赖。
- Phase 2 依赖 Phase 1，并阻塞全部用户故事；T004/T005 可并行，T008/T011/T012/T014/T016 可先写失败测试，T010 依赖 T008/T009，T013 依赖 T011/T012，T015 依赖 T014，T017 依赖 T006/T007/T010/T013/T015。
- US1 依赖 Phase 2，是首个可交付 slice。
- US2 依赖 Phase 2 与 US1 产生的 ready Revision，但查询/预览测试可与 US1 API 适配并行编写。
- US3 依赖 US1 publication 基础与 US2 history/read contract。
- US4 依赖 US1 publication 基础；其测试可与 US3 并行，但最终需覆盖 archive/finalize race。
- Phase 7 依赖 US1–US4 全部完成；T047/T048 可并行，T049 需要可用 S3-compatible 测试环境，T050–T052 顺序执行。

## Parallel Examples

- Foundation：T004 与 T005；T011/T012 与 T014/T016。
- US1：T018、T019、T020；服务、API 与 UI 测试先各自变红，再按 T021→T025 收敛。
- US2：T026、T027、T028、T029；T035 可在 API 合同稳定后并行。
- US3/US4：T037–T039 与 T043–T044 可在不同测试文件/区块先行，production service 修改保持串行。

## Implementation Strategy

1. 先让 Foundational contract tests 失败，再完成最小实现并运行全量 RdbProvider contract。
2. 按 US1→US2→US3→US4 逐故事交付，每个 checkpoint 都包含共享合同、领域服务和外层 adapter 证据。
3. Web API 是 canonical implementation；CLI/MCP/Web 只做授权上下文、传输与 presentation 适配。
4. 不增加 Agent/Session/Runtime 绑定、filesystem adapter、hard delete、GC、restore、SkillCommand、operation ID 或持久化 Idempotency-Key。
