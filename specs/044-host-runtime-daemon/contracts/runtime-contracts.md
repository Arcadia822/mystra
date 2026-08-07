# Contracts：Runtime 注册、心跳、Provider 能力与管理 API

**Feature**: `044-host-runtime-daemon` | **Phase**: 1
**约定**: 全部用 TypeScript + Zod（Constitution II）。以下为契约形状与路由约定；正式实现落在
`packages/shared/src/schemas.ts` 与 `apps/control-plane/app/api/...`。传输 MVP 为纯 HTTP。

> 与 data-model 对齐：稳定模型是 **Runtime ↔ Provider（`runtime_providers` 关联边）**；host 提交 bookkeeping
> 收进 Runtime 的动态 `metadata`（host 形态 `{runnerId, platform?}`）；**存活心跳不持久**，只刷 control-plane
> 进程内存 `HostLivenessRegistry`，`status` 读时派生。

## 1. ProviderCapability（能力项 = 一条关联边的形状）

```ts
export const providerKeySchema = z.string().min(1); // 受支持 Provider 键：copilot | codex | claude | ...（注册表/枚举，复用 agentNameSchema）

// host 提交形式的来源；持久层 `runtime_providers.source` 未来可加 "sandbox-image"（e2b 镜像声明），非本契约职责
export const providerSourceSchema = z.enum(["path", "login-shell", "env-override"]);

export const providerUnavailableReasonSchema = z.enum([
  "not-found",
  "exec-failed",
  "version-below-threshold",
  "override-path-missing",
]);

export const providerCapabilitySchema = z
  .object({
    provider: providerKeySchema,
    discovered: z.boolean(),
    available: z.boolean(),
    source: providerSourceSchema,
    resolvedPath: z.string().nullable(),
    version: z.string().nullable(),
    unavailableReason: providerUnavailableReasonSchema.nullable(),
  })
  .strict()
  .superRefine((cap, ctx) => {
    if (cap.available && !cap.discovered) {
      ctx.addIssue({ code: "custom", message: "available 蕴含 discovered" });
    }
    if (!cap.discovered && cap.resolvedPath !== null) {
      ctx.addIssue({ code: "custom", message: "未发现则 resolvedPath 必为 null" });
    }
    if (!cap.available && cap.unavailableReason === null) {
      ctx.addIssue({ code: "custom", message: "不可用必须给出 unavailableReason" });
    }
  });
export type ProviderCapability = z.infer<typeof providerCapabilitySchema>;
```

## 2. host Runtime 注册（runner → control-plane · 提交形式 Runner）

`POST /api/runner/register`

```ts
export const hostRuntimeRegistrationSchema = z
  .object({
    runnerId: z.string().min(1),                       // 稳定 runner id（runner 本地持久化，落入 metadata·去重键）
    name: z.string().min(1),                           // 默认 hostname
    type: z.literal("host"),
    platform: z.string().min(1),                        // darwin/arm64 ...（落入 metadata）
    providers: z.array(providerCapabilitySchema).default([]), // 覆盖 runtime_providers 边集合
  })
  .strict();
export type HostRuntimeRegistration = z.infer<typeof hostRuntimeRegistrationSchema>;

// 响应
export const hostRuntimeRegistrationResponseSchema = z
  .object({ runtimeId: z.string().uuid() })
  .strict();
```

**约定**
- MVP 无 pairing / 无鉴权头；请求即被接受并 `registerHostRuntime(input)`：按 `metadata.runnerId` **幂等 upsert**
  一个 `type=host` Runtime（写 `metadata={runnerId,platform}`），用 `providers` 覆盖其 `runtime_providers` 边集合。
- 同 `runnerId` 重复注册返回同一 `runtimeId`（更新既有行）。**无 DB 唯一约束**——动态 `metadata` 无法方言中立地建
  JSON 路径唯一索引；同机多进程用同一 `runnerId` 并发上报，服务端**无需区分**、last-write-wins；单实例约束由 runner
  客户端负责（不进服务端契约）。
- 服务端**忽略**客户端声明的任何时间戳。注册同时 `HostLivenessRegistry.markSeen(runnerId, serverNow)`。

## 3. 存活心跳（runner → control-plane · 不持久）

`POST /api/runner/heartbeat`

```ts
export const hostHeartbeatSchema = z
  .object({
    runnerId: z.string().min(1),
  })
  .strict();
export type HostHeartbeat = z.infer<typeof hostHeartbeatSchema>;

// 响应
export const hostHeartbeatResponseSchema = z
  .object({ acknowledgedAt: z.string() }) // 服务端接收时间（ISO）
  .strict();
```

**约定**
- 心跳是**纯存活 ping**，**不**携带 Provider 集合（与集合上报解耦）。
- 心跳**不写库**：仅 `HostLivenessRegistry.markSeen(runnerId, serverNow)` 刷进程内存 last-seen（**0 次 DB 写**、不碰
  `metadata`/`updatedAt`）。判活用**服务端接收时刻**，客户端时钟不参与。
- `runnerId` 未知（进程重启后内存尚无该项，且无对应 Runtime）⇒ `404`，runner 应回退为重新 `register`。

## 3b. Provider 集合变更上报（runner → control-plane）

`POST /api/runner/providers`

