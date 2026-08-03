# 快速开始：MVP 操作 Web UI 框架

## 前置条件

```sh
fnm install 24.14.0
fnm use 24.14.0
corepack use pnpm@10.25.0
pnpm install
```

## 运行 Control Plane

```sh
pnpm dev:control-plane
```

打开：

```text
http://127.0.0.1:3000
```

## 验证 Shell Taxonomy

1. 确认 primary navigation 严格包含：`Overview`、`Inbox`、`New Task`、`Projects`。
2. 确认 `Settings` 通过 shell action 打开 modal，`Recent Sessions` 作为 secondary route 可直接访问。
3. 确认每个 route 都可以被选择。
4. 确认没有对应实现切片的 route 会渲染 placeholder 或 read-only framing，而不是伪造已完成的页面行为。

## 验证 Framework Concerns

1. 在可用主题之间切换，确认 navigation 和 page framing 保持一致。
2. 使用窄 viewport，确认 primary navigation 仍可访问，且不以水平滚动作为主要策略。
3. 确认 framework-owned labels 和 placeholder copy 已为后续 locale support 隔离。
4. 确认 UI 仍把 API、MCP/skill 和 CLI surfaces 视为管理事实来源，而不是让 shell 成为唯一 owner。

## 验证命令

```sh
pnpm --filter @mystra/control-plane typecheck
pnpm --filter @mystra/control-plane test
```

实现后应进行浏览器验证，检查 desktop 与 narrow viewport 行为。
