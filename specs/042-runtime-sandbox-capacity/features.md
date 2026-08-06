# 功能说明：Runtime Sandbox 能力提供方

## 摘要

Runtime 是能够为 Agent Session 提供 Sandbox 的执行后端。它可以是安装 Mystra Runner 的主机、Kubernetes，或未来通过 API 接入的 Sandbox 云服务。Runner 只是部分 Runtime 使用的可选连接组件，不是所有 Runtime 的共同前提。

本功能当前只记录领域边界。现有 `runners` 表、Runner 协议、Session 分配和执行行为保持不变。

## 功能地图

- Runtime：提供 Sandbox 能力的业务实体。
- Runtime Connection：Mystra 与 Runtime 建立控制通道的方式，可以是 Runner/connector，也可以是 direct API。
- Runner：connector 模式下负责认证、心跳、容量上报和 Session 领取的可选组件。
- Sandbox Spec：描述镜像、挂载、ContextBundle、Secret、端口和资源要求。
- Sandbox Instance：Runtime 为某个 Session 实际创建的隔离环境。
- Session Runtime Selection：记录 Session 实际使用的 Runtime 和最终 Sandbox 规格。

## 边界

- Runtime 不等于 Runner、单台主机、容器镜像或 Sandbox 实例。
- 无需 Runner 的 Kubernetes 或云 Sandbox 不得被迫伪造 Runner 心跳。
- 当前代码中的 `runtime` 配置未来可能需要改称 Sandbox Spec，但本规格不授权重命名。
- 本规格不包含数据库迁移、管理 API、UI、Provider Adapter、安装流程或实现任务。
- PG/Supabase、Task Activity、Agent 消息历史和 Artifact 重设计不属于本功能。

## 分阶段能力图

1. 当前阶段：只记录 Runtime、Runner、连接方式和 Sandbox 的领域边界。
2. 未来澄清：确定 Runtime 所有权、连接模式、健康、容量、调度和持久化边界。
3. 未来规划：设计迁移、Provider 合同、Session 选择与 Sandbox Instance 生命周期。
4. 未来实现：在独立授权和工程评审后增加自托管、Kubernetes 或云 Sandbox Runtime。
