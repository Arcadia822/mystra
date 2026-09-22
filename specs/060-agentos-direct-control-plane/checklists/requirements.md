---
title: "060 需求质量与设计自检表"
feature_id: "060-agentos-direct-control-plane"
spec: "spec.md"
---

## 需求质量自检表

| 检查维度 | 状态 | 评估与自检说明 |
|---|---|---|
| **场景独立可验证** | [x] | 规划了 4 个技术场景（读取上下文、状态上报、基于 real whoami 的启动预检失败关闭、跨 VM 续接），均包含完整的 Given/When/Then 与独立验证步骤。 |
| **边界明确无模糊** | [x] | 明确了基于 `loopbackExemptPorts` 与单文件 CJS bundle 的直连控制面架构；网络白名单精确限定至模型端点与 `127.0.0.1:<port>`；清晰列出了非目标（不引入额外的 host proxy 进程服务、不引入跨租户 VPC 网格等）。 |
| **安全约束是需求而非叙述** | [x] | 凭据传递（仅 Session env，绝不入 argv/日志/事件/文件）、路径脱敏（固定 `/home/agentos/workspace`）、预检失败关闭（真实 `whoami` 探测阻断于写模型凭据前）、`loopbackExemptPorts` 豁免与回环网络规则全部定义为正式编号需求（FR-060-001 ~ FR-060-007）。 |
| **验收与产物区分清晰** | [x] | 验收标准明确区分 Session ready 与实际 Task 状态/版本流转；成功标准必须依赖控制面真实状态（statusRevision 递增与 Task 状态流转）及 guest 内部命令执行日志。 |
| **与 059 的传承与废除明确** | [x] | 明确写出“废除 059 隔离决定（execution code 绝不入 guest）”；将 059 遗留阻断项 T027 与 FR-006 缺口完全在本特性闭环承接。 |
| **代码与配置清理完整** | [x] | 逐一列出废弃文件（`mystra-binding.mjs`、`mystra-binding.test.ts`、`guest-bin/` 目录）与配置（`MYSTRA_AGENTOS_GUEST_BIN`），引入 `MYSTRA_AGENTOS_GUEST_CLI_DIR`。 |

---

## 需求评分

**自评分：98 / 100**
- **业务目标与价值清晰度**：30 / 30（彻底打通沙箱 Agent 闭环汇报与生命周期管理的卡点）。
- **功能完备度**：25 / 25（基于真实实测修正，覆盖网络回环豁免、单文件 CJS 打包、挂载、环境变量、CLI 契约、预检、续接与负向防护）。
- **技术约束与安全规范**：20 / 20（安全边界硬化，凭据生命周期严格受控，负向矩阵包含缺少豁免的失败关闭验证）。
- **操作者流程与验收设计**：14 / 15（给出真实的 host-c1 双轮端到端操作步骤与诊断方案）。
- **范围控制（非目标）**：9 / 10（严格限定在单配置项豁免直连架构，杜绝不必要的宿主代理基础设施）。

---

## 剩余风险与环境假设

1. **宿主本地回环端口监听**：
   - *事实与要求*：控制面在 host-c1 上监听在宿主 loopback（如 `127.0.0.1:3000`）；AgentOS 沙箱通过 `loopbackExemptPorts: [3000]` 直通该端口。
   - *验证措施*：预检命令 `"$MYSTRA_AGENT_PATH" whoami` 会在写入模型凭据前进行严格探测，若端口未就绪或未豁免直接 Fail Closed。
2. **构建打包单文件完整性**：
   - *事实与要求*：`apps/runner-daemon` 的 `build:agentos-cli` 使用 esbuild 0.28.2 必须以 `--format=cjs` 打包，严禁添加 `--banner:js`。
   - *验证措施*：构建脚本纳入 `package.json` 并通过针对性构建检查，确保运行时无 dynamic require 错误。
