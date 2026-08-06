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

1. 确认 primary navigation 严格包含并按顺序显示：`New`、`Search`、`Inbox`、`Issues`；不得显示 `Automations`。
2. 确认 `Inbox` 右侧显示数字 badge。
3. 确认第二个 section 为 `Tasks`，Task 按 Project 分组，Task icon 映射最新 Session 状态。
4. 确认 `Settings` 通过侧边栏底部 action 打开 modal。
5. 直接打开 `/automations`，确认页面只显示 `Coming soon`，且不会出现 workflow action、数据或配置入口。
5. 打开 `Inbox`，确认左侧 review Task 卡片控制右侧只读详情；在窄 viewport 下确认列表先于详情堆叠，且页面没有横向溢出。

## 验证 Framework Concerns

1. 在可用主题之间切换，确认 navigation 和 page framing 保持一致。
2. 首次打开或清除本地 theme preference 后，确认默认暗色 preset 使用 dark-tech palette，并核对 canvas `#111513`、executor green `#74B98B`、0/2/4/6px radius、统一等宽字体和无阴影/渐变/glow/glass/noise 输出。
3. 在 English 与简体中文之间切换，确认 shell-owned labels 立即更新并持久化。
4. 确认浏览器计算后的 body 默认字号为 12px。
5. 使用窄 viewport，确认 primary navigation 仍可访问，且不以水平滚动作为主要策略。
6. 确认 UI 仍把 API、MCP/skill 和 CLI surfaces 视为管理事实来源，而不是让 shell 成为唯一 owner。

## 验证命令

```sh
pnpm --filter @mystra/control-plane typecheck
pnpm --filter @mystra/control-plane test
```

实现后应进行浏览器验证，检查 desktop 与 narrow viewport 行为。
