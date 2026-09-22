---
title: "059 部署与真实任务验收"
---

## 前提

固定Node24.14.0与pnpm10.25.0；代码、锁文件和生成后的Prisma client一致。控制面、Host Runner、AgentOS Runner分别管理，先验证再重启；禁止清空host-c1现有数据库。

AgentOS Runner 必须显式设置 `MYSTRA_RUNNER_RUNTIME_TYPE=agentos` 与 `MYSTRA_PI_PATH`（已部署的绝对 `pi-agentos-shim.mjs` 路径）；启动时会验证文件名及 `--version` 中的 AgentOS/Pi 身份，绝不从 `PATH` 回退到宿主原生 `pi`。Runner 现在对组合失败关闭：只设 `MYSTRA_PI_PATH` 而不设 `MYSTRA_RUNNER_RUNTIME_TYPE=agentos` 会按 host Runtime 注册、永不探测 Pi shim，因此直接启动报错；`agentos` 缺 `MYSTRA_PI_PATH` 同样报错。Host Runner 与 AgentOS Runner 必须使用不同的 `MYSTRA_RUNNER_ID_PATH`；控制面拒绝同一 `runnerId` 以另一 Runtime 类型重新注册，避免两个执行后端被静默合并。

模型端点合同：`/opt/agentos/task-config.json` 的 `model.baseUrl` 必须是 HTTPS 绝对URL且不含内嵌凭据。guest 出站默认拒绝，只放行该端点的 `tcp://<host>:<port>`；端点若重定向到其他主机，需要在同一规则中追加对应资源串。沙箱隔离细节与实测见 `research.md`「沙箱凭据与出口隔离」。

正常鉴权验收使用Ego TaskSpace `207`通过本机SSH loopback tunnel访问host-c1 Control Plane。2026-09-20通过公开`POST /api/auth/register`取得正常Human cookie，再以受控测试成员身份切换到现有Mystra Team；未写入`auth_sessions`、未回显密码、sessionToken、executionCode、模型API key或KEK。Task创建、Start、Workspace查询、Session/Event查询和最终Human状态迁移均通过现有授权HTTP端点完成。

验收期间为可用浏览器登录路径改动了 `apps/control-plane/app/_components/control-plane-gate.tsx`：`/login`、`/register` 改为以未认证状态初始化，不再先渲染“Checking your session…”等待 `/api/auth/session`；决策逻辑抽到 `control-plane-gate-model.ts` 并有单元测试。该改动**不属于 059 范围**，归属身份/Team 特性的登录页面行为，需要在对应特性中补一条覆盖 gate 渲染与已认证跳转的用例；此处仅登记，避免把无关回归混入本特性的验收结论。

## 文档任务

1. 用现有API/MCP/CLI创建Project-bound Task，description描述需要的设计文档。
2. Start传`providerKey: pi`、独立AgentOS runtimeId、expectedRevision、idempotencyKey和`initialInstruction`。
3. 指令明确：只读仓库并产出一个命名Markdown设计文档，不改代码、不建立PR，要求先读取runtime提供的context。
4. 检查Task -> TaskExecutionContext -> Workspace -> Session归属；保留请求/响应ID，不保留凭据。
5. 检查真实工作区文件路径、内容、尺寸和sha256；同时读取Session事件，不以ready或Agent自述单独判定完成。
6. 同Session发送下一轮消息，VM重建后要求沿用首轮仅在对话出现的随机事实修改原文档。第二轮不得重新发送该事实。

## 常驻GitHub出口

部署模板：`scripts/dev/mystra-github-egress.service`，服务端脚本`github-connect-proxy.mjs`放到host-a1 `/opt/mystra-egress/`。

- 服务只绑定100.85.55.0:8899，来源100.89.186.36，目标github.com:443。
- host-c1：`git config --global http.https://github.com/.proxy http://100.85.55.0:8899`。
- 验证：在host-c1执行`git ls-remote https://github.com/Arcadia822/mystra.git refs/heads/main`。
- 拒绝验证：非host-c1访问代理、host-c1请求其他目标，必须403。
- 代理故障回退：停止该服务并取消相应Git proxy配置；这会恢复原先不可达状态，不承诺直接网络可用。不要恢复开放笔记本代理。

## 密钥启动配置

