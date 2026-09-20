---
title: "059：源码研究与运行证据"
---

## 安装版本源码

独立 scout AgentOsSdkResearch 读取 host-c1 `/opt/agentos/node_modules` 中 core0.2.19、Pi0.2.7、ACP0.16.1。

- core `dist/session-api.d.ts`：sessions.open接收sessionId、env、additionalInstructions；prompt/get/readHistory/unload支持显式sessionId。
- core `dist/agent-os.js:3555` 将env和instruction参数发送到sidecar。session env在恢复时重放，所以不能传execution code。
- `dist/sidecar/agentos-protocol.d.ts:65-95` 将open定义为幂等恢复入口。
- Pi `dist/adapter.js` 使用SessionManager.inMemory，没有native loadSession。不能把Pi内部ACP UUID当作可持久化恢复合同。
- `PromptResult.message.content` 按流delta积累，应join空字符串，不能每段插入换行。
- shared sidecar是process-global，单个VM结束不能释放所有共享VM。
- mount有效readonly为顶层readOnly优先，其次plugin config，默认true；共享CLI必须只读。

## 跨VM实际实验（2026-09-20）

Main运行一次临时host-c1脚本，两轮均使用安装版SDK、真实模型、相同sqlite_file与显式public sessionId。

1. 第一轮只在user message提供随机marker，要求ACK；实际stopReason=end_turn、ack=true、输出长度3。
2. await vm.dispose销毁第一VM。
3. 新建第二VM并open同sessionId；问题不包含marker，要求回忆上一轮marker。
4. 实际stopReason=end_turn、recalled=true、输出长度39，总运行8.93秒。

该结果证明这一版本组合通过open恢复后能够继续使用历史对话。它不是Mystra完整Task链的验收，也不证明native Pi load存在。未实现手工transcript重放或新的fallback。

临时脚本与含模型配置的临时会话数据库已删除；证据只保留结果布尔值，不保存密钥或完整模型配置。

## 提示词选择

采用一个task-neutral Standard Execution Prompt，hash随真实内容变化。初审曾建议多变体；二次源码复核确认单一中立文本完全符合现有evidence schema，不需要新selector。initialInstruction仅属于user message。

## 沙箱凭据与出口隔离（2026-09-20 加固）

早期实现把模型配置写入guest根文件系统，并从默认`allowAll`策略下运行；两条真实缺陷被独立复核与本地探针确认：

- **出厂权限**：`AgentOs.create`不传`permissions`时使用`allowAll`并附`binding: allow`。host-c1实测：默认策略下guest可`fetch` `https://example.com/`并取得`200`，即沙箱可把读到的任何内容发往任意公网主机。
- **凭据可读窗口**：模型`apiKey`在`sessions.open`期间必须以guest可读文件存在，Pi在open时读取`models.json`并只把结果留在内存（`customProviderApiKeys`）；`open`返回后该文件在整轮prompt期间仍留在guest内，可被Agent的shell读取。

现实现（`apps/runner-daemon/src/session/agentos-runner.mjs`）：

1. 模型配置改写到显式`memory`（ephemeral）挂载`/home/agentos/.pi/agent`，模型凭据不进入任何持久化面。
2. `sessions.open`之后、任何caller prompt之前删除`models.json`；删除失败即失败关闭。
3. `/home/agentos/workspace/.pi/extensions`以只读`memory`挂载遮蔽。Pi 0.2.7在`newSession`时从`<cwd>/.pi/extensions`与`<agentDir>/extensions`自动加载扩展，仓库内容因此可在凭据存在时执行；遮蔽后仓库无法注入扩展。
4. `permissions`显式声明全部scope，`network`默认`deny`，只放行`tcp://<模型主机>:<端口>`。

### 失败关闭的pattern语义

`network`规则的pattern匹配**规范化资源串**而非裸主机名：一次HTTPS出站请求是`tcp://<host>:<port>`。本地与host-c1实测（core 0.2.19）：

| pattern | https出站结果 |
|---|---|
| `example.com` | `blocked by network.http policy` |
| `example.com:80` | `blocked by network.http policy` |
| `tcp://example.com` | `blocked by network.http policy` |
| `tcp://example.com:443` | 通过策略层 |
| `**` | 通过策略层 |

即`example.com`这类主机名pattern**永不匹配**，会静默拒绝包括模型请求在内的全部出站。规则必须写成`tcp://<host>:<port>`，端口取URL显式端口或协议默认端口。文档所写的“pattern是host或host:port”在本版本不成立。

### 实测（host-c1，真实模型端点）

`/opt/agentos`内运行同一探针，两个策略各跑三个目标：

| 策略 | `api.deepseek.com` | `example.com` | `github.com` |
|---|---|---|---|
| `network: "allow"` | `REACHED 401` | `REACHED 200` | `fetch failed: other side closed` |
| 仅放行`tcp://api.deepseek.com:443` | `REACHED 401` | policy拒绝 | policy拒绝 |

结论：收紧后的策略不阻断已部署的模型调用，同时消除任意公网出口。运维约束：模型端点必须是HTTPS且不含内嵌凭据；若Provider会重定向到其他主机，需要在同一规则中追加对应`tcp://<host>:<port>`。

### 实测（本地darwin-arm64 sidecar）

| 检查 | 结果 |
|---|---|
| 仓库`.pi/extensions/evil.js`对guest可见 | 否（`ENOENT`），宿主目录其余内容仍可见 |
| `memory`挂载凭据在VM重建后仍在 | 否 |
| 凭据写入guest根文件系统后重建 | 不保留；`sqlite`文件中无明文凭据 |
| 根文件系统写入是否进入会话SQLite | 否（根文件系统为overlay上层） |

## 常驻GitHub出口（2026-09-20）

host-a1经Tailscale100.85.55.0可登录并直连GitHub。已部署：

- `/opt/mystra-egress/github-connect-proxy.mjs`
- `/etc/systemd/system/mystra-github-egress.service`，enabled/active，DynamicUser、NoNewPrivileges、ProtectSystem=strict、ProtectHome、PrivateTmp。
- 仅监听100.85.55.0:8899；source必须100.89.186.36；CONNECT目标必须github.com:443。
- host-c1 root git配置 `http.https://github.com/.proxy=http://100.85.55.0:8899`。

实际验证：host-c1使用配置后的git ls-remote返回7ecf239d3e096499eea8735453f048adff008c13；笔记本来源403；host-c1访问example.com目标403。旧笔记本0.0.0.0代理已经停止。未做TLS解密、未改证书信任、未使用镜像或复制代理订阅凭据。

独立LaunchContractReview复核代理，无阻断缺陷。残余运维约束：脚本参数需由受信任操作者配置，服务unit固定Tailscale地址；不作为公网通用代理。

## 工具边界

GitNexus全局mystra名称已属于主工作树。本特性使用`GITNEXUS_HOME=$PWD/.gitnexus/session-registry`运行固定pnpm gitnexus:rebuild，保留相同repo名称且不修改全局registry。LSP可用，已发现production start的9处引用。TaskProductionService blast radius HIGH：13总影响、5直接依赖、2流程；用户已获告知。
