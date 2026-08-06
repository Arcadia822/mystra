# Architecture Decision: Private Mystra Cloud Distribution

**Status**: Accepted
**Date**: 2026-08-06
**Feature**: 041 GitHub Integration Connections

## Context

Mystra 的开源发行版需要是完整、可维护的 self-hosted 产品，但平台运营的
GitHub App、Hosted caller/Team authorization、managed secrets 和云端部署配置
不属于 self-hosted 支持面。GitHub App 的领域协议、provider seam 与测试留在
开源仓库，可以避免 Cloud 形成一份长期漂移的 GitHub 实现。

仅使用一个公开的运行时环境变量切换 `self-hosted` / `hosted` 会混淆产品形态、
资源健康和授权边界。把 Cloud 代码维护成 Mystra 的长期 fork 则会制造另一种更
昂贵的混乱。

## Decision

建立独立 private 构建项目（工作名 `mystra-cloud`）作为 Hosted distribution
owner。它消费一个固定版本的 Mystra OSS source/package contract，提供 Cloud
composition root，并构建、签名和发布最终 Hosted image。

Mystra OSS 仓库继续拥有：

- `DeploymentServices` / `DeploymentCapabilityProvider` 等 typed contracts。
- stock `createSelfHostedDeploymentServices()` composition root。
- GitHub App protocol、OAuth/installation domain service、public route contracts。
- self-hosted fail-closed guards，以及可注入的 fake hosted test kit。
- Project、Integration、Runner 等与部署无关的业务合同。

Private Cloud 构建项目拥有：

- `createHostedDeploymentServices(...)` composition root。
- Hosted caller authentication 与 Team authorization adapters。
- durable OAuth transaction store 和 hosted RdbProvider assembly。
- managed SecretProvider/KMS adapter 与 GitHub App identity binding。
- Cloud policy、deployment manifests、image build、SBOM/provenance、release pipeline。
- GitHub App registration identifiers 与 secret-manager resource mapping；不保存秘密值。

## Build Contract

1. Cloud project pins an immutable Mystra OSS release or commit；it never builds
   against a floating branch。
2. OSS exposes a versioned deployment interface with `deploymentApiVersion`。
3. Cloud composition declares the same version；mismatch fails the build before
   an image is produced。
4. Cloud build injects the private Hosted composition root at build/package
   assembly time，not through a user-facing runtime mode variable。
5. The final image records both OSS revision and Cloud distribution revision for
   rollback、incident analysis and reproducible builds。
6. Runtime secrets are mounted by the deployment platform from KMS/secret
   manager；they are never baked into the image or stored in either repository。

The exact packaging mechanism may be a versioned package or build-time module
alias，but it MUST use the typed deployment contract and MUST NOT patch、copy or
overwrite OSS source files during every build。

## Support Boundary

The stock OSS artifact always assembles self-hosted services and reports GitHub
App as `HOSTED_ONLY`。The private Cloud artifact may expose GitHub App only when
all hosted prerequisites are healthy。

This is not copy protection。An open-source operator can fork Mystra and supply
another composition root；that result is a custom distribution，not the supported
self-hosted product and not Mystra Cloud。

## Alternatives Rejected

### Public `MYSTRA_DEPLOYMENT_PROFILE=hosted`

Rejected because one mutable runtime string would conflate distribution identity
with capability authorization and prerequisite health。

### Keep all Cloud build and infrastructure code in OSS

Rejected because platform account topology、managed secret bindings、deployment
policy and release controls are Cloud operational assets rather than reusable
self-hosted capabilities。

### Maintain a private fork of Mystra

Rejected because every upstream change would require source-level reconciliation，
and security fixes could silently diverge between OSS and Cloud。

### Remove GitHub App code from OSS

Rejected because the provider/domain implementation is reusable、testable product
logic。Only its Hosted composition and operational bindings need to be private。

## Consequences

- OSS exposes a fail-closed self-hosted capability seam；stock availability no
  longer derives from `readGitHubAppConfig()`。The private Cloud project must
  supply the compatible Hosted composition rather than re-enable App through
  environment presence。
- Cloud releases carry two compatible revisions and require a compatibility gate。
- Hosted adapters can evolve privately without leaking vendor-specific KMS、auth
  or infrastructure types into shared Mystra contracts。
- Self-hosted tests must prove App variables cannot activate the Hosted method；
  Cloud contract tests must prove an incomplete Hosted service bundle fails closed。
