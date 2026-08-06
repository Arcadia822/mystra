# 041 GitHub Integration Connections

本目录描述 GitHub Integration Detail、部署感知的多连接、Hosted GitHub App、self-hosted PAT 以及 Project 精确连接绑定。

- [规格](spec.md)
- [功能摘要](features.md)
- [评审清单](checklists.md)
- [交互原型](prototype.md)

本功能基于 039 已落地的 GitHub App onboarding，并明确取代其中“单 active connection、无 PAT fallback”的限制。PAT 仍不是 fallback；它是一条需要操作者显式创建、验证和绑定的 IntegrationConnection。Mystra GitHub App 是 hosted-only capability；self-hosted 默认不支持 App，但开源代码、adapter 和测试可以保留。

当前 041 实现已经覆盖多连接、PAT、Add Project 收窄配置，以及 stock OSS 的
PAT-only method projection、App route fail-closed 和默认 credential resolver
拦截。Hosted actor/Team OAuth transaction 与 Cloud composition 仍属于 private
distribution 后续实现范围。现有早期任务仍保留历史上下文；Phase 8 记录本次
OSS enforcement 切片。

Hosted build ownership 已确定为独立 private distribution project；开源与
Cloud 的代码、构建和版本边界见
[`decision-cloud-distribution.md`](decision-cloud-distribution.md)。

Add Project 只负责连接、仓库、名称和 slug。Agent 与开发镜像不属于仓库接入决策，由控制面从 `MYSTRA_DEFAULT_AGENT` 和 `MYSTRA_DEFAULT_DEV_IMAGE` 解析并固化；未配置时分别使用 `copilot` 与 `mystra-runner:local`。
