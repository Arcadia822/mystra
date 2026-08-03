# 工程评审清单：MVP 操作 Web UI 框架

**目的**：在任务执行前验证 025 plan
**创建时间**：2026-05-20
**Feature**：[spec.md](../spec.md)

## 架构

- [x] Shell 范围已与页面级产品行为分离。
- [x] 已批准 route taxonomy 明确且有限。
- [x] Layout archetypes 已作为 framework contracts 记录。
- [x] Theme 与 locale 是 framework concerns，不是 business state。
- [x] 未来 Electron compatibility 被表示为 seam，而不是当前必须实现的能力。

## Codebase Evidence

- [x] 当前 shell 实现表面已定位到 `apps/control-plane/app/_components/app-shell.tsx`，overview 内容位于 `apps/control-plane/app/page.tsx`。
- [x] 现有 theme contract 已定位到 `apps/control-plane/app/theme-system.ts`。
- [x] 现有视觉方向和 shell mockups 已定位到 `specs/025-webui/mockups/render-mockups.cjs`。
- [x] 不需要 API、persistence、MCP、runner 或 provider contract change。

## 风险

- [x] 风险：页面级行为可能泄漏到 025。缓解：tasks 将未归属 route 限制为 placeholder 或 inspection content。
- [x] 风险：当前 workbench labels 与已批准 taxonomy 不一致。缓解：foundational tasks 先创建 route model，再进入 story work。
- [x] 风险：locale scaffolding 可能过度设计。缓解：范围仅限 framework-owned copy。

## 决策

可以进入 task decomposition。
