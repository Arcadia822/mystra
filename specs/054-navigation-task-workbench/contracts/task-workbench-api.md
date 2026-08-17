---
title: "Contract: Task Workbench API"
taco_scope: plan
---

## GET `/api/tasks`

Authenticated active Team 决定 scope。Query：`cursor?`、`limit?`、`query?`、repeatable `status?`、`sort?`、`direction?`。`query` 对 Task title 与可搜索的 Metadata 文本执行查询时大小写不敏感匹配；不得依赖持久化 normalized columns。

Response：

```ts
type TaskWorkbenchPage = {
  items: Array<Task & {
    projectReference: null | { provider: "github"; repositoryExternalId: string };
  }>;
  nextCursor: string | null;
};
```

`Task.metadata` 是 Task 顶层 JSON object，并在每个 list item 的 Task 对象内部返回；API 不返回平行 `labels`。`Task.issue.identifier` 是 Issue visible identifier。API 不返回 repository/Issue snapshot，不进行 per-item provider I/O。非法/条件不匹配 cursor 返回稳定 400；cross-Team data 返回 404/空集合，不泄漏存在性。

每个 Task 使用顶层 `status` 字段；`productionStatus` 不再出现在 response、query sort key 或任何兼容 alias 中。与 Task 同时返回的 Session 继续使用其独立 `state`，对象边界已经提供足够区分。

## POST `/api/tasks`

Manual create input 可携带 `metadata?: Record<string, JsonValue>`，省略时解析为 `{}`；New Task modal 在 054 中继续提交默认 `{}`，不新增 Metadata editor。Issue-to-Task 创建同样初始化 `{}`。成功 response 的 `task.metadata` 必须存在。

## PATCH `/api/tasks/:id`

现有 title/description 更新扩展 `metadata?: Record<string, JsonValue>`。提供时完整替换 Task 内部的 metadata object；省略时保持不变。输入与输出都通过 shared Task schema 验证。不得创建 `TaskLabel`、`ordinal`、`normalizedKey`、`normalizedValue` 或其他派生存储；前端独立决定展示顺序。

## Status API

现有 status route 只接受五态。request 与 response 都使用 `status`；Task response 同样只包含 `status`。`blocked` 要求 note；任何 `productionStatus` field 或 `waiting_for_review` value 均为 schema error，不做 alias。expected revision/idempotency 语义保持。

## Root Overview Placeholder

根入口在 053 未完成时返回/渲染静态 Overview placeholder；不得调用 053 endpoint 或发明 metrics。053 落地后路由目的地不变，只替换 page implementation。