host-c1新增control-plane专属drop-in `/etc/systemd/system/mystra-control-plane.service.d/20-secret-store.conf`，引用权限0600的`/root/.mystra/secrets.env`。文件只包含secret-store key和key id，不回显其值。该drop-in等待整合部署时daemon-reload与控制面重启生效；不能把manager-wide临时环境当作已持久化配置。

## 2026-09-20 host-c1实际验收

- 运行身份：Runtime `b5797837-160d-4340-8371-8820af16d830`（`host-c1-agentos`，`type=agentos`），Runner `00c954b0-5e4b-49a9-9931-54c25d7b4cc7`，Provider `pi`为available；实际版本为`@agentos-software/pi 0.2.7`与`@rivet-dev/agentos-core 0.2.19`。
- Task `9ea0acbb-05ae-4af8-b3f2-3949d4206b87`经公开`POST /api/tasks`创建，再经`POST /api/tasks/{id}/production/start`绑定上述Runtime与Pi；TaskExecutionContext为`1e4ab050-75fb-4744-a522-018216f1bf78`。
- 首次Workspace clone完成后超过60秒attempt lease才上报，attempt `fd755406-e313-4443-a74c-650732b79d9c`被判expired；公开Workspace retry复用已发布且与冻结commit/branch一致的目录，Workspace `ae07f8d0-a6fa-4b8c-a105-e048e73cd7da`随后进入ready。该现象是部署性能风险，不影响本次重试后的产物真实性。
- Session `f69be053-a6f4-4c7c-b3b6-5eb5e83e740e`由Pi实际执行并回到ready。事件1-9覆盖created、system prompt、Workspace attachment、首条message、dispatch、Provider start、response start、Agent输出和response complete；宿主工作区实际生成`TACO_DESIGN_NOTE.md`，且读取确认包含`Taco design verified under AgentOS Pi runtime.`。
- 第一轮结束后Pi adapter已dispose该VM；第二条message `45b88e11-d44a-483e-a3f7-5062e9e7c84c`触发新的Provider进程与AgentOS VM。相同Session的AgentOS SQLite记录保持同一`acp_session_id=6b56c840-48f3-4ab8-ac2e-ede6610ed59b`，并包含两个completed prompt：序列`1..322`与`323..501`。第二轮事件10-14在同一Mystra Session内完成，文件实际追加`Durable Pi continuation verified after AgentOS sandbox rebuild.`。
- Mystra dispatch lease保持相同`provider_session_id=f69be053-a6f4-4c7c-b3b6-5eb5e83e740e`；Workspace `git status --short`仅显示Runtime marker`.mystra-workspace.json`和任务产物`TACO_DESIGN_NOTE.md`。
- 验收后一次非必要的状态汇报消息在外部模型调用阶段停滞；重启AgentOS Runner后通过canonical `SessionService.close`收口该消息，再按Agent handoff与Human review状态合同将Task推进为`done` revision 4。最终Session为`closed`，Task为`done`，已成功完成的前两条Pi response及其文件产物保持不变。
- 验收收口后，Control Plane、Host Runner和AgentOS Runner三个systemd服务均为`active`；临时验收User、Team与membership已删除，Task、Session、事件、Workspace和产物证据保留。
- 本地固定Node `24.14.0`重新执行全仓`pnpm test`：187个test files通过、1个跳过，876个tests通过、24个跳过；全仓`pnpm typecheck`通过；SQLite与PostgreSQL Prisma schema validate通过；`git diff --check`通过。

## 2026-09-20 加固后复验（T025）

同一 host-c1 上重启 `mystra-agentos-runner.service` 后，Runtime `b5797837-160d-4340-8371-8820af16d830` 以同一 runnerId 重新注册，`runtime_providers` 中 `pi` 仍为 `available`，版本 `pi 0.2.7 (@agentos-software/pi) agentos-core 0.2.19 (@rivet-dev/agentos-core)`。

以部署版 `/opt/agentos/agentos-runner.mjs`、部署模型配置（`https://api.deepseek.com`）、真实 host_dir Task 工作区和真实网络执行两轮探针（一次性脚本，运行后删除）：

- 第一轮 `mode=start`：`success=true`、`stopReason=end_turn`，Agent 在工作区创建 `docs/PROBE.md`，内容为随机 marker。
- 第二轮 `mode=continue`：新 VM 恢复同一 sessionId（`durableEvents=38`），Agent 复述上一轮只在对话中出现的 marker 并追加到同一文件；宿主侧文件内容为两行 marker。
- 两轮日志均出现 `ephemeral model credential removed before prompt`；工作区文件与 `session.sqlite`（159744 字节）均不含模型 apiKey（原始与 UTF-16 两种编码都不含）。
- 加固后的出口策略未阻断真实模型调用，说明 `tcp://api.deepseek.com:443` 放行规则成立。

