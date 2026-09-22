---
title: "061 实施与验收任务"
---

## 前提与研究

- [x] T001 核对 PR #47 合并与用户范围裁定，记录 `spec.md`。
- [x] T002 在 c1 用官方 toolchain 证明目录和 `.aospkg` 的 PATH 命令可运行，记录 `plan.md`。
- [x] T003 GitNexus/LSP 确认适配器影响范围，完成 `plan.md` 工程审查。

## 场景一：固定工具预装

- [x] T004 在 `apps/runner-daemon/package.json` 固定 CLI/toolchain 依赖，扩展 build:agentos-cli 产物；实现 `scripts/build-agentos-taco.mjs`。
- [x] T005 在 `src/session/agentos-runner.mjs` 接入可选软件包与本地 skill，未配置保持现有行为；复用既有 Session 启动链。

## 场景二：受限发布

- [x] T006 在 `src/session/agentos-runner.test.ts` 验证严格 HTTPS origin、默认关闭及精确出口规则，再实现适配器配置。
- [x] T007 构建产物并执行 Runner 定向测试与 typecheck（13 文件 / 63 测试通过）。
- [x] T008 完成 c1 部署、普通 Session CLI/skill/发布、独立 VM 重建及拒绝非允许出口验证；同 Session 续接子项于 2026-09-22 经负责人豁免合并门禁后收口，详见 `quickstart.md`。
  - 已完成部署、两次真实 VM 的 PATH/资源/dry-run、真实发布、非允许出口失败及零出口离线验证。
  - 普通授权 Task `3d0a7b44-d637-443a-bd2a-a9ac8f06ac8b` 已完成 Workspace 准备与 Pi Session 首轮公开合成发布，Session `6ba89b0d-1766-422b-84a4-ed1e475b68d9` 为 ready。
  - **负责人豁免**：PR #56 审查后明确要求“收口吧 不等”。同 Session 续接仍未验证，后续随 MYST-28 的正式 HTTP/MCP/CLI send-message 入口验证；不直接写事件表，不记为通过，不再阻塞本特性。

## 依赖

T001–T003 → T006 → T004/T005 → T007 → T008。构建和适配器共用产物合同，顺序实施；不为并行而拆分同模块。最终保持上游版本及公开发布约束，不把独立实验等同于正式 Session 验收。
