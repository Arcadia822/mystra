# 研究：薄 Task 生产状态机与 mystra-agent CLI

## Decision 1：execution code 在 Session claim 时签发

**Decision**: Runtime claim Harness Session 时生成至少 256-bit opaque code；同一事务把 SHA-256 hash 与 `expiresAt` 写入 SessionDispatchLease，claim response 只返回一次明文。

**Rationale**: Assign 时 Session 尚不存在；launch 时 Runtime 尚未拥有执行权。claim 是 Control Plane 已知准确 Session/Runtime ownership 且能安全把秘密交给 Runner 的第一个时点。复用 lease 也使过期、重 claim 轮换和执行结束后的失效有明确边界。

**Alternatives considered**:

- 长期 Agent API key：scope 过大，无法绑定 attempt/session，直接违反规格。
- JWT/HMAC capability：需要新增签名密钥生命周期；当前 opaque token + hash 已满足自用 MVP。
- 明文或可逆密文持久化：增加泄漏面和 SecretProvider 耦合，没有必要。
- 在 system prompt 传 code：会进入持久化 SessionEvent 与 Provider transcript，明确禁止。

**Primary-source check**: Node documents `crypto.randomBytes()` as cryptographically strong pseudorandom data and `createHash()` as the standard digest API: <https://nodejs.org/api/crypto.html>。

## Decision 2：Harness 是唯一 attempt identity，不拥有 lifecycle state

**Decision**: 每个 Task v1 至多一个 Harness。Harness 保存 frozen Agent snapshot、frozen Task input、runtime/provider selection、非外键 `plannedSessionId`/message ID、可空 actual Workspace/Session references 与 capability revocation time；没有 `status` 字段。

**Rationale**: Task 已拥有业务状态，Session 已拥有执行状态。Harness 只需把一次生产归因与异步步骤关联起来。`taskId @unique` 与 planned IDs 可以直接保证重复 Assign/ready continuation 不创建第二 attempt/Session，同时 nullable actual `sessionId` 避免在 Session 创建前形成非法 FK。

**Alternatives considered**:

- Harness 状态机：与 Task/Session 重叠，且 heartbeat/retry 尚不在范围。
- Task 直接保存 Agent/Session：无法表达 attempt-frozen input 和未来第二次 attempt，且把生产归因压回 Task projection。
- 允许多 Harness：v1 没有 reopen/retry policy，会制造无法解释的 active attempt 选择。

## Decision 3：Task 状态写入使用原子 projection + append-only transition

**Decision**: `TaskStatusService` 是唯一迁移入口。RDB command 在同一事务验证 actor allowlist、expectedRevision、note、idempotency payload，更新 Task projection 并追加 TaskStatusTransition。

**Rationale**: 通用 Task PATCH 允许编辑 requirement fields，不适合 workload capability。projection 保证快速读取，history 保证审计与幂等结果重放。唯一 `(taskId,idempotencyKey)` 让网络超时可安全重试。

**Alternatives considered**:

- 只存 Task current status：无法审计 actor、重建 projection 或返回原 transition。
- 只存 event/history 并动态折叠：Task 列表/导航读取成本和并发控制更复杂。
- 从 SessionEvent 推断：Agent 进程事实不是业务完成事实。

## Decision 4：冻结 Agent prompt 与 Task 输入

**Decision**: Assign/Start 时 Harness 保存 Agent ID/revision/system prompt 和 Task title/description；exact Issue reference 与 Project identity由 immutable Task context/Project reference解析并在 execution context 中返回。Harness Session launch 使用 frozen snapshot，不再次解析 active Agent 的当前 revision。

**Rationale**: Workspace preparation 是异步的。若期间 Agent prompt 或 Task requirement 被编辑，后续 Session 不应悄然改变已归因 attempt 的输入。只保存 revision 而不保存 prompt 无法在更新后恢复旧 revision 内容。

**Alternatives considered**:

- launch 时读取最新 Agent/Task：破坏冻结语义。
- 建立通用 AgentRevision 表：超出 051；Harness snapshot 已满足 attempt 需求。
- 冻结完整外部 Issue body：违反 provider-owned current information 边界。

## Decision 5：Workspace root 由 workload-local CLI 合成

**Decision**: workload context API 返回 Workspace logical identity、branch 与 repository context；`mystra-agent context get` 用实际 `process.cwd()` 填充输出中的 `workspace.root`，并校验 cwd 非空/可解析。

**Rationale**: Control Plane 持有 opaque `workspaceRef`，真实 host path 是 Runtime-private fact。Provider process 已以 ready Workspace directory 为 cwd，因此 CLI 是唯一既有能力知道准确路径又不需要扩大 Runner protocol 的组件。

**Alternatives considered**:

