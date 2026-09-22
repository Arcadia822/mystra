# 061 构建、部署与验收记录

## 构建

使用仓库 Node 24.14.0 / pnpm 10.25.0：

```sh
pnpm --filter @mystra/shared build
pnpm --filter @mystra/runner-daemon build:agentos-cli
pnpm --filter @mystra/runner-daemon test
pnpm --filter @mystra/runner-daemon typecheck
```

`apps/runner-daemon/dist/agentos/` 包含 `mystra-agent.cjs`、`taco-cli.aospkg` 和 `taco-skill/{SKILL.md,taco-shell.html}`。构建阶段需要 npm 依赖和固定 GitHub commit 的资源；任务执行阶段不需要安装或下载。不要把中间 `.tar` 当作 `.aospkg`。

部署当前 `agentos-runner.mjs` 到 Pi shim 相邻目录；将上述产物放到 `MYSTRA_AGENTOS_GUEST_CLI_DIR`。设置：

```sh
MYSTRA_AGENTOS_TACO_HOST_URL=https://tacobin.arcadia-han.com
```

这只增加 `tcp://tacobin.arcadia-han.com:443`，不增加 blob CDN、GitHub 或全网出口。返回 URL 的浏览器读取不等于 guest 获得对应 CDN 访问权。没有配置时不加载 Taco software，也不注入 Taco 环境或新增出口。

## 2026-09-22 实测

### 本机

- 官方 CLI 0.1.3 + toolchain 0.2.19 成功构建 canonical `.aospkg`。
- Skill 固定上游 commit：`410a425e50bcc10b7c89ad6015c4b67e7dc7d418`。
- 新出口测试先红后绿；增加缺失产物失败关闭回归后，runner 包 **13 文件 / 63 测试通过**，typecheck 通过。
- 初次 runner 全测有 2 个注册 schema 失败：合并 main 后 `@mystra/shared/dist` 仍是旧版本、缺少 `workloadInstruction`。重建 shared 后全部通过；没有修改 schema 或放宽验证。

### host-c1 部署

- 部署前两份 adapter 的 SHA-256 均与当前 main 基线一致：`1a3afb8a773a60bd5bc227a94514411805d21e83de446ff507c524b0ce34f53c`。
- 新 adapter 部署到 `/opt/agentos/agentos-runner.mjs` 和 `/opt/mystra/apps/runner-daemon/src/session/agentos-runner.mjs`；原版本备份于 `/root/.mystra/backups/myst25-20260922/`。
- Taco 包及 Skill 部署于 `/opt/agentos/guest-cli/`；保留原 workload CLI。
- `/etc/systemd/system/mystra-agentos-runner.service.d/30-taco.conf` 设置显式 Taco HTTPS origin。
- 只重启 `mystra-agentos-runner.service`；服务 active，Runtime `b5797837-160d-4340-8371-8820af16d830` 重新注册成功。未修改 Control Plane、Project 凭据或 Vercel 设置。

### 真实 guest 验证（不是普通 Task/Session 验收）

使用已部署 `.aospkg`、只读 Skill 挂载与生产 `permissionsForEndpoints`，两次独立创建并销毁 AgentOS VM：

- 两轮 `taco-cli help` 均 exit 0，`binaryVersion=0.1.3`。不是宿主 PATH 代跑。
- 两轮可读取 `SKILL.md`（16,462 bytes）及 `taco-shell.html`（732,401 bytes）。
- 两轮 dry-run 成功，内容 hash 相同。
- 两轮改投未放行 `https://example.com` 均 exit 1 / `fetch failed`。
- 第一轮真实 publish 成功，无认证键、Project 凭据、模型 key 或 execution code。
- 另一个全网 deny、零放行规则 VM 中，`taco-cli skills read taco` 和 `publish --dry-run` 均 exit 0，证明这两个命令不依赖网络。
- 已删除本次创建的两个 probe 脚本、宿主临时 npm 安装目录及打包中间件；保留部署产物、回滚备份与合成验收证据。

