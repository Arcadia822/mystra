# Mystra Spec Prototype

这是与生产 Control Plane 分离的交互原型 app。它不是静态 HTML 沙盒：

- 主题样式来自 `@mystra/ui/styles.css`；
- button、field、surface、dropdown、popover、icon、Label 与 stacked list
  均直接来自 `@mystra/ui`；
- shell 使用与生产 `AppShell` 相同的 class contract 与主题 geometry；
- mock data 与 feature-only composition 留在本 app，不进入生产业务代码。

## 启动

    pnpm dev:prototype

- 054：<http://localhost:3010/054-navigation-task-workbench>
- 可复制起点：<http://localhost:3010/starter>

## 新 Spec

1. 复制 `app/starter/page.tsx` 对应的 feature composition，而不是复制生产
   app 或旧 spec 中的 HTML。
2. 在 `app/<feature>/page.tsx` 增加 route；mock data 与 feature-only CSS 留在
   `apps/spec-prototype`。
3. 缺少 primitive、icon、theme token 或 layout contract 时，先补到
   `packages/ui`，确认生产 Control Plane 与 prototype 都通过 typecheck。
4. `specs/<feature>/prototype.md` 记录 route、覆盖状态、mock 边界与复用证据。

禁止通过复制 SVG、重写标准 modal/dropdown/popup、或伪造 production class
anatomy 来获得“看起来一致”的结果。那种结果很快，但不属于工程。