- 把 host path 持久化到 Workspace：打破 Runtime 抽象并泄漏主机事实。
- 由 Runner回写 path：增加无必要的 mutable truth 和跨 Runtime 语义。
- 不返回 root：不满足已接受的 TaskExecutionContext contract。

## Decision 6：`mystra-agent` 随 Runner 分发并由 Runner 注入 PATH

**Decision**: 新建 `packages/agent-cli`，以 `mystra-agent` bin 导出。`mystra-runner` 将其作为 production dependency，并在 Provider child environment 前置该 package 的 bin directory，同时注入 endpoint/code。

**Rationale**: workload CLI 是 Runtime 能力而非 Control Plane UI。与 Runner 一起安装可保证版本相容并避免要求用户单独全局安装；保留独立 package/binary 可维护 `mystra` 与 `mystra-agent` 的权限边界。

**Alternatives considered**:

- 扩展 root operator CLI：混合 Human 与 workload credential。
- 只提供 `pnpm` script：Agent prompt 无法稳定调用 bare `mystra-agent`。
- 下载临时 binary：引入网络、供应链和版本发现问题。

## Decision 7：Workspace ready 直接触发幂等 continuation

**Decision**: Workspace report route 在 `completeTaskWorkspacePreparation` 成功返回 ready 后调用 `TaskProductionService.continueReadyWorkspace`；Assign/Start 若发现 Workspace 已 ready 也调用同一方法。

**Rationale**: 当前 048 已有明确 ready report 边界，但没有通用事件总线。一个直接 application callback 是最薄实现；预分配 Session ID 与 RDB uniqueness 提供 at-least-once 安全。

**Alternatives considered**:

- 新增 event bus/subscription Harness：正是明确延期范围。
- polling cron：增加延迟、并发与新后台进程。
- Runner直接创建 Session：绕过 Human/Team application authorization 和 frozen Harness inputs。

## Decision 8：Agent 使用本地 linctl/gh，平台不做 fallback

**Decision**: 标准 bootstrap prompt 指示 Agent先用 `mystra-agent context get`，按 exact Issue reference 调用本地 `linctl`，在 cwd 修改/自测，再用本地 `gh` push/create PR，最后报告 status。

**Rationale**: 这是 owner 明确的自用 MVP deployment contract。Mystra execution capability 只授权 Mystra workload API；它不扩大为 Linear/GitHub credential broker。

**Alternatives considered**:

- Control Plane 代理 Linear/GitHub：扩大 secret、Integration 和审计范围。
- RepoDeliveryProvider fallback：会掩盖 host CLI 失败并改变用户旅程。
- Mystra 验证 PR/tests：平台当前没有此能力，且明确不在 051。

## Decision 9：Workspace completion 与 Session continuation 分段可恢复

**Decision**: `completeTaskWorkspacePreparation` 对同 preparation attempt + 同 report payload 重放返回既有结果；不同 attempt/payload 仍冲突。ready continuation 可重复调用，使用 Harness 预分配 IDs 收敛到同一 Session。

**Rationale**: Workspace completion 已提交而后续 launch 失败时，Runner 会重试 HTTP report。若 completion 一律把重复视为 stale，系统会永久失去自动 launch 触发点。幂等 completion 保留现有 attempt fencing，同时让跨两个短事务的故障可恢复。

**Alternatives considered**:

- 把 Workspace completion 与 Session launch 放进一个事务：跨越不同 application boundaries，并可能把外部/复杂读取带入事务。
- 新增 durable event bus/outbox：可靠但超出 thin Harness MVP。
- report 成功后吞掉 launch failure：造成无后续触发器的 silent failure。

**Primary-source check**: Prisma recommends short transactions and avoiding network/slow work inside interactive transactions, while naming idempotent operations and optimistic concurrency as appropriate read-modify-write techniques: <https://www.prisma.io/docs/orm/prisma-client/queries/transactions>。

## Decision 10：自用 MVP 的 CLI 分发是 Runner-bundled，不单独发布

**Decision**: `@mystra/agent-cli` 是 private workspace package；Runner production dependency包含其 executable wrapper，Runner从 package导出的 bin path prepend child PATH。root recursive build 与现有 deployment repo sync/pnpm install 同时交付两者。本期不发布 npm/GitHub Release 独立 artifact。

**Rationale**: 第一版用户是本机 Runner workload；独立跨平台下载渠道不会解锁当前 journey。显式 runner-bundled distribution 则避免“代码存在但 workload 找不到 command”。

**Alternatives considered**:

- npm/global package：增加版本矩阵与发布管线，当前没有外部消费者。
- 用户手工安装：不能保证 Runner child PATH 和版本一致。
- 把 CLI 内联进 runner source：权限边界与独立合同不清晰。
