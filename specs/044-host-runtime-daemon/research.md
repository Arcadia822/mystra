# 研究：宿主机 Runtime 与 CLI Runner（参考 multica）

**Feature**: `044-host-runtime-daemon`
**Created**: 2026-08-07
**Status**: Draft（研究记录，供 spec 与后续 plan 引用）

本文件记录对开源项目 `multica-ai/multica`（Go backend + 本机 daemon，self-hostable，
驱动 20 个 agent CLI）runtime 实现的源码级研究，以及它与 Mystra 现状的差异分析。研究
方法是直接读取 GitHub 上的源码与文档（`gh api`），下列结论标注了来源文件。

> **范围提示（spec 044 已收窄）**：本研究覆盖 multica 的注册/心跳、Agent 发现、`-p` 调用、
> worktree 与并发等多方面，但 **spec 044 只采用其中"注册 host Runtime + Provider 发现/可用性
> 确认 + 心跳/状态"部分**。`-p` 调用（第 5 节）、worktree（第 6 节）、并发/生命周期（第 7 节）
> 属于**后续 feature**（发起任务、Context 管理、执行/Session），此处保留为前瞻参考，不构成 044 的
> 交付范围。另：`mystra-runner` 用 **TypeScript** 实现，不移植 multica 的 Go。

## 1. Multica 架构总览

来源：`README.md`、`CLI_AND_DAEMON.md`、`apps/docs/content/docs/daemon-runtimes.mdx`。

```
Web / Desktop / iOS
        │
        ▼
  Next.js 前端 ──> Go backend (Chi router + gorilla/websocket) ──> PostgreSQL(pgvector)
        ▲                     │  tasks over WebSocket
        └─────────────────────┤
                       ┌───────┴────────┐
                       │  Agent daemon  │  跑在你自己的机器上，紧挨你的代码
                       └───────┬────────┘
                               │ spawns
                    Claude / Codex / Cursor / …（20 个 CLI 之一）
```

- **daemon 是"哑"的、纯 outbound**：不持久化业务状态，只持有 auth 凭证；server 保存全部状态。
  这让机器可以离线后恢复而不丢数据，代码与密钥不离开本机。
- **一台机器 = 一个 daemon**；daemon 为它检测到的每个 CLI × 每个 workspace 注册一条
  runtime 记录（"一个 runtime = 一台机器 + 一个 AI coding tool"，见 `daemon-runtimes.mdx`）。
  重启 daemon 更新既有记录而非新建。

## 2. 安装与接入

来源：`README.md`、`CLI_AND_DAEMON.md`。

- Self-host：`curl -fsSL .../install.sh | bash -s -- --with-server` + `multica setup self-host`。
- 接入一台机器：UI `Runtimes → Add a computer` 生成**两条命令**（安装 `multica` 二进制 +
  `multica daemon start`），粘贴到目标机器终端。
- 认证：`multica login` 走 OAuth 生成 90 天 personal access token 并自动发现 workspaces；
  也支持 `multica login --token <mul_...>`（headless）。
- daemon 默认后台运行，日志 `~/.multica/daemon.log`；`--foreground` 调试。
- daemon **启动前提**：至少检测到一个内置 agent CLI 才会启动。

## 3. 心跳 / 注册 / 控制协议

来源：`server/pkg/protocol/messages.go`、`server/internal/daemon/wsrpc.go`、
`server/internal/daemon/client.go`、`daemon-runtimes.mdx`。

- **注册**：daemon 连上后发 `DaemonRegisterPayload{ daemon_id, agent_id, runtimes[] }`；
  每个 `RuntimeInfo{ type, version, status }`。
- **传输**：持久 WebSocket 控制连接，带通用 request/response RPC（`RPCRequestPayload{
  request_id, method, body }` / `RPCResponsePayload{ request_id, status, body, error }`），
  按 `request_id` 关联，多路复用可并发多个 RPC（如 `tasks.claim`）。
- **pull 模型**：新任务入队时 server 通过 WS `TaskAvailablePayload{ runtime_id, task_id }`
  唤醒 daemon，daemon 再 claim；**WS 断了退回 HTTP 轮询兜底**。claim 有"已发送但结果未知"
  的谨慎处理（`errWSRPCUncertain`），避免重复 claim（MUL-4257）。
- **心跳**：每 **15s** 一次；server 综合心跳 + 连接状态判在线；daemon 异常退出后
  **~3min** 内显示 offline。
- 相关 server→daemon 唤醒事件：`WorkspacesChangedPayload`、`RuntimeProfilesChangedPayload`、
  `PendingWorkPayload{ runtime_id }`（让 daemon 立即发一次心跳来领取排队工作）。

## 4. Agent CLI 自动发现

来源：`server/internal/daemon/agents_probe.go`、`CLI_AND_DAEMON.md`、`install-agent-runtime.mdx`。

- 固定 allowlist 的命令名（`claude`、`codex`、`cursor-agent`、`copilot`、`opencode`、
  `openclaw`、`hermes`、`pi`、`agy`、`codebuddy`、`deveco`、`grok`、`kimi`、`kiro-cli`、
  `qodercli`、`qoderclicn`、`qwen`、`qwenpaw`、`reasonix`、`traecli`）。
