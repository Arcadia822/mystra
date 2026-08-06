# Castrel v2 组件迁移清单

## 来源与边界

- 来源仓库：`/Users/arcadia/Documents/castrel-ai/frontend`
- 来源包：`castrel-demo-v2`
- 来源提交：`cdce88e2fff4667f306961ded4995d14b987a17e`
- 目标表面：Mystra 当前 025 shell、New composer、Search、Inbox、Issues table 与 Settings。
- 迁移范围：迁移上述表面实际使用的通用结构、组件 anatomy、density、padding 和交互状态；不复制未在当前表面使用的 Castrel 图表、Tiptap、SRE 领域组件及其依赖。

## UX Intent

当前 025 页面已经借鉴 Castrel 的布局语言，但按钮、链接、卡片、dialog、field、状态和空态仍由页面级元素与 CSS 分别实现，无法证明组件级一致性。此次迁移建立 Mystra-owned 共享组件层，并用它替换当前表面的页面级原语。

- 体验问题：同类 action、surface、field 和 state 在不同页面重复实现，padding 与状态样式容易漂移。
- 受影响表面：共享 shell、New、Search、Inbox、Issues、Settings，以及它们的 loading、empty、selected、disabled、error 和 narrow viewport 状态。
- 复用规则：保留 Castrel v2 的组件 anatomy、密度和交互层级；保留 Mystra 的产品语义、DOM 语义、API truth、暗色技术主题和可访问性规则。
- 响应式与可访问性：保持 320/768/1024/1440px 验证，所有交互使用原生 button/link/input/select/dialog 语义，icon-only control 有明确 accessible name。
- 风险：直接复制 Castrel Tailwind class、Radix 依赖或具体 palette 会形成第二套主题系统；因此组件只消费 Mystra semantic token。
- 验证信号：目标表面不再定义独立的 action/surface/field/state 视觉值；主题切换不改变组件语义；计算样式中的 color、background、border、padding、height 和 radius 均可追溯到 token。

### Owner feedback：输入焦点

- 2026-08-05 owner 明确要求所有 input-like control 在 focus 后不显示高亮热区边框。
- `input`、`textarea`、`select` 及 Settings/New/Inbox 的 field container 在 focus/focus-within 时保持 resting border 与 surface，不增加 accent border、outline 或 halo。
- 此规则只作用于输入类控件；button、link、tab、dialog close 等命令控件继续保留 keyboard-visible focus。

## 源到目标映射

| Castrel v2 来源 | Mystra 目标原语 | 当前使用表面 | 迁移规则 |
| --- | --- | --- | --- |
| `CastrelButton` / `CastrelHeaderButton` | `UiButton` / `UiIconButton` / `UiActionLink` | shell、composer、Inbox、Issues、Search、Settings | 保留 24/28/32px 密度、ghost/soft/solid 层级和 disabled/loading 语义；padding、颜色、border、radius 使用 token。 |
| `CastrelCard` / `CastrelReaderSection` | `UiSurface` / `UiSurfaceHeader` / `UiSurfaceBody` / `UiSurfaceFooter` | Inbox、Search preview、table frame、settings choices | reading section 只拥有一层水平 inset；默认 12px，panel/modal 使用相应 token。 |
| `CastrelModal` / `CastrelPopup` | `UiDialogSurface` | Search、Settings | header/body/footer 分区沿用来源 anatomy；20px modal inset、16px popup inset通过 token 表达，不复制来源装饰性大圆角和阴影。 |
| `CastrelSearchSelect` / base Input | `UiInput` / `UiSelect` / `UiTextarea` | composer、Search、Inbox、Issues、Settings | 保留原生 input/select/textarea 语义；field 高度、内部 inset、focus/error/disabled 从 token 获取。 |
| `CastrelV2SettingsGroup` / `CastrelV2SettingRow` | `SettingGroup` / `SettingRow` | Settings、Project 配置 | 保留透明 group、32px 节奏和左标题/说明、右控件 anatomy；窄屏按标题、说明、控件顺序堆叠，不复制 Castrel palette 或业务状态。 |
| `CastrelStatusBadge` | `StatusBadge` | Inbox、Issues、对象页 | 状态文本与 signal color 同时存在；signal role 不因 theme 改变含义。 |
| `Loading` / `NoData` | `UiSurface` state variants | Inbox、Issues、对象页 | 保留显式 loading/empty/error；spacing、文字和 icon 色使用 token。 |
| `CastrelNavTab` / `CastrelHeaderPath` | shell nav/path action variants | shell 与对象页 header | 28px header baseline、10px horizontal inset、selected/hover 强度从 semantic interaction token 获取。 |

## Token 约束

- 颜色只允许来自 surface、text、border、interaction 和 semantic signal token。
- 通用 spacing 使用 4px 基准序列；Castrel 来源的 6px control gap、10px header inset、20px modal inset和 composer `9/7/7/9px` 特殊 inset使用命名 token，而不是页面级裸值。
- 当前表面的 padding、gap、height、radius 不得以新裸值散落到 page-specific selector。
- theme 切换可改变 token 的具体值，但不得改变 action level、selected、focus、success、review 或 error 的语义。

## 明确不迁移

- Castrel 的具体颜色、gradient、shadow、28px modal radius 和 Tailwind utility 字符串。
- 当前 Mystra 页面未使用的 charts、Tiptap、editor、SRE object、automation domain、workflow graph 组件。
- Castrel 的业务 API、i18next 资源、Radix/shadcn 运行时和页面路由。
