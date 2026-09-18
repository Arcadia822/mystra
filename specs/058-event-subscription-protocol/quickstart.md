---
title: "058 验收运行手册"
taco_scope: plan
status: "实施目标；尚未执行功能验收"
---

本文件是实施后的验收步骤，不是当前可运行功能的声明。`mystra-agent events`、统一 custom server 与 endpoint API 尚未实现；共享原型 route 已完成浏览器验收。不得用 fixture 通过替代真实 Linear 验收。


使用仓库固定 Node 24.14.0、pnpm 10.25.0。保留既有 human operator 登录机制；订阅使用其 session store，不使用 Task workload 的 execution code。测试账号必须拥有目标 Team；配置 Integration 需要 `team.integration.manage`，订阅需要 `team.resource.access`。

## 部署与启动验收

1. 配置受信任的部署级 `MYSTRA_PUBLIC_URL` HTTPS origin 和支持 Upgrade 的反向代理。（2026-09-17 Owner 决定）token 进入日志不要求脱敏，无需代理日志过滤或错误采集脱敏规则。该配置不是用户五步 setup 的额外一步。
2. 用实现后的统一 server 启动 dev 与 production build，分别证明 Next 页面、现有 API/MCP、HMR（dev）与 events 共用正确入口。真实 Linear→立即 HTTP 200→异步 worker→CLI 的完整链路必须在 production build 下验收，并与 dev 对照响应、鉴权、重连及退出行为。不得用 next dev 或独立 fixture 服务冒充 production build；现有 deploy-dev-machine.sh 的 next dev 模板不是已完成的 production start 证据。
3. 使用哨兵凭据执行错误请求，验证 401 拒绝与错误码正确性。
4. 验证正常关闭停止 admission、WS 和 timer，RDB 生命周期无重复初始化；检查现有部署与 preview 启动脚本均已切换。

## 五步真实 Linear setup

前置：公网 HTTPS 已部署，操作者有 Linear workspace webhook 管理权限，内置 GraphQL IssueProvider 可正常工作。

1. 启用内置 Linear Integration。
2. 输入并验证 Linear API key。
3. 在 Integration Detail 复制固定 webhook URL，到 Linear 配置 Issue webhook；不填写 Mystra signing secret。
4. 在目标 Project 选择 Linear issue source。
5. 选择 Linear Team。另一 Project 抢占同一 Mystra Team 内相同外部 scope 必须冲突，原绑定保持不变。

页面刷新、重复进入设置与服务重启后必须读取到同一 URL；connection 删除后旧 endpoint ID 拒绝新的入口请求。API key 仍由 SecretProvider 管理，不因 webhook 改为 host-local linctl。

## 启动在线订阅

以下命令为实施目标；`<...>` 必须替换为专用验收资源的真实 ID：

```sh
mystra-agent events list --team <mystra-team-uuid>
mystra-agent events subscribe --team <mystra-team-uuid> --project <project-uuid> \
  --integration linear --event-type linear.issue.state_changed \
  --filter changes.state.to=<linear-in-review-state-id>
```

使用 operator session file（`--session-file`、`MYSTRA_OPERATOR_STATE_PATH`、默认路径依次取值）。确认 stdout 只有协议 JSON，stderr 承载诊断；收到 subscribed 后才开始触发事件。不要在 argv 中传 token。

在专用 Linear Issue 上执行一次状态变化，核对真实 payload 的 `data.teamId`、`data.stateId` 与 `updatedFrom.stateId`；与当前官方 schema 不符时先修正 adapter/合同，不从最新 GraphQL 值臆造历史值。计时从 Mystra 接收 webhook 起至在线 CLI 帧出现，须小于 10 秒。记录脱敏 event ID、时间与目标 Project，不保存原始凭据或 Issue 正文。

## 合同与异常验收矩阵

