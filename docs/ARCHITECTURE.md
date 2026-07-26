# Mystra 架构

可编辑架构图：

- [mystra-architecture-zh.excalidraw](mystra-architecture-zh.excalidraw)

## 图内容

Excalidraw 文件包含一个分层架构视图：

1. **核心运行拓扑**
   - MCP 客户端 / Agent
   - API 调用方
   - Next.js 控制平面与 HTTP/SSE MCP 端点
   - Open Agents 源码基线 / 参考架构层
   - IntegrationPlugin / RepoProvider / IssueProvider
   - 本地 SQLite RDB provider
   - Pull-based runner-daemon
   - Runner 本地 repo / pnpm / uv 预热缓存
   - 单机 Docker Sandbox provider / 任务容器
   - Codex / GitHub Copilot CLI
   - GitLab 分支与 MR 交付

2. **运维 / Runner 主机**
   - 当前开发部署使用的单机 Runner 主机
   - Docker 运行时
   - systemd 服务
   - Mihomo 本地代理
   - `/root/.mystra` Runner 侧密钥目录
   - Runner 本地缓存目录
   - MVP 并发与超时限制

3. **安全 / 治理**
   - Runner 仅出站连接控制平面
   - 任务容器不挂载 Docker socket
   - 密钥通过运行时 env vars 或只读文件注入
   - 结构化事件与最终结果追加写入
   - 托管数据库启用 RLS，并通过 service role 访问
   - Kubernetes 沙箱作为未来运行时选项

## 边界规则

- Mystra 将 Open Agents 作为源码级基线与参考架构，而不是假定其已经提供完整可复用 SDK；provider 和 orchestration seam 由 Mystra 明确拥有。
- Mystra 是 headless 的 control-plane-and-runner 系统；UI 是观察面，不是产品边界。
- 本地 SQLite RDB provider 是当前 jobs、runs、runner_sessions、events 和 artifacts 的事实源。
- Job/Run 是执行事实源；runner 直接拥有固定的 Agent 生命周期。
- 单机路径是一等形态；后续集群方向应尽量走 shared-nothing 的热路径协调，而不是复制 VictoriaMetrics 的三段式服务外形。
- 单机 Docker 是当前 Sandbox provider；更强隔离或云 sandbox 是后续 provider 实现。
- Control plane 持久化 Job/Run；runner 通过出站轮询原子 claim。
- Runner 主机只主动向控制平面发起出站连接。
- Runner daemon 可以使用主机 Docker socket；任务容器不能挂载它。
- Runner daemon 维护 repo mirror/worktree seed cache、pnpm store cache 和 uv cache。
- Runner 缓存只提升性能，不保存任务输出；缓存失败必须回退到冷 clone/install。
- Project / runtime / template 可以越来越声明式，但进入执行热路径前必须被解析成冻结的 runtime / execution contract。
- Context Bundle 是从协作空间进入执行空间的传送带，提交 job 时会冻结执行侧 spec，任务容器消费的是注入工件，而不是外部聊天历史。
- GitLab 分支名、MR 标题和 MR 正文来自任务/仓库上下文，而不是 Mystra 全局策略。
- Mystra MVP 不做分支名 sanitize、不处理分支冲突、不提供 retry API。
- 密钥通过运行时环境变量或只读文件注入，绝不写入镜像。
- MVP 不提供 logs API、日志持久化、callback URL、quality-gate fix loop、
  Claude CLI adapter 或 control-plane 调用方认证。未来编排扩展只能作为
  可拔插 agent hook 项目重新进入，不能凌驾于 Agent 生命周期之上。

## 协作空间 与 执行空间

```text
协作空间（Mystra 外）                   执行空间（Mystra 内）
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ 澄清 / 审阅 / 批准 spec       │       │ plan / implement / verify    │
│ 聊天、评论、草稿可以继续变化   │       │ 单个 run 只消费冻结后的输入   │
└──────────────┬───────────────┘       └──────────────┬───────────────┘
               │ job submission                         │
               ▼                                        ▼
        冻结执行侧 spec ----------------------> 通过 Context Bundle 注入工件
               │                                        │
               └──────── reviewer 可追溯到该 frozen spec ┘
```

- 协作空间可以继续迭代，但一旦提交 job，执行侧使用的 spec 就被冻结为该 run 的执行契约。
- Sandbox 内 agent 应面向注入的 spec 工件工作，而不是把协作聊天历史当成隐式上下文源。
- 如果协作空间随后批准了新版本 spec，应该重新提交新 job，而不是回写到已接受或已完成的 run。

## 平台能力 vs 项目状态

Mystra 明确区分平台能力与项目状态：

- `PlatformCapabilities`：runner 注册时声明的平台运行时能力，包括支持的 agent 和 executor 类型。
- `PlatformDefaults`：平台级默认限制，包括并发、超时、心跳过期、长轮询超时、CPU 和内存配额。
- `Project`：项目作用域配置，包括一个经 RepoProvider 解析的远程
  RepositorySnapshot、默认分支、默认 agent、运行镜像、预热配置和元数据；
  不接受本地路径或任意 clone URL。
- `JobSpec`：身份层（`taskId`、`source`）加 `projectId`、任务分支、prompt
  和冻结的 Project 仓库事实，不允许 job 级仓库或基础分支覆盖，也不承载平台级执行能力。

当前实现中，runner 注册已经从无类型 capability bag 收紧为类型化 `PlatformCapabilities`；Docker 运行镜像来自 Project，而不是 runner 全局配置。

## 当前 Runner 说明

已准备的开发 Runner 记录在：

- [RUNNER-ENVIRONMENT.md](RUNNER-ENVIRONMENT.md)

当前重要事实：

- Copilot 容器路径已通过 `COPILOT_GITHUB_TOKEN` 验证。
- Codex 容器认证缓存路径已验证。
- 当前 Runner 上完整执行 Codex 需要 source `/root/.mystra/proxy.env`。
- 当前代理只监听主机 loopback，因此 bridge 网络容器需要 host networking 或可从 bridge 访问的代理配置。
- 当前 Castrel-oriented runner image context 不在 git 中，默认本机路径是 `/tmp/mystra-castrel-runner-image`。它不是 Mystra 平台 baseline；Project 通过 `Project.runtime.image` 显式引用具体镜像。
