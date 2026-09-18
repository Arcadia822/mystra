---
title: "058 端到端自动化验收记录（本机 production build）"
---

自动化 harness：`scripts/e2e-event-subscription.mjs`（`pnpm e2e:events`）。一次运行内启动真实
production server bundle，通过真实管理 API 建立 Linear/GitHub connection 与 Project，启动真实
`mystra-agent` 子进程完成订阅，再经统一入口投递 webhook，最后断言整条链路与负向矩阵；退出码非 0
即失败。

## 执行环境

- 日期：2026-09-18
- Node：v24.14.0；pnpm 10.25.0
- Control Plane：`apps/control-plane/dist/server.js`（`NODE_ENV=production`，`pnpm --filter @mystra/control-plane build` 产物），宿主机 loopback 端口
- `MYSTRA_PUBLIC_URL=https://e2e.mystra.test`（用于 Webhook URL 组装；POST 直接打 loopback）
- 数据库：临时目录内 SQLite，由 `prisma/sqlite/migrations` 全量迁移建立（14 个迁移）
- 凭据：`LINEAR_API_KEY`、`GITHUB_PAT` 仅经进程环境注入，不写入本文件；Linear 只读查询，未修改任何 Linear 数据
- 命令：`pnpm e2e:events --port <n>`（`--keep` 保留临时工作目录与 `e2e-report.json`）

## 结果

26/26 检查通过（重复执行 3 次均通过，含不同端口与不同随机 Delivery）。

| # | 检查 | 观测结果 |
|---|---|---|
| 1 | schema bootstrap | 14 migrations 应用成功 |
| 2 | production server start | `nodeEnv=production`，Next 页面与 API 同入口 |
| 3 | operator registration + session | 201，Team 建立 |
| 4 | real Linear connection | 201，凭据经真实 Linear GraphQL 校验后置为 ready |
| 5 | real GitHub connection + Project | 201，Project 绑定真实仓库 `Arcadia822/gnhf` |
| 6 | Linear issue source binding | 200，`linearTeamId=111192dc-5da4-471a-8802-f49d71d91c5e`（MYST） |
| 7 | reverse-unique scope conflict | 409 `ISSUE_SOURCE_SCOPE_CONFLICT` |
| 8 | original binding preserved | 原绑定仍为 MYST |
| 9 | stable trusted-origin webhook URL | `https://e2e.mystra.test/api/webhooks?token=<uuid>`，重复读取完全一致 |
| 10 | CLI `events list` | exit 0，目录含 `linear.issue.state_changed` |
| 11 | CLI subscription established | 收到 `subscribed` |
| 12 | stderr online-only 诊断 | `online-only: events are delivered only while this connection is alive; no replay` |
| 13 | ingress acknowledges immediately | 200 `{"received":true}` |
| 14 | webhook → CLI delivery | **26 ms**（阈值 10 s），帧序列 `hello, subscribed, event`；事件 `linear:<delivery-uuid>:linear.issue.state_changed`，`subject.externalId` 与 `identifier=MYST-17` 正确，`changes.state.from/to` 为真实 In Progress→In Review 状态 ID |
| 15 | token 不泄漏 | stdout/stderr 均无 session token |
| 16 | 过滤不匹配 | 200，零投递 |
| 17 | 同 Delivery 去重 | 第二次 200，零重复投递 |
| 18 | 仅标题修改 | 200，ignored，零投递 |
| 19 | organization 不匹配 | 200 后异步丢弃，零投递 |
| 20 | 同步入口拒绝 | 无效 token 401、缺失 token 401、GET 405、非 JSON 415、超大 body 413 |
| 21 | 订阅凭据矩阵 | 无 token 401、任意凭据 401、endpoint ID 当凭据 401、未加入 Team 403、合法 Token 101、错误子协议 400 |
| 22 | CLI SIGTERM | exit 143，socket/timer 清理 |
| 23 | CLI 退出后 server 仍健康 | 后续 webhook 仍 200 |
| 24 | 跨租户管理读取 | 403 |
| 25 | 被引用 connection 不可删除 | 409 `INTEGRATION_CONNECTION_IN_USE`，endpoint 仍可用 |
| 26 | 解绑后删除 connection | 204，旧 endpoint ID 立即 401 |

### 本次执行发现并修复的缺陷

1. **准入 generation 上界恒为 0**：`EventRuntime` 自持的 generation 计数器从未被写入，导致每个
   被接纳 webhook 的 `subscriptionGenerationCap=0`，任何订阅（generation ≥ 1）都被投递器丢弃——
   事件永不投递。改为在构造时注入 `currentSubscriptionGeneration` 提供者，由 `EventRouter` 暴露
   已发出的最高 generation；`server.ts` 显式接线。新增回归测试
   `event-runtime.test.ts › stamps the admission subscription-generation cap from the provider`。
2. **Upgrade 拒绝使用 `socket.destroy()`**：客户端得到 ECONNRESET 而非 HTTP 错误体，CLI 无法按
   合同依据 Upgrade 状态分类认证失败。改为 `socket.end()`（`server.ts` 与 `ws-transport.ts`）。
3. **RdbError 泄漏成 400 `INVALID_DISPATCH`**：被 Project 引用的 connection 在通用删除路由上返回
   400 而非 409 `INTEGRATION_CONNECTION_IN_USE`。`error-response.ts` 现将与公开错误码同名的
   `RdbError` 映射为其文档化状态码。

## 本次运行的边界（未证明的部分）

- **Linear 不是发送方**：webhook 由本机以官方 Issue webhook schema（含真实组织 ID、Team ID、
  状态 ID、Issue ID）发出，用于验证 Mystra 侧解析与投递；**不代表 Linear→Mystra 公网投递已验收**。
- 未部署到 host / host-c1，未配置 HTTPS origin 与反向代理；`MYSTRA_PUBLIC_URL` 的 HTTPS 与
  公网可达性属于部署验收（quickstart 第 1–2 步）。
- SIGTERM 后「server 残留订阅数为 0」（SC-010）由
  `apps/control-plane/src/lib/events/ws-transport.test.ts` 断言，server 未暴露订阅计数端点，
  harness 只证明 CLI 退出码与退出后 server 健康。
- 断线重连重订阅、慢 stdout/slow consumer、心跳超时、第 5 条连接 429、双 Team 并发订阅、
  成员撤销选择性关闭由契约矩阵要求，目前由单元/集成测试覆盖，尚未纳入本 harness。

## 复现

```sh
pnpm install
pnpm --filter @mystra/control-plane build      # Next build + dist/server.js
LINEAR_API_KEY=... GITHUB_PAT=... pnpm e2e:events --port 3457
```

harness 结束时自动终止 server 与 CLI 子进程并删除临时目录；`--keep` 可保留
`e2e-report.json` 与临时 SQLite 供排查。