- 主路径：`exec.LookPath` 扫 PATH。可用 `MULTICA_<AGENT>_PATH` 显式覆盖，
  `MULTICA_<AGENT>_MODEL` 指定模型。
- **登录 shell 兜底（源码级细节，供 #6 设计）**：GUI 启动的 daemon（Electron/Launchpad）拿不到交互
  shell 的 PATH（nvm/fnm/volta shim、`~/.claude/local`、`~/.local/bin` 等只被 rc 文件加入的目录）。
  仅在 bare 命令名 LookPath **未命中时**才走兜底：
  - 调用 `$SHELL -ilc <script>`：`-i` 读 `~/.zshrc`/`~/.bashrc`，`-l` 读 `~/.zprofile`/`~/.bash_profile`；
    `SHELL` basename 必须在允许表 `{bash, zsh, sh, dash, ksh}`，否则跳过。
  - 超时有界：context `3s` + `WaitDelay 2s` 硬上限。
  - 脚本逐名 `unalias`+`unset -f`（剥离 alias/函数遮蔽，让 `command -v` 穿透到真二进制）→ `command -v`
    → 要求绝对路径 → `cd "$dir" && pwd -P` 规范化（趁 fnm/nvm 临时 multishell 目录仍在时抓稳定路径）→
    打印 `name\tpath`。
  - 语言侧复核：返回路径必须绝对 **且** 再过一次 `LookPath` 从 daemon 视角确认可执行（滤别名 / 已消失
    的 multishell 路径）。
  - 缓存：进程级，key = `PATH+SHELL+HOME` 指纹，**TTL 30min**（远大于发现间隔）；env 变即失效；空结果
    也缓存（失败 shell 不每轮重 fork）。TTL 的理由是 probe 在活 daemon 上周期跑、且总有未装 provider 会
    miss LookPath——每次都 fork 会退化成每几分钟 fork 一次登录 shell。
  - 覆盖硬缺失：`MULTICA_*_PATH` 含路径分隔符 ⇒ 直接走 LookPath、**绝不**进 shell 兜底；pin 的路径不存在
    = 硬 miss，不静默回退到别的二进制。
- **发现 vs 版本两趟**：`probeAgentCLIs` 是**纯可用性**（LookPath 成功即"可用"），**不做**版本检测/最低
  版本门槛；后者是注册时另一独立步骤（`detectBuiltinRuntimes`）。这正对齐 Mystra 的 `discovered` vs
  `available` 两态（我们更显式：把版本门槛结果落到 `available`）。
- **运行中周期重扫**（`refreshAgentAvailability`）：用户在 daemon 运行时新装 CLI 无需重启即被
  发现；CLI 就地升级时重新探测版本并**重新注册 runtime，也无需重启 daemon**（availability 与
  第三方发布节奏解耦，MUL-5439）。
- 发现即 availability 集合，上报 `/health.agents`，也是 `multica daemon probe-runtimes` 的输出。

## 5. Agent 调用（headless / `-p` 模式）

来源：`CLI_AND_DAEMON.md`、`server/pkg/protocol/messages.go`、`server/internal/daemon/execenv/*`。

- 以各 CLI 的 headless/print 非交互模式驱动（如 `claude -p`），daemon 逐行捕获 stdout/stderr。
- 输出流回 server 成 `TaskMessagePayload{ task_id, seq, type, tool, content, input, output }`，
  type ∈ `text | tool_use | tool_result | error`——即"execution log：回放每一次 tool call、
  命令与错误，带时间戳"。
- 完成：daemon push 分支 / 开 PR，回 `TaskCompletedPayload{ task_id, pr_url, output }`，
  issue 进 review。失败按 server 端重试/超时规则处理。
- 每个 agent 的 execenv（`execenv/codex_home.go`、`cursor_mcp.go`、`hermes_home.go` 等）负责
  隔离该 CLI 的 HOME/配置/技能可见性——说明"驱动第三方 CLI"需要按 provider 定制执行环境。

## 6. Worktree 管理

来源：`server/internal/daemon/execenv/git.go`。

- 创建：`setupGitWorktree(gitRoot, worktreePath, branchName, baseRef)` →
  `git -C <gitRoot> worktree add -b <branch> <path> <baseRef>`；分支名冲突则追加时间戳重试一次。
- 清理：`removeGitWorktree` → `git worktree remove --force <path>` + `git branch -D <branch>`（best-effort）。
- `excludeFromGit` 向 worktree 的 `.git/info/exclude` 写忽略项；`sanitizeName` 产出
  git-branch 安全名。每任务独立目录，天然支持同机并发。

## 7. 并发与生命周期

来源：`daemon-runtimes.mdx`。

- 单 daemon 默认 **20** 并发；单 agent 默认 **6**；有效并发取小值。机器级上限
  `MULTICA_DAEMON_MAX_CONCURRENT_TASKS`，单 agent 并发在 agent 设置里调。