公开合成结果：

- URL：<https://tacobin.arcadia-han.com/t/64f09b5b-8be6-479e-864f-1c0b9e3d9e5e>
- 发布时间：`2026-09-22T08:35:39.858Z`
- Payload：380 bytes；`sha256:824916e4172f24db6d2a0634fee7ecb03b06d3f2e708b724b59e979b9891160a`
- 唯一源文件：`myst25-smoke/spec.md`，91 bytes；正文声明 `Public synthetic test. No repository data or credentials.`
- 浏览器已加载发布页面，DOM 中的标题和正文与样例一致。截图工具先报告零宽度，调整 viewport 后截图超时；不声称截图验收成功。
- c1 保留合成 HTML 和 `verification.json`：`/opt/agentos/tasks/myst25-public-smoke/`。

## 验收记录与门禁豁免

普通授权 Task/Session 的首轮已通过。SC-004 / T008 中同 Session 续接与新 VM 恢复验证原依赖 MYST-28；2026-09-22 负责人在 PR #56 审查后明确要求“收口吧 不等”，批准本特性不等待该验证。该场景仍未执行，随 MYST-28 后续验证，不直接写事件表替代入口。

初始 401 已解决：用户授权注册独立测试账号，并选择用现有 `gh` 身份通过正式 API 配置独立测试 Project。API 注册和登录成功，CLI 读取会话及创建 Task 成功；未修改数据库授权、冒用既有用户或抽取 execution code。

测试账号 `myst25_d006bfa0`（User `d5d4f0f0-8e35-4543-9797-126f070d3b26`）拥有独立 Team `871a9018-c0f3-4af9-9fe1-0ac6b2af8f7e`。通过正常 Connection API 将获准使用的 GitHub 凭据存入 SecretProvider；Project `8288b93f-e765-4999-b1f6-d3ad4f5aadd9` 只绑定公开仓库 `octocat/Hello-World`、稳定 ID `1296269`、基线 `master`。用户明确允许本机 GitHub 凭据用于测试，禁止向他人仓库提交 Issue/PR；本次也不 push。GitHub 凭据不进入 Taco 发布认证。