```ts
export const hostProviderReportSchema = z
  .object({
    runnerId: z.string().min(1),
    providers: z.array(providerCapabilitySchema),
  })
  .strict();
export type HostProviderReport = z.infer<typeof hostProviderReportSchema>;
```

**约定**
- 在**注册时**与运行期集合**发生变化时**上报，而非每次心跳携带。
- `reportHostProviders(runnerId, providers)`：按 `metadata.runnerId` 定位 host Runtime，**覆盖**其 `runtime_providers`
  边集合（运行期新装/失效随之反映）；同时 `markSeen`。

## 4. Runtime 视图（control-plane → 管理面 / API 读取）

```ts
export const runtimeStatusSchema = z.enum(["online", "offline"]);

export const hostRuntimeMetadataSchema = z
  .object({ runnerId: z.string().min(1), platform: z.string().min(1).optional() })
  .strict();

export const runtimeViewSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    type: z.literal("host"),
    metadata: hostRuntimeMetadataSchema,          // host 稳定扩展：{runnerId, platform?}（无 lastHeartbeatAt）
    status: runtimeStatusSchema,                  // 读取时按 staleAfter 派生（非持久列）
    lastSeenAt: z.string().nullable(),            // 读取时取自内存 HostLivenessRegistry（非持久·进程重启即 null）
    providers: z.array(providerCapabilitySchema), // 取自 runtime_providers 边集合
    createdAt: z.string(),
    updatedAt: z.string(),                        // 仅注册/重命名/Provider 变更触发·心跳不 bump
  })
  .strict();
export type RuntimeView = z.infer<typeof runtimeViewSchema>;
```

## 5. 管理 API（control-plane，供 Web/其他调用方）

| 方法 & 路由 | 请求 | 响应 | 语义 |
| --- | --- | --- | --- |
| `GET /api/runtimes` | — | `{ runtimes: RuntimeView[] }` | 列表，`updatedAt desc, id`（纯读） |
| `GET /api/runtimes/{id}` | — | `RuntimeView` | 详情；`404` 不存在 |
| `PATCH /api/runtimes/{id}` | `{ name: string(min1) }` | `RuntimeView` | 重命名 |

> 无 `DELETE`（MVP 不做服务端移除）。

```ts
export const runtimeRenameSchema = z.object({ name: z.string().min(1) }).strict();
```

**约定**
- 读取路径用服务层 `resolveRuntimeStatus(lastSeenAt, now, staleAfterSeconds)` **现算** `status`，
  `lastSeenAt` 取自内存 `HostLivenessRegistry.getLastSeen(metadata.runnerId)`；**不**回写任何状态列（读操作零写副作用）。
- 管理 API 与 runner 摄取路由分离：`/api/runtimes/*` 面向管理，`/api/runner/*` 面向 runner 上报。

## 6. 存活态与 online/offline 判定（服务层，非路由）

```ts
// 进程内存·非持久·可替换 seam（未来 HA 换 sticky routing / 共享 TTL 租约实现，不动契约）
export interface HostLivenessRegistry {
  markSeen(runnerId: string, at: Date): void;   // register / heartbeat / providers 上报时刷新
  getLastSeen(runnerId: string): string | null; // ISO；进程重启即空
}

export function resolveRuntimeStatus(
  lastSeenAt: string | null,   // 来自 HostLivenessRegistry（非持久）
  now: Date,
  staleAfterSeconds: number,
): "online" | "offline" {
  if (!lastSeenAt) return "offline";
  return now.getTime() - Date.parse(lastSeenAt) <= staleAfterSeconds * 1000
    ? "online"
    : "offline";
}
```

- `staleAfterSeconds` 默认值待 `/speckit.clarify`（研究参考 multica ~3min offline / 15s heartbeat）。
- **禁止**把存活语义写进持久层，或泛化到未来非心跳型 Runtime（e2b 用可达/enabled，由 042 定义）。
- 进程重启后内存 last-seen 清空 ⇒ host 短暂 offline，下次心跳（≤心跳周期）自愈——与 HDFS/YARN 一致。

## 与既有 shared 契约的迁移

- 现 `runnerRegistrationSchema`（`capabilities`/`maxConcurrency`/`eligibleRuntimeProviders` 等）为
  docker/执行语义。本 feature **新增** host 语义的 `hostRuntimeRegistrationSchema`/`hostHeartbeatSchema`/
  `hostProviderReportSchema`；执行相关字段不在本 feature 复用。按 pre-0.1 政策，可直接替换过时契约的
  调用方（`apps/runner-daemon` 的 `register()`）而不留兼容别名。

## 契约测试要点

- `providerCapabilitySchema` 的四条不变量（available⇒discovered、未发现⇒path=null、不可用⇒有原因、
  override 缺失语义）。
- 注册 upsert 幂等：同 `runnerId` 两次注册返回同一 `runtimeId`（按 `metadata.runnerId` 去重·无 DB 唯一列）。
- 存活心跳不带 Provider；**心跳产生 0 次 DB 写**（仅内存 `markSeen`）；判活用服务端时间；客户端伪造时间被忽略。
- Provider 变更上报**覆盖**既有 `runtime_providers` 边集合。
- `resolveRuntimeStatus` 边界：`null`（含进程重启后）、恰好等于阈值、超过阈值。
- `GET /api/runtimes` 读路径**不产生写**（无 status 列回写、无心跳落库）。
