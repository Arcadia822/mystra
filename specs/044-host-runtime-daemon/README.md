# 044 · 宿主机 Runtime、Provider 发现与任务派发

把一台已装 agent CLI 的机器，通过安装并启动 Mystra runner CLI（MVP 配好 endpoint 直接启动、无校验）
接入 control-plane，以心跳回传方式纳管；runner 自动发现本机可用 agent CLI 作为该 Runtime 的
**Provider** 能力。任务启动按四轴模型绑定 `Task × Runtime(provides Provider) × Agent(provider+
prompt+skills) × Context(repo/worktree)`，在独立 Context 中以 headless/`-p` 模式驱动 Agent。
参考 `multica-ai/multica` 的宿主机 daemon 实现。

## 产物

| 文件 | 内容 |
| --- | --- |
| `spec.md` | 功能规格（用户故事、FR、实体、边界门禁、成功标准、非目标） |
| `research.md` | 对 multica runtime 实现的源码级研究 + 与 Mystra 现状差异 |
| `contracts/` | （plan 阶段填充）Runtime/执行/心跳/claim 的 Zod 契约 |

## 状态

Draft。**实现前门禁**：本 feature 把"宿主机 worktree 直跑"设为 MVP 默认执行模型（Docker sandbox
降级为可选/后置），属产品边界变更，须先修订 constitution 与 5xP 边界，之后方可 `/speckit.plan`。

## 已确认边界决策

1. 执行模型 = 替换（宿主机 worktree 直跑为默认；Docker 后置）。
2. 持久化 = 本 feature 拥有 Runtime + Agent 配置 + Context + 最小执行/Session 记录。
3. 接入认证 = **MVP 不做校验**，runner 配好 endpoint 直接启动注册（认证整体后置）。
4. 概念模型 = **四轴轻量模型** `Task × Runtime(provides Provider) × Agent(provider+prompt+skills) × Context`；Provider 为能力维度、来源无关（host 发现 / 未来 image 声明）。
5. Context（repo/worktree）与任务派发**解耦**：准备工作环境是独立的上下文管理能力。

## 下一步

1. 修订 constitution / AGENTS.md / PLATFORM 边界（执行模型变更）。
2. 补 `prototype.md`（Runtimes 页 + Runtime 详情/Provider + Agent 配置 + Context 列表 + 发起任务 + 执行回放）。
3. `/speckit.plan` → `plan-eng-review` → `/speckit.tasks`。
