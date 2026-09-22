---
title: "061 实施计划与工程审查"
spec: "spec.md"
status: "实施及审查完成；续接门禁经负责人豁免后收口"
---

## 概要

复用现有 Runner 构建命令和 AgentOS software 机制。构建时固定 Taco npm 包及本地 skill 来源，产生标准 `.aospkg` 与 skill 目录；Session 启动只消费本地产物，不在线安装。受信任部署变量显式启用 HTTPS 发布 origin。

## 技术上下文

Node 24.14.0、pnpm 10.25.0、AgentOS core/toolchain 0.2.19、Pi 0.2.7、Taco CLI 0.1.3、Vitest。仅 Runner 构建与适配器变更，无数据库或 HTTP API 新增。目标是 c1 Linux AgentOS guest，保持 Host Runtime 不变。

## 宪章检查

保留 Team/Task/Session 权限，复用 060 guest Control Plane 能力与模型秘密清理。Taco 不接收 Project、模型或平台凭据。公开上传只用无秘密合成样例。本地 skill 仍是文件工作流，发布是显式 Agent 操作。无 UI、无需 prototype；无新领域实体或数据模型，配置合同直接记录于本计划。

## 现有能力与复用

- `build-agentos-cli.mjs`：已有 guest CLI 发布目录 `dist/agentos`，复用同一构建入口，不改变原命令。
- `guestCliDirectory()`：已有部署目录覆盖变量 `MYSTRA_AGENTOS_GUEST_CLI_DIR`，沿用。
- `permissionsForEndpoints()`：保留模型和 Control Plane 规则，添加一个经过严格校验的可选 Taco origin。
- AgentOS `software`：负责包校验、只读投影和 PATH 命令注册。不使用 shell 包装器或宿主执行兜底。
- 上游 skill：固定 Git commit `410a425e50bcc10b7c89ad6015c4b67e7dc7d418` 下 `skills/taco/SKILL.md` 与 `taco-shell.html`，构建时读取官方 URL；本次只预装组装所需文件，不宣称模板包可用。

## 配置与数据流

`MYSTRA_AGENTOS_TACO_HOST_URL`：未设置时禁用；设置时必须是无凭据、无 path/query/fragment/通配符的 HTTPS origin。值仅由宿主配置读取，不从 Workspace 读取。有效值传给 guest `TACO_HOST_URL`。

```text
固定 npm CLI + 固定 skill 源码
  -> Runner 构建 -> dist/agentos/taco-cli.aospkg + taco-skill/
  -> 正式 runPiInAgentOs
  -> software 装载 + 既有只读 CLI 目录
  -> guest taco-cli publish -> 指定 HTTPS origin
```

`dist/agentos/taco-cli.aospkg` 在启用时必须存在，skill 两文件必须存在；否则创建 VM 前报错。guest 指令提供 `TACO_SKILL_PATH`，要求先阅读 skill，说明公开上传、免鉴权和网络 update 不可用。未启用时保持既有指令与 env 不变。

## 工程审查

### 影响证据

GitNexus 本工作树索引与 main `a66bb12` 一致；注册名 mystra 有多个工作树，因此使用已注册绝对工作树路径消歧。`runPiInAgentOs` upstream 为 Pi shim（1 个直接调用方）；`permissionsForEndpoints` upstream 为该函数和 shim，均 LOW。LSP 确認出口函数的调用仅位于适配器；跨文件 shim 调用由 GitNexus 补齐。

### 决策与风险

- 不用裸 npm JS 文件/shebang 模拟 PATH 工具：已验证 toolchain 的软件目录及 `.aospkg` 均能直接运行 `taco-cli help`。
- toolchain `pack` 默认返回 tar，core 将文件当作 `.aospkg`：必须调用官方 `packAospkgFromTar`，不可把 tar 改扩展名冒充。
- 配置 origin 不接受 URL pattern 元字符，避免网络规则变为通配符；非法输入与未配置路径由回归测试覆盖。
- `.aospkg` 缺失或 skill 缺失清晰报错；正式 guest 的 package load 错误不吞掉。
- 新 VM 与恢复 VM 均重新装载固定软件，Session 状态无需迁移。
- 发布网络失败由真实 CLI 返回，不添加重试、队列、别名或兼容层。
- 构建网络失败立即失败，不写成功标记；只在构建时获取固定公开源，不在执行任务时下载。

架构、代码质量与性能审查无未决方案；安全边界测试和 c1 真实执行是验收门槛。顺序实施，适配器与构建目录共享边界，不拆并行工作流。

## 验证

1. 先添加可选 origin 的负向与 allowlist 合同测试，再改适配器。
2. 构建真实 `.aospkg`，在 c1 guest 直接执行帮助、读取 skill、离线组装与 dry-run。
3. 通过正式适配器实际 Session 路径发布无秘密样例，验证返回 URL 和公开内容；再重建 VM 验证 CLI 仍存在。
4. guest 对未授权目标失败；未配置 Taco 时原有规则不变。
5. Runner 定向测试、typecheck、代码审查；不重启无关服务、不改已有数据库。

2026-09-22 PR #56 审查：实际重跑构建、Runner 13 文件 / 63 测试、typecheck 均通过；Taco 四份源文档及哈希一致。GitNexus 在 head `0d9bd14` 重建 PDG，两个变更函数 upstream 为 LOW，未发现可确认的新缺陷。负责人随后明确要求“收口吧 不等”：同 Session 在新 VM 的续接验证随 MYST-28 后续处理，不再阻塞本 PR，也不宣称该验证通过。

## 不在范围内

上游 Taco 功能开发、AgentOS SDK 升级、通用插件注册、私有 ACL、CDN 通配符放行、自动发布真实仓库、#47 已有协议修复。回滚恢复原适配器/产物并移除启用变量，不删除 Session 数据。