- runtime 离线时：已排队任务等待恢复最多 2h；运行中任务失败（可重试的自动重试）；daemon 重启
  重新注册并**认领上次未干净结束的任务**；离线 >7 天且无 agent 绑定的 runtime 自动清理。
- 隐私边界：AI CLI、其登录凭证、本地代码目录都留在本机；server 不代执行、不自动上传整个工作目录。
  但 **agent 的自定义环境变量与 MCP 配置存在 server**，执行时下发到 runtime——"本地执行"不等于
  "所有密钥只在本机"。
- **custom runtime profile**：对内部 wrapper / 版本钉死 / 固定额外参数的兼容命令，创建自定义
  profile（仍复用已支持的协议族，命令须兼容该族）；workspace 共享，各机自查 PATH，
  能解析到才注册对应 runtime；`multica runtime profile set-path/unset-path` 处理绝对路径覆盖。

## 8. Multica → Mystra 差异与取舍

| 维度 | Multica | Mystra MVP 取舍（本 feature） |
| --- | --- | --- |
| 执行模型 | 宿主机 worktree 直跑，无容器 | **采纳**：宿主机 worktree 直跑成为 MVP 默认；Docker sandbox 降级为可选/后置 |
| 概念模型 | Runtime(机器×CLI) + Agent(teammate=provider+skills+runtime 绑定) | **四轴轻量模型**：`Task × Runtime(provides Provider) × Agent(provider+prompt+skills) × Context`；Provider 为能力维度，Agent 可移植不绑机器 |
| runtime 粒度 | 机器 × CLI × workspace = 一条 runtime | Runtime = **一台机器**，携 `provides`（Provider 能力集合，**来源无关**：host 发现 / 未来 image 声明） |
| worktree 归属 | 每任务 dispatch 内联创建 worktree | **解耦**：Context（repo/worktree）为独立上下文管理能力；dispatch 只针对已备 Context 运行 |
| 传输 | WS RPC 为主 + HTTP 兜底 | MVP 先做 HTTP 心跳/claim（现有 `runner-daemon` 已具备）；WS 唤醒可后置优化 |
| 接入认证 | OAuth 90 天 token | **MVP 不做校验**：runner 配好 endpoint 直接启动注册；认证整体后置（未来走 outbound + `SecretProvider`） |
| agent 安装/授权 | 用户自行安装并登录 | **假定已装已登录**，本 feature 不管安装与授权 |
| 心跳间隔 | 15s；~3min 判离线 | 采纳同量级默认，具体值在 plan 定 |
| 并发 | 20/机、6/agent | 采纳"机器级 + 每 agent"双上限模型，默认值在 plan 定 |
| 成本/token 统计 | 有 | MVP 排除 |
| custom runtime profile | 有 | MVP 排除或后置（见 spec 非目标） |
| 多 workspace/Team | 有 | 单节点自用；Team 绑定沿用 043 边界，本 feature 不引入托管多租户 |

## 9. Mystra 现状（代码事实，供 plan 对齐）

- `apps/runner-daemon`：已有 `register / heartbeat / claim / poll` 主循环
  （`src/index.ts`、`src/registration.ts`），但**执行器是 Docker sandbox + Session claim**，
  且它调用的 `/api/runner/*` 路由在 control-plane **已不存在**（040 删除）。
- `apps/runner-daemon/src/direct-execution.ts`：已有"直接执行"的固定序列骨架
  （launchSandbox → clone → runAgent → test → build），可作为 host 直跑执行序列的起点。
- `apps/control-plane/app/runners/page.tsx`：占位符（Runners temporarily unavailable）。
- Prisma schema（`apps/control-plane/prisma/{sqlite,postgresql}/schema.prisma`）：**只有
  `Project`、`Task`**，无 Runner/Runtime/Session 持久化。
- `packages/shared/src/schemas.ts`：仍有 `runnerRegistrationSchema`、`runnerExecutorSchema`、
  `runnerPollRequestSchema` 等旧契约，可复用/改造。
- `042-runtime-sandbox-capacity`、`043-identity-team-rbac`、Session 持久化：延期/仅规格状态。

## 10. 关键设计启示（给 plan）

1. **daemon 保持无状态**：只持长期 runner 凭证；全部业务态在 control-plane（RDB）。
2. **pull + 心跳**：MVP 可先纯 HTTP（心跳 + claim + 结果回传），WS 唤醒后置。
3. **发现是纯 PATH 探测 + 周期重扫**：新装 CLI 免重启；登录 shell 兜底解决 GUI 启动 PATH 问题。
4. **worktree 是并发隔离手段**：每执行一分支一目录，结束强制清理。
5. **凭证卫生**：pairing token 与 runner 凭证明文走 `SecretProvider`，RDB 只存非秘密元数据与
   opaque 引用/哈希（Constitution IV）。
6. **provider 化执行环境**：驱动不同 agent CLI 需按 provider 定制 HOME/配置隔离，沿用
   Mystra 现有 `@mystra/agent-adapters` 抽象。
