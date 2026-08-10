# 评审清单：Task Session 发起与执行历史

## Owner 评审

- [x] 确认 Task-bound launch 只有一个可选自由文本框，且它明确属于 Manual Context。
- [x] 确认 050 从不可变 Task context 显式映射其可选 Project ID；UI 不提供会与 Task/Workspace affinity 冲突的第二个 Project selector。
- [x] 确认 Runtime 在 Setup Workspace 时选择，Session form 锁定该 Runtime。
- [x] 确认多个 Task Session 共享同一目录且 UI 不宣称隔离。
- [x] 确认 Session event history 采用 Mystra 紧凑信息层级，不复制聊天产品功能。
- [x] 确认 050 不包含 cancel/retry、repository delivery 或全局日志能力。

## Spec 就绪度

- [x] 用户故事与验收场景完整。
- [x] `context.manual` 的合同边界明确。
- [x] 048/049/044/046/047 依赖与 048 → 049 → 050 顺序明确。
- [x] Requirements Quality Score 达到 90+。
- [x] 旧 prototype 不作为门禁；UX Intent 已刷新，最终以真实浏览器实现、响应式与无障碍证据验收。
- [x] `/speckit.plan` 技术产物完成。
- [x] `plan-eng-review` 完成且无未解决关键问题。

## 后续插件检查

- [x] UI 实现前使用 `frontend-ui-engineering` 与 `mystra-ux`。
- [x] 真实页面验收使用 `browser-testing-with-devtools`；当前环境以应用内浏览器的 DOM、截图、console 与真实 HTTP 证据完成同等验收。
- [x] 修改 API/共享合同前执行 GitNexus impact analysis；SessionService MEDIUM，其余现有方法/页面 LOW。
- [x] 实现完成后使用 `code-review-and-quality` 与 `aaa-spec-close`。
