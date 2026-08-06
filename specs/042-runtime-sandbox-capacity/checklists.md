# 评审清单：Runtime Sandbox 能力提供方

## Owner 评审

- [x] Runtime 表示能够提供 Agent Sandbox 的执行后端。
- [x] 安装 Mystra Runner 的主机只是 Runtime 的一种实现形态。
- [x] Kubernetes 和未来 Sandbox 云服务可以不安装 Runner。
- [x] Runner 被降为可选连接组件，而不是所有 Runtime 的一等前提。
- [x] 当前 `runners` 表和既有 Runner 行为暂不改动。
- [x] 本次只创建新 Spec，不进入 plan、tasks 或 implementation。
- [ ] 未来恢复设计时确认 Runtime 的 Team/平台所有权边界。
- [ ] 未来恢复设计时确认 Runtime 健康、容量和调度语义。

## Spec 就绪度

- [x] Runtime、Runner、Runtime Connection、Sandbox Spec 和 Sandbox Instance 的边界已分开。
- [x] connector 与 direct API 两种连接形态均被纳入。
- [x] 当前行为零变更被写成可验证成功标准。
- [x] 未把 PG/Supabase、Task Activity 或 Artifact 重设计混入本 Spec。
- [ ] Owner 尚未授权 `/speckit.clarify`。
- [ ] Owner 尚未授权 `/speckit.plan`。
- [ ] 本功能不应生成 `tasks.md` 或实现代码。

## 后续插件检查

- [ ] 恢复设计时重新核对 Kubernetes 与候选云 Sandbox Provider 的官方能力。
- [ ] 规划前执行 GitNexus impact analysis，覆盖 Runner、Session claim、SandboxProvider 和 Runtime 配置合同。
- [ ] 规划后执行 `plan-eng-review`，重点审查 push/direct 与 pull/connector 两类执行拓扑。
- [ ] 在实施前设计可回滚的数据迁移和既有 self-hosted Runner 兼容路径。
