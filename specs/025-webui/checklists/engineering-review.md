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

## 2026-08-06 Castrel Appearance 能力迁移复审

### 架构

- [x] 复用现有 `theme-system.ts`、hydration bootstrap 和 `AppShell` preference owner；静态 Codex catalog 仍通过同一 adapter/registry，不引入第二套 theme store。
- [x] `AppearancePreferences` 被限制为 versioned browser-local preference；数据库、API、server action 和跨设备同步明确不在本切片范围内。
- [x] `System` 模式只通过单一 `prefers-color-scheme` listener 解析 active variant，并在卸载时清理。
- [x] 运行态与 bootstrap 使用同一 default、normalization、variant/theme resolution 和 CSS variable contract，避免首帧与 hydration 后主题分叉。

### Codebase Evidence

- [x] Castrel 来源已核对：`AppearanceSettings.tsx`、`useAppearanceSettings.ts`、`appearanceSettings.shared.ts`、`lib/theme/castrelTheme.ts` 和 `stores/useThemeStore.ts`。
- [x] Mystra 现有实现已核对：`theme-system.ts`、`app-shell.tsx`、`shell-settings.tsx`、`shell-settings-panels.tsx`、`ui-dropdown.tsx`、`ui-fields.tsx` 与 `globals.css`。
- [x] GitNexus upstream：`buildThemeCssVariables` 与 `AppearanceSettingsPanel` 为 HIGH；`AppShell`、`applyThemeToDocument`、`buildThemeBootstrapScript` 与 `ShellSettings` 为 LOW。高风险来自共享 shell/首帧覆盖范围，未触及 API、RDB、Runner 或 provider 流程。

### 测试图

```text
localStorage
  ├─ valid JSON ─────────────── [unit]
  ├─ damaged JSON ───────────── [unit fallback]
  └─ invalid fields/ranges ──── [unit normalize]
             |
             v
mode resolution
  ├─ light / dark ───────────── [unit]
  └─ system + media change ──── [unit + browser]
             |
             v
variant theme + details
  ├─ light/dark scheme guard ── [unit]
  ├─ border modes ───────────── [unit + browser]
  ├─ code surface ───────────── [unit + browser]
  └─ contrast/fonts/sizes ───── [unit + browser]
             |
             v
bootstrap + Settings
  ├─ hydration first frame ──── [vm unit]
  ├─ preview/reset ──────────── [component contract + browser]
  └─ keyboard/responsive ────── [browser 320/768/1024/1440]
```

### 风险、性能与决策

- [x] 损坏或旧 localStorage 值逐字段 fail closed，不允许启动脚本抛错或选择跨 variant theme。
- [x] CSS variable 仅在 preference 或 system variant 变化时重算；无渲染期存储读取、网络请求或轮询。
- [x] 控件扩展进入 Mystra-owned shared primitives；Appearance panel 不创建 page-local segmented/range 实现。
- [x] 顺序实施；所有代码切片共享 theme/settings modules，没有安全的并行 worktree lane。

**结论**：0 个未解决架构决策，0 个 silent critical gap，可以进入 tasks 和 implementation。

## 2026-08-06 Codex Theme v1 兼容复审

### 范围与架构

- [x] `codex-theme-v1` 只作为 schema version；`codeThemeId` 是唯一主题 ID 字段。
- [x] Mystra label/description/explicit tokens 位于 adapter metadata，不污染 Codex v1 payload。
- [x] 同一 `codeThemeId` 的 light/dark 主题通过 `(variant, codeThemeId)` 解析，不需要 synthetic `id`。
- [x] 旧 synthetic preset id 只在 localStorage parse/bootstrap 边界迁移。

### Codebase Evidence

- [x] GitNexus upstream 将 `getThemeById`、`buildThemeCssVariables`、`resolveAppearanceTheme` 评为 CRITICAL，覆盖 `RootLayout`、bootstrap、AppShell 和 Appearance；`AppearanceSettingsPanel` 为 HIGH，`AppShell` 与 bootstrap symbol 为 LOW。
- [x] 最小改动复用 `theme-system.ts`、`theme-system.test.ts`、`app-shell.tsx` 与 `shell-settings-panels.tsx`，不触及 API、RDB、Runner 或 provider。

### 测试图

```text
serialized theme
  ├─ exact v1 + Everforest ───── [unit round-trip]
  ├─ unknown version ─────────── [unit reject]
  ├─ synthetic id / extra key ─ [unit reject]
  └─ invalid payload values ──── [unit reject]
             |
             v
registry + selection
  ├─ built-in v1 round-trip ──── [unit]
  ├─ same id, split variant ──── [unit]
  └─ legacy stored ids ───────── [unit + VM bootstrap]
             |
             v
first frame + runtime
  ├─ canonical dataset id ────── [VM bootstrap]
  └─ Settings option values ──── [typecheck + browser]
```

### 结论

- [x] 0 个未解决架构问题，0 个性能问题，0 个 silent critical gap。
- [x] 顺序实施；所有步骤共享 theme/Appearance 模块，没有安全的并行 lane。

## 2026-08-06 Codex 完整目录与 Mystra 双变体复审

- [x] 来源固定为本机签名 `/Applications/ChatGPT.app` 26.730.61639 / build 6234 的 `app.asar` registry 与 theme modules；未使用第三方主题列表。
- [x] registry 事实锁定为 28 个 Codex family / 43 个 supported variant；Mystra light/dark 加入后总计 45 个 `(variant, codeThemeId)`，无重复键。
- [x] runtime 不读取 Codex 应用包、不调用私有 IPC、不联网同步；catalog 是带来源版本的静态数据。
- [x] 原 Graphite dark payload/explicit tokens 仅改 canonical identity 为 `mystra`，配套 light variant 使用相同语义色和矿物灰层级。
- [x] `graphite-signal -> dark:mystra` 与 `linen-light -> light:notion` 仅发生在 localStorage parse/bootstrap 迁移边界。
- [x] GitNexus 预编辑审计：`getDefaultTheme`、`getThemeById`、`getThemesByVariant`、`getDefaultAppearancePreferences` 为 CRITICAL，`AppearanceSettingsPanel` 为 HIGH；直接验证覆盖 RootLayout 首帧、AppShell、Settings、normalization 与 bootstrap。
- [x] TDD RED 记录：目录 family/count、Mystra identity、官方 theme resolution 与 legacy bootstrap 共 4 项先失败；实现后 focused 16/16 与全量 148/148 通过。

## 2026-08-06 UI / Content / Code 字体合同复审

- [x] 外部 `codex-theme-v1` schema 未增加 Content 字段；exact round-trip 合同保持不变。
- [x] 内部 `ThemeFontRoles` 明确 UI / Content / Code；Codex UI → UI+Content，Codex Code → Code。
- [x] Mystra primary families 为 Arial / Georgia / Courier New，CSS fallback 使用平台 generic family，不保存 OS-specific stack。
- [x] `chatFont` / `chatFontSize` 与旧 Graphite 默认 stack 只在 parse/bootstrap 边界迁移。
- [x] 预编辑影响审计：`buildThemeCssVariables` CRITICAL、`normalizeAppearancePreferences` HIGH、`AppearanceSettingsPanel` HIGH；测试覆盖首帧与 hydration 后路径。
