# 原型：Host Runtime 注册、Provider 发现与心跳

**Feature**: `044-host-runtime-daemon`
**入口**: [`mockups/index.html`](./mockups/index.html)（自包含静态 HTML，浏览器直接打开）

本 spec 为 UI-facing，按 `aaa-spec-kit` 门禁，在进入 `/speckit.tasks` 与实现前须有可打开的原型。
原型为低保真线框，用于对齐信息架构与关键状态，不代表最终视觉。

## 覆盖页面 / 状态

| 面 | 覆盖内容 | 对应用户故事 |
| --- | --- | --- |
| **Runtimes 列表** | 已纳管 Runtime 表格：名称、类型（host）、online/offline、可用 Provider（含"不可用"标记）、最近心跳 | US1、US2、US3 |
| **Runtime 详情** | 稳定 id / runner id / 类型 / 状态 / 最近心跳（服务端接收时间）/ 连接方式（outbound）/ 发现来源；可用 Provider 表区分「发现」与「可用性确认」两态并给出不可用原因；重命名操作（MVP 无服务端移除） | US1、US2、US3 |

## 演示的关键规格点

- 状态判定基于**服务端接收心跳时间**（列表与详情均标注）。
- Provider **发现（存在）≠ 可用（能用）**：详情页两列分开，展示"版本低于门槛/未发现"等原因。
- 发现来源**来源无关**表达：PATH 扫描 / 登录 shell 兜底 / 环境变量覆盖 / 周期重扫。
- 连接为 runner **outbound**，control-plane 不主动 inbound。
- 明确标注**非本 feature 范围**：发起任务、Context、Agent 配置。

## 当前限制

- 纯静态，数据为示意；无真实注册/心跳/发现逻辑。
- 未覆盖发起任务、Context/worktree、Agent 配置、执行回放（均为后续 feature，不在 044）。
- 具体数值（心跳间隔、offline 阈值、重扫周期、最低版本）见 `spec.md` 的 Deferred Decisions，原型仅占位展示。
- **不含**产品内的 runner 安装引导（"Add a computer" 面）：runner 由 operator 自行安装启动，安装/托管细节见 `quickstart.md`，不在管理 UI 范围。