独立 CLI 登录 bug 已建 [MYST-31](https://linear.app/castrel/issue/MYST-31)：`auth login --password-stdin` 返回 `PASSWORD_INPUT_FAILED`，默认实现调用 `node:fs/promises.readFile(0)`。本次通过正式 `/api/auth/login` 成功登录，再将服务端签发的真实 token 保存到 CLI 既定格式的专用 0600 state 文件；CLI `auth session` 和 `tasks create` 均成功。没有伪造 token。

早期三次正式入口尝试失败，保留历史：

| Task | 结果 |
|---|---|
| `7a3d3347-5e60-457f-ae74-745f9777249c` | Start 200；准备期间 runner 于 17:05:42、控制面于 17:06:55 被其他操作重启；Workspace 租约过期 |
| `5a29e9b7-7fb7-4d95-807e-be21aba9422a` | Start 200；`repository_unavailable`，无法解析远端基线 |
| `0473c1a7-5181-42bf-9c3e-db919a1228f6` | Start 200、Workspace `efa44a2a-99d6-4ef3-933e-a43c8d1b582f` 进入 preparing，最终 `materialization_failed / Workspace preparation lease expired`；planned Session `e1148e8c-1f4c-4aea-a162-6e6c57c75970` 未创建 |

早期宿主直接 `git ls-remote` 和 `git clone --no-checkout https://github.com/octocat/Hello-World.git` 均观察到 `gnutls_handshake() failed: TLS 链接非正常地终止了`。强制 HTTP/1.1 曾使一次 ls-remote 成功，但后续 clone 仍失败；临时 URL-scoped 配置已撤回。后续使用获准的本机 GitHub 凭据，经 SSH stdin 和进程内 Git 配置执行 ls-remote/clone 均 exit 0；临时脚本和克隆目录已清理。没有关闭 TLS 验证、替换 GitHub 地址或扩大 guest 出口。当前连通性恢复，不据此断言早期 TLS 问题由缺少认证导致。

账号、独立 Connection/Project、失败 Task 均保留用于后续复测。测试账号密码与真实 CLI session state 仅存操作者本机 `~/.mystra/myst25-test/`，目录 0700、文件 0600，不进入仓库或 Taco。正式 API 的 `task_not_eligible` 也已验证：无 Project 的测试 Task `e771b608-4bee-491e-b19d-b44d81ff7d61` 不会启动生产。

### 普通 Session 首轮验收通过

- Task：`3d0a7b44-d637-443a-bd2a-a9ac8f06ac8b`；Start API 200。
- Workspace：`d6876b7f-92b0-43be-8ea4-cb93d483aaa2`；`readyAt=2026-09-22T09:31:23.924Z`。
- Session：`6ba89b0d-1766-422b-84a4-ed1e475b68d9`，Runtime AgentOS / Provider Pi；正式事件包含 created、workspace_attached、runtime_dispatched、response_started、agent_message_chunk、response_completed。最终 `ready`，`stopReason=end_turn`，完成时间 `2026-09-22T09:35:52.446Z`。
- Agent 报告真实执行 `node "$MYSTRA_AGENT_PATH" context get`、`taco-cli help`（0.1.3）、`skills read taco`、读取本地 Skill/shell、组装 HTML、dry-run 和 publish。
- 发布 URL：<https://tacobin.arcadia-han.com/t/5dec9fa4-c259-4d01-b2b1-eec16b0b3dcb>；发布时间 `2026-09-22T09:35:43.561Z`。
- 独立读取公开 blob，确认唯一文件 `myst-25-acceptance/document.md` 只含合成标题和正文 `MYST-25 normal Session acceptance. Public synthetic content only; no repository data or credentials.`；无仓库内容、凭据或评论。
- 在该 Session durable 事件中检查 38 个唯一工具调用输入：未匹配 `git push`、`gh issue create`、`gh pr create` 或 GitHub Issue/PR API 地址。没有执行远端写入测试。

### 后续验证：同 Session 续接（已豁免本 PR 门禁）

[MYST-28](https://linear.app/castrel/issue/MYST-28) 在本次验收时为 Todo，明确记录 `SessionService.sendMessage` 尚无 HTTP/MCP/CLI 外部入口；LSP references 也仅找到实现及测试。待该入口落地后向上述 ready Session 发新消息，验证新 VM 中命令、Skill、dry-run 和原 Session capability preflight。本特性 T008 按负责人豁免决定收口，不把该场景标为通过；未通过直接数据库写入或临时冒充外部入口来绕过依赖。

## 回滚

移除仅为本特性创建的 `30-taco.conf`，执行 `systemctl daemon-reload` 并重启 AgentOS runner；未配置时适配器保留原始行为。需要恢复代码时，用上述备份分别恢复两份 adapter。不要删除既有 Session 数据、工作区或其他服务配置。

## 审查结论

实现复用现有 readonly mount、software 与出口生成路径，不新增服务/API/DB，不向 Task 暴露任意权限配置。构建依赖版本与 Skill 来源固定；失败不走在线安装或宿主命令兜底。普通 Pi Session 首轮发布已通过；同 Session 续接验证经负责人批准移出本 PR 门禁，特性按该明确例外收口。

本次 PR 审查实际重跑：`build:agentos-cli` 成功，Runner 定向 17/17、全包 13 文件 / 63 测试通过，typecheck 通过；Taco 四份源文档及 SHA-256 一致。GitNexus 按 `0d9bd14` 重建 PDG，影响链为出口策略 → Runner → Pi shim，风险 LOW；未发现可确认的新代码缺陷。本次审查未重跑 c1 发布或真实续接，不将此前线上记录当成本次执行结果。
