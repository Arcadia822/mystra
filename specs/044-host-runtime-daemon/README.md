# 044 · Host Runtime 注册、Provider 发现与心跳

把一台已装 agent CLI 的机器，通过安装并启动 TypeScript 版 `mystra-runner`（MVP 配好 endpoint
直接启动、无校验）接入 control-plane，以心跳回传方式纳管为 **host Runtime**；runner 自动发现本机可用
agent CLI 作为该 Runtime 的 **Provider** 能力并确认其可用，持续回报心跳与状态。参考
`multica-ai/multica` 的宿主机 daemon 实现。

> **范围收窄**：本 feature **只做**注册 host Runtime + Provider 发现/可用性确认 + 心跳/状态。
> 发起任务、Context（repo/worktree）管理、Agent 配置、执行/Session 均**不在本 spec**，由后续
> 独立 feature 承接。四轴模型 `Task × Runtime × Agent × Context` 仅作前瞻方向记录，本 feature
> 只落地 Runtime + Provider 两块。

## 产物

| 文件 | 内容 |
| --- | --- |
| `spec.md` | 功能规格（用户故事、FR、实体、边界门禁、成功标准、非目标） |
| `research.md` | 对 multica runtime 实现的源码级研究 + 与 Mystra 现状差异 |
| `prototype.md` | UI 原型入口（Runtimes 列表 / Add a computer / Runtime 详情） |
| `mockups/index.html` | 可打开的静态原型 |
| `contracts/` | （plan 阶段填充）Runtime 注册/心跳/Provider 能力的 Zod 契约 |

## 状态

Draft。**实现前门禁**：本 feature 引入 host Runtime 作为一类执行后端 + Runtime 持久化 + Provider 能力
上报，属产品与持久化边界变更，须先修订 constitution 与 5xP（AGENTS.md / PLATFORM.md），之后方可
`/speckit.plan`。

## 已确认边界决策

1. 本 spec 范围 = **仅** Runtime 注册 + Provider 发现/可用性确认 + 心跳/状态。派发/Context/Agent
   配置/执行/Session **全部后置**。
2. 接入认证 = **MVP 不做校验**，runner 配好 endpoint 直接启动注册（认证整体后置）。
3. runner 语言 = **TypeScript**（复用/改造 `apps/runner-daemon`），不用 multica 的 Go。
4. 持久化 = 本 feature 只拥有 **Runtime + 可用 Provider 能力**；Agent/Context/Session 延期。
5. 抽象 = Provider 能力**来源无关**（host 发现 / 未来 image 声明），为 042 的 image/云/K8s 预留兼容点；
   执行模型长期方向为宿主机直跑，但本 spec 不交付任何执行。

## 下一步

1. 修订 constitution / AGENTS.md / PLATFORM.md 边界（host Runtime + Runtime 持久化）。
2. `prototype.md` + `mockups/index.html`（Runtimes 页 + Add a computer + Runtime 详情/Provider）。
3. `/speckit.plan` → `plan-eng-review` → `/speckit.tasks`。
