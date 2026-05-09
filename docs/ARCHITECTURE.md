# Mystra 架构

可编辑架构图：

- [mystra-architecture-zh.excalidraw](mystra-architecture-zh.excalidraw)

## 图内容

Excalidraw 文件包含一个分层架构视图：

1. **核心运行拓扑**
   - MCP 客户端 / Agent
   - API 调用方
   - Next.js 控制平面与 HTTP/SSE MCP 端点
   - Open Agents 框架层
   - 本地 dummy Workflow provider
   - 本地 SQLite RDB provider
   - 私有 runner-daemon
   - Runner 本地 repo / pnpm / uv 预热缓存
   - 单机 Docker Sandbox provider / 任务容器
   - Codex / GitHub Copilot CLI
   - GitLab 分支与 MR 交付

2. **运维 / Runner 主机**
   - 裸金属 Runner 主机
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

- Mystra 复用 Open Agents 项目作为框架基础，但 provider 由 Mystra 明确拥有。
- 本地 SQLite RDB provider 是当前 jobs、runs、runner_sessions、events 和 artifacts 的事实源。
- 本地 dummy Workflow provider 只负责编排，不作为业务数据库。
- 单机 Docker 是当前 Sandbox provider；更强隔离或云 sandbox 是后续 provider 实现。
- Control plane 在 job/run 持久化成功后发起 workflow；发起失败由补偿扫描器重试。
- Runner 主机只主动向控制平面发起出站连接。
- Runner daemon 可以使用主机 Docker socket；任务容器不能挂载它。
- Runner daemon 维护 repo mirror/worktree seed cache、pnpm store cache 和 uv cache。
- Runner 缓存只提升性能，不保存任务输出；缓存失败必须回退到冷 clone/install。
- GitLab 分支名、MR 标题和 MR 正文来自任务/仓库上下文，而不是 Mystra 全局策略。
- Mystra MVP 不做分支名 sanitize、不处理分支冲突、不提供 retry API。
- 密钥通过运行时环境变量或只读文件注入，绝不写入镜像。
- MVP 不提供 logs API、日志持久化、callback URL、quality-gate fix loop、Claude CLI adapter 或 control-plane 调用方认证；runner 只执行一次确定性的 `test -> build` gate。

## 平台能力 vs 项目状态

Mystra 明确区分平台能力与项目状态：

- `PlatformCapabilities`：runner 注册时声明的平台运行时能力，包括支持的 agent 和 executor 类型。
- `PlatformDefaults`：平台级默认限制，包括并发、超时、心跳过期、长轮询超时、CPU 和内存配额。
- `Project`：项目作用域配置，包括 repo、默认分支、默认 agent、运行镜像、预热配置和元数据。
- `JobSpec`：身份层（`taskId`、`source`）加 `projectId`、任务分支、prompt 和可选覆盖项，不承载平台级执行能力。

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
