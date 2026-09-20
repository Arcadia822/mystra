---
title: "059 启动指令合同"
taco_scope: "plan"
---

## 请求

`POST /api/tasks/{id}/production/start` 和 `POST /api/tasks/{id}/sessions` 的现有对象增加可选 `initialInstruction` 字符串。MCP对应公开inputSchema同步增加同名属性；CLI使用 `--initial-instruction TEXT`。

- 省略：共享schema解析为平台拥有的中立默认。
- 空白或超长：既有validation错误，不接受空消息。
- 非空：trim后作为有效指令；不当作OS命令，不提升为system prompt，不替代manualContext。
- 生产start将有效指令纳入requestFingerprint并冻结进TaskExecutionContext。
- 同幂等键不同有效指令：冲突，不忽略差异。
- Session启动同sessionId不同有效指令：冲突。
- 后续新Session省略参数时仍使用同一默认；不暗中继承旧Session首条消息。

## 输出和证据

不新增业务响应包装。TaskStartResult的executionContext包含冻结有效指令；SessionEvent的user_message_submitted承载实际首条消息。标准提示词证据独立，hash随程序拥有的中立文本计算。

## 权限

沿用现有登录、Team授权、Runtime资格、Task状态与revision校验。本字段不扩大执行code权限，不允许选择任意宿主路径、回调地址、Runtime迁移或外部凭据。