| 场景 | 必需结果 |
|---|---|
| 两个不同 Delivery、相同 webhookId | 两个不同事件；webhookId 不参与 delivery 去重 |
| 同 Delivery 并发重复 | 保留期内每匹配订阅至多一次 enqueue；进程重启不承诺全局去重 |
| 第二 fixture integration | 仅 registry 构造注入 adapter；通用 ingress/router/CLI 核心零修改 |
| token 无效、来源失效、组织不匹配 | token/来源在入口拒绝；组织不匹配在 200 后异步丢弃；均零投递、无 token 回显 |
| 合法 token 加任意签名 | 不做签名校验；不得把此项写成安全拒绝用例 |
| body 超限/接收超时/inbox 满 | 接纳前对应 413/408/503，零成功接收，不创建无限等待队列 |
| JSON/schema 错误、worker DB 故障、去重容量满 | 已返回 200，异步丢弃并诊断，无第二次响应或内部重试 |
| 仅标题修改、旧状态缺失、状态未变 | ignored；不制造状态变化事件 |
| cookie-only、execution code、未加入的 Team、Project 与连接 Team 不匹配 | 握手/订阅拒绝，不能降级认证或跨 Team 混投 |
| 同一 human session 同时订阅两个有权限的 Team，再切 active Team | 两条连接继续工作，各自只接收其 Team 的事件，不需重新登录 |
| 建连后撤销某 Team 成员身份/归档 Team | 仅对应 Team 停止投递并关闭，另一 Team 继续工作 |
| session 到期/注销或 user 停用 | 该 session/user 下相关连接全部停止新投递并清理 |
| owner/admin 降为 member 但仍具资源访问权限 | 连接继续，按实际权限判定，不因角色名称改变误断连 |
| 同一 session 尝试第 5 条连接 | 429 与退避诊断明确；已有连接不受影响，释放名额后可重连 |
| 两个订阅、过滤匹配与不匹配 | 每个匹配订阅各一帧，不匹配零帧 |
| 网络断开后重连 | 退避并重建期望订阅；明确丢失窗口，不补发 |
| stdin unsubscribe 后断网 | 被取消订阅不恢复；控制输入与 stdout 均有界 |
| server/CLI 队列满、stdout 堵塞 | 关闭慢消费者，其他连接仍可工作 |
| SIGINT、SIGTERM、EPIPE | 规定退出码；timer/socket/订阅释放，无后台重连残留 |
| SQLite 与 PostgreSQL | reverse unique 竞争、stable endpoint identity、connection 删除失效行为一致 |
| 暂停 worker 的 parse/source/auth | 完整接收后已获得 `200 {"received":true}`；解除屏障后才处理，不含业务 outcome |
| inbox 积压时新增/重连订阅 | 新 generation 不接收已有 backlog；原订阅仍须通过当前权限检查 |
| connection 删除后再次 webhook | endpoint ID 立即拒绝；已接纳但未投递记录在 worker 复查时丢弃，无持久化或补发 |
| worker 查询超时但底层尚未 settle | 仍占 worker slot；迟到结果不产生投递，I/O 数量有界 |
| 同 Delivery 绑定前后处理 | 先异步 ignored 不占 key，绑定后再次接纳可处理；两次 HTTP 均仅表示 received |
| 四个 worker 的底层 I/O 全悬挂 | 独立 timer 清理排队过期项，运行中记录仍占配额；接纳饱和明确 503，I/O settle 后恢复，无迟到投递 |
| inbox 两种容量上限 | 小 body 命中条数上限、大 body 命中字节上限；不误按 256×1 MiB 计算，也不提前扣除仍被引用的运行中 body |

所有具体限额、HTTP/close/退出码以 [协议](contracts/event-protocol.md)、[Webhook 合同](contracts/webhook-and-integration.md)、[CLI 合同](contracts/agent-cli.md) 为准。

## 验收记录与门禁

保留实际执行命令、环境版本、输出和失败修复结果。共享 UI 必须在真实浏览器核验，详见 [prototype.md](prototype.md)。执行现有受影响测试以及最终 build/typecheck/lint；新回归测试只保留授权、竞争、资源边界等会捕获真实故障的案例。

本次 plan 只提供静态文档/合同一致性证据：未启动新 server、未连接 Linear、未执行以上功能场景。工程评审、原型和最终真实运行证据不得以此文件存在代替。
