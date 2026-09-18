---
title: "058 共享 UI 原型与体验验收门禁"
taco_scope: plan
status: "原型已实现并通过浏览器验收"
---

## 路由与当前状态

目标应用：`apps/spec-prototype`。目标 route：`/event-subscription-protocol`，目标文件 `apps/spec-prototype/app/event-subscription-protocol/page.tsx` 与 `settings-modal.tsx`。Taco 只承载文档评审，不作为这个 route 的实现。

从现有 `/starter` 和 `PrototypeShell` 开始，保留共享 shell/theme/导航规范，不建 standalone HTML、不复制 production DOM/CSS。

## 共享代码边界

| 表面 | 实施归属 | 约束 |
|---|---|---|
| 设置行/组 | `packages/ui/src/setting-row.tsx` | 已迁移的唯一 primitive；production 与 prototype 共同 import |
| Settings modal 骨架 | `packages/ui/src/settings-modal.tsx`（`SettingsModalFrame` + `SettingsModalGlyph`） | 唯一实现。production `ShellSettings` 与 prototype `settings-modal.tsx` 都只组合该 frame；副本 DOM/SVG 已删除 |
| Webhook URL 区块 | production `linear-integration-detail.tsx` 内接线 | ready connection 的固定 URL + 复制；无创建、regenerate、轮换/吊销管理操作 |
| theme、icons、button、popover、shell | 现有 `@mystra/ui` | 必须复用，不重绘标准 icon 或仿制 modal/dropdown |
| prototype 接线 | 新 route 的 composition/mock state | 仅持有审核用假数据；mock URL 明确标记为演示用、不可访问 |

迁移 primitive 时必须核验 Control Plane 与 Spec Prototype 两个应用；用 LSP references/GitNexus impact 确认所有调用者，不能凭可见页面猜范围。

## 用户旅程与状态（2026-09-17 Owner 简化后）

核心旅程只包含：设置 → 集成 → Linear 详情中查看固定 webhook URL 并复制，以及去 Project 选择 source/Team 的引导。不暴露 WS、过滤 DSL、subscription token、Agent 插件、签名 secret、Replay、Session 操作，也不提供 endpoint 生命周期管理操作。

- connection 未 ready：说明先验证 API key，不展示可用 URL。
- connection ready：每次打开均展示同一个固定 URL + 复制按钮 + “粘贴到 Linear Webhook 设置”指引。
- 只读成员：遵循管理权限，不显示不可访问的 URL。

endpoint ID 是公开路由标识；原型不写 localStorage/sessionStorage，固定 URL 由服务端管理 API 重复读取。

## 浏览器验收

当前结果：**已执行并通过**（2026-09-17，简化模型重验）。

## 已落地实现

- `packages/ui/src/setting-row.tsx`：从 `apps/control-plane/app/_components/setting-row.tsx` 迁移的唯一 primitive；10 个 app-local 文件全部改为 `@mystra/ui` 导入，原文件已删除，无兼容 re-export。
- `packages/ui/src/settings-modal.tsx`：共享 `SettingsModalFrame`（dialog surface、导航 rail、搜索、内容 header）与 `SettingsModalGlyph`。production `ShellSettings` 与 prototype route 同时消费该实现；两边的 modal DOM 与 SVG glyph 副本均已删除。
- `apps/spec-prototype/app/event-subscription-protocol/settings-modal.tsx`：只持有节/文案/mock 状态，其余全部来自共享 frame。
- `apps/spec-prototype/app/event-subscription-protocol/page.tsx`：从 `PrototypeShell` 起步的组合；集成列表与 Linear 详情（connection 行 + Webhook URL 区块，mock URL 标记为演示用）。
- `apps/control-plane/app/_components/linear-integration-detail.tsx`：ready connection 时读取固定 endpoint 并显示 URL + 复制；未 ready 时显示前置说明。
- 原 `packages/ui/src/webhook-endpoint-panel.tsx` 已删除：简化后的 URL 区块为几行静态结构，无需独立共享组件。

## 浏览器验收记录（真实 Chromium）

| 场景 | 结果 |
|---|---|
| prototype `/event-subscription-protocol`：打开即设置弹窗，默认集成列表（GitHub/Linear 行） | 通过 |
| prototype Linear “打开” → 详情：connection 行 + Webhook URL + 复制 | 通过 |
| prototype 复制按钮 → “已复制” 回显 | 通过 |
| prototype 返回 ‹ → 回集成列表；导航切节、返回集成 | 通过 |
| prototype 搜索“成员”过滤导航项 | 通过 |
| prototype localStorage/sessionStorage 计数为 0 | 通过 |
| prototype 页面 console 错误：0 | 通过 |
| production unified server（`dev` 入口，真实 SQLite schema）：设置弹窗经共享 frame 渲染、五节导航与 glyph 正常 | 通过 |
| production Linear 详情：ready connection 显示固定 URL（含 `?token=<endpoint uuid>`）+ 复制 → “Copied” | 通过 |
| production 返回再进入、整页刷新后 URL 与 endpoint id 不变 | 通过 |
| production `POST /api/webhooks?token=<endpoint uuid>` 立即返回 `200 {"received":true}` | 通过 |
| production 无效/缺失 token 返回 401；非 POST 405 | 通过 |

## 剩余限制

- `MYSTRA_PUBLIC_URL` 在本地验证时使用 loopback HTTP；production 部署必须配置 HTTPS origin（quickstart 阶段验收）。
- 真实 Linear 验收（专用测试资源、真实 webhook、In Review 状态 ID）尚未执行；fixture 结果不得替代。

