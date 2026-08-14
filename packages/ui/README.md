# @mystra/ui

Mystra 的共享 UI 实现与主题样式。生产 Control Plane 与独立 Spec Prototype
必须同时依赖此 package，禁止在 prototype 中复制组件 DOM、SVG icon 或主题
token。

- `src/styles.css`：生产与 prototype 共用的主题 token、组件样式和 shell layout。
- `src/index.ts`：跨应用复用的 React primitives、icon、Label 与 stacked list。
- `UiBreadcrumb`：共享的 arrow-separated breadcrumb；shell/header layout 通过
  可选 items contract 内建使用，feature 页面只声明层级，不复制 nav、separator
  icon 或样式。
- 业务数据获取、路由和权限仍由各 app 自己负责。

修改共享组件后，至少运行：

```sh
pnpm --filter @mystra/ui typecheck
pnpm --filter @mystra/control-plane typecheck
pnpm --filter @mystra/spec-prototype typecheck
```
