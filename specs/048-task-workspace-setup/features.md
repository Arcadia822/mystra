# 功能说明：Task Workspace Setup

## 摘要

为带 Project 的 Task 提供显式 Setup Workspace 动作。Project 保存普通 Default branch 配置；平台通过标准 Git 协议读取 remote branches、验证配置并解析 exact commit，Issue 能力决定工作分支名，Runtime 在本机准备 repository 目录。一个 Task 最多拥有一个 Workspace，所有 Task Session 共享这个可变目录。

## 功能地图

- Task：发起 Setup、查看状态、持有 `0..1` Workspace。
- Project：持久化用户可编辑的普通 `repositoryBaseBranch`；Provider default branch 或 standard Git symbolic `HEAD` 只可用于初始预填。
- Standard Git repository reader：读取 remote branches 和 symbolic `HEAD`，从 exact connection、repository external ID 和 configured branch 解析 canonical base ref 与 exact commit；读取失败时设置可退化为文本输入。
- RepoProvider：保持 repository discovery/identity，不承载 provider-specific branch API。
- Issue：为带 Issue 的 Task 产生 branch name；无 Issue 时使用确定性 Task fallback。
- Runtime：广告 materialization 能力，准备 clone/worktree，返回 opaque workspace reference。
- Session：当前仅支持 Task-bound Session；048 只解析已有 ready Task Workspace attachment，不创建或持久化 Session，也不发起 Provider。Project-only 与 standalone Session 延后。

## 边界

- Task Session 不创建隔离 worktree，也不冻结文件内容。
- Workspace 不自动迁移、重建或跨 Runtime 复制。
- Workspace preparation claim/lease 只服务 materialization fencing 与重试，不是 Session Runtime capacity、slot 或执行占用。
- 不接受调用方 clone URL、本地路径或 Git ref。
- 不包含 push、PR、Issue write-back、缓存目录治理和垃圾回收。

## 分阶段能力图

1. `048`：建立 Task Workspace、标准 Git repository/Issue 策略与 Runtime materialization 合同。
2. `049`：仅实现 Task-bound Session launch；在一个原子 launch transaction 中创建 Session、解析全部输入、拼接 system prompt 与第一条 user message，再通过选定 Provider 发起执行。它消费同一 Task Workspace attachment，不引入 initial `turnId`。
3. `050`：Task 页面提供 Setup、Session 发起、状态与历史体验。

未来 deferred Session modes 如进入范围，必须复用同一 Workspace/attachment 合同，只允许准备逻辑不同；当前不定义其输入、字段或 sharing mode。
