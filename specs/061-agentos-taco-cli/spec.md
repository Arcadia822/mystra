---
title: "061 AgentOS Taco 工具预装与发布出口"
feature_id: "061-agentos-taco-cli"
created: "2026-09-22"
status: "实现及普通 Session 首轮发布验收完成；续接依赖 MYST-28"
issue: "MYST-25"
---

## 用户场景与验证

用户已确认按现有 Taco 上游能力交付，并在 PR #47 合并后从 main 继续。范围是运行环境预装，不扩展 Taco 上游 API，也不改变 Task/Session 授权。

### 场景一：需求 Agent 离线取得工具（P1）

作为需求 Agent，我希望沙盒启动后即可读取 Taco 本地组装说明和 shell，并运行固定版本 CLI，避免任务中安装依赖。

验收：配置 Taco 的 Runtime 创建普通 AgentOS Session 后，`taco-cli help` 返回 `binaryVersion: 0.1.3`，`taco-cli skills read taco` 可用，本地 Taco skill 与 shell 可读；重建 VM 后仍然成立。软件作为 Runtime 只读输入，不由 Workspace 提供。

### 场景二：受限发布（P1）

作为操作者，我希望 Agent 可把明确要求公开的 Taco 上传到配置的发布服务，而不获得任意公网出口或仓库凭据。

验收：`publish --dry-run` 不访问网络；`publish` 返回可访问的 URL，上传内容与公开合成样例一致。默认 deny，只额外允许配置的 HTTPS origin 对应 TCP 资源。未启用时不安装 Taco、不增加出口。非法配置在创建 VM 前拒绝。

### 边界场景

- 发布服务故障或拒绝请求：保留 CLI 非零退出，不伪造成功或自动重试。
- 包文件缺失：在 VM 创建前失败，不在任务里下载或调用宿主 CLI 兜底。
- 非 HTTPS、内嵌认证、路径、query、fragment、通配符 origin：拒绝配置。
- 公网发布无 ACL：仅上传明确允许公开的内容；不上传真实仓库、会话或凭据作测试。

## 功能需求

- FR-001：固定 `@tacobin/cli@0.1.3`；版本验收读取帮助中的 `binaryVersion`，不把无独立实现的 `--version` 当作合同。
- FR-002：复用 AgentOS software 装载契约注册 PATH 中的 `taco-cli`；不能只证明宿主安装成功。
- FR-003：预装固定来源的本地 Taco skill 与完整 shell；本地组装仍是 skill 流程，不发明 `bundle` 子命令。
- FR-004：由受信任部署环境显式配置 HTTPS 发布 origin；不从 Task/Workspace 推导权限，不增加全网或 CDN 通配符。
- FR-005：当前 publish 是免登录上传；不注入 `TACO_HOST_API_KEY`，不复用 Project、Linear、模型或 Session 凭据。
- FR-006：保留当前上游能力边界：真实网络 `update` 未实现，不修改上游或伪装更新。
- FR-007：在 c1 通过正式适配器的预装配置验证 guest 命令与发布，并记录启动路径、出口和真实结果。

## 成功标准

- SC-001：配置后的沙盒无需在线安装即可运行 CLI 并读取本地组装资源。
- SC-002：公开合成 Taco 发布成功，返回地址与内容可独立核对。
- SC-003：未配置及非法配置不扩大出口；配置后非允许目标仍被拒绝。
- SC-004：普通启动、VM 重建与现有 Session 能力探测未被旁路。

## 不在范围内

Taco 上游 bundle/version/update 实现、私有发布、自动发布用户文档、Vercel 权限变更、通用工具目录、任意网络出口和 Task/Session 领域模型变更。