## 2026-09-20 独立审查整改（T026）

独立 reviewer 在 PR Arcadia822/mystra#43 上给出四项非阻断发现，全部进入本 lane：

- **deadline/idle 终止语义**：超时/空闲中止原先映射为 `session.response_failed`，而该投影是终态，一次慢响应即可毁掉整个 Session。现在 Pi Provider 的 `exitCode=124` 映射为 `session.response_canceled`（可续接），仅真实失败才进入 failed；`end_turn` 但没有 assistant 文本不再判失败（Agent 写完交付物后不回复是合理的）。回归用例：`apps/runner-daemon/src/session/session-worker.test.ts`、`agentos-runner.test.ts`。
- **时间参数校验**：`MYSTRA_AGENTOS_DEADLINE_SECONDS`/`MYSTRA_AGENTOS_IDLE_SECONDS` 现在要求正整数字符串；空值、`1.5`、`NaN` 在 Runner 启动与适配器加载时 fail fast，不再静默变成“每次会话立刻超时”或“关闭空闲保护”。回归用例：`apps/runner-daemon/src/index.test.ts`。
- **Standard Execution Prompt 正向断言**：恢复 TaskExecutionContext bootstrap 用例中对 `$MYSTRA_AGENT_PATH context get`、host-local `linctl`、host-local `gh`、以及“不校验 Agent 自述”的责任断言。
- **guest→host workload binding 端到端验证**：见下。

### guest workload binding 复验结果（失败关闭）

按 reviewer 建议在 host-c1 用部署版适配器、真实模型配置与真实 host_dir 工作区探测 guest 侧能力通道：

- 未加固前的研究只证明了宿主侧契约；实测 guest 内 `agentos list-bindings` 返回 `exit 127`（stderr 被 SDK 归一化为 `command not found`）。三层通道对照与最小配置复现记录在 `research.md`「AgentOS binding 命令分派实测」。
- 适配器现在于 **写入任何模型凭据之前** 探测 guest 通道并失败关闭。实测输出：
  `AgentOS Pi cannot reach the Runtime-provided workload binding from inside the guest (agentos list-bindings exit 127); this Session would run without its Session-scoped capability`（2.9 秒返回，未写 `models.json`、未开 Pi 会话）。
- 该结论意味着 **FR-006 在当前 SDK 版本下未达成**：AgentOS Session 会明确失败而不是“看似成功但没有能力调用”。修复需要产品/架构决策（见 tasks T027），本 lane 不擅自放宽 059 已评审的“guest 不持有 execution code”约束。
- 部署一致性：`/opt/agentos/agentos-runner.mjs` 与仓库同文件 md5 一致；`mystra-agentos-runner.service` restart 后 `active`，Runtime `b5797837-…` 仍以 `type=agentos` 注册、`pi` provider `available`。

## 已完成与后续风险

完整Mystra Task文档产出、正式Pi适配器跨VM续接和实际文件修改均已通过。**但 T026 复验证明 guest 侧 workload binding 在当前 SDK 版本不可用**：Session 现在按 FR-006 要求失败关闭，而不是在没有能力调用的状态下“成功”。这是本特性当前唯一的阻断项，处置方案见 `tasks.md` T027。仍需后续单独处理两个非阻断发现：首次大型clone可能超过固定Workspace lease，以及当前用户界面未暴露049的后续`sendMessage`入口；本次续接调用canonical `SessionService.sendMessage`，没有伪造SessionEvent或新建替代Session。

加固复验另观察到一条与本特性改动无关、需要单独排查的宿主挂载行为：以 059 使用的宿主用户身份（uid 1000 `agentos`）执行 `vm.exec` 时，host_dir 挂载的**根目录**枚举返回 `general io error: Invalid argument (os error 28)`，且在该根目录直接创建新文件返回 `Permission denied`；子目录的枚举与读取正常（`ls docs`、`cat docs/a.md` 成功），ACP Agent 进程自身可正常写入工作区（本轮 `docs/PROBE.md` 即由 Agent 写出）。该现象在不加 `.pi/extensions` 遮蔽挂载时同样出现，因此不是本次遮蔽改动引入；本轮不扩大范围处理，留待宿主挂载层单独确认。
