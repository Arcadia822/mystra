# Quickstart：Host Runtime 纳管走查

**Feature**: `044-host-runtime-daemon` | **Phase**: 1
**目标读者**: operator（纳管一台机器）与 dev（验证实现）。
**前置**: 目标机器已装并已登录至少一个受支持 agent CLI（如 `copilot`/`codex`）；本 feature 不负责其安装/授权。

## A. Operator 走查（US1 + US2 + US3）

1. **准备 control-plane**
   ```sh
   pnpm dev:control-plane        # 起管理 API + Web
   ```
2. **在目标机器安装并启动 runner（TypeScript）**
   ```sh
   # 仓库内开发态
   pnpm --filter @mystra/runner dev -- --endpoint http://localhost:3000/api --name "$(hostname)"
   # 或未来打包态
   mystra-runner --endpoint https://mystra.local/api --name "$(hostname)"
   ```
   - 无 pairing / 无 token：配好 `--endpoint` 直接启动即注册。
3. **在管理面确认**：打开 Web 的 **Runtimes**，应看到该机器一行，`status=online`，可用 Provider 列出实际
   发现并确认可用者。
4. **验证发现≠可用**：若某受支持 CLI 装了但版本过低/无法执行，它出现在详情页但标注"不可用 + 原因"，
   且**不**计入可用集合。
5. **运行期热发现**：在目标机器新装一个受支持 CLI（无需重启 runner），等待一个重扫周期后刷新详情，
   该 Provider 出现在可用集合。
6. **覆盖路径**：
   ```sh
   MYSTRA_COPILOT_PATH=/opt/bin/copilot mystra-runner --endpoint ... # 指定路径生效
   MYSTRA_COPILOT_PATH=/nonexistent mystra-runner --endpoint ...     # 硬缺失，不回退
   ```
7. **心跳/离线**：停止 runner；超过 `staleAfterSeconds` 后管理面该 Runtime 变 `offline`（判定基于服务端
   接收心跳时间）。
8. **管理**：在详情页可**重命名**与**移除**该 Runtime。

## B. Dev 验证清单（映射 FR / SC）

| 步骤 | 覆盖 | 期望 |
| --- | --- | --- |
| 起 runner，`POST /api/runner/register` | FR-001/002/003、SC-001 | 持久化一行 Runtime；同 runner id 重启返回同一 `runtimeId` |
| PATH 扫描 + 登录 shell 兜底 | FR-011/014 | 仅存在于登录 shell PATH 的 CLI 也被发现 |
| 可用性确认 | FR-012、SC-002 | 版本过低/不可执行者 `available=false` + 原因，不入可用集合 |
| 周期重扫 + 变更上报 | FR-013/022、SC-003 | 新装 CLI 无需重启即出现（经变更上报，非每次心跳携带） |
| `MYSTRA_<P>_PATH` 覆盖 | FR-015 | 命中即用；缺失路径硬缺失不回退 |
| 存活心跳（内存判活·0 DB 写） | FR-020/021、SC-004 | 心跳仅带 `runnerId`、不带 Provider；服务端记内存 last-seen（不落库）；停 runner 超阈值 offline |
| 状态派生（读无写） | FR-002 | `GET /api/runtimes` 现算 status，不回写状态列 |
| 管理 API | FR-004 | list/get/rename 正常（无服务端 delete） |
| outbound-only | FR-005 | control-plane 无需 inbound 访问 runner |
| endpoint 抖动 | FR-006 | 断连时 runner 重试不崩溃，恢复后重新纳管 |
| 摄取路由无认证 | FR-023 | 已知风险，MVP 不校验（留待接入认证 feature） |
| TS 实现 | FR-031、SC-006 | 仅 `apps/runner-daemon`（TS），无 Go |

## C. 运行的测试

```sh
pnpm --filter @mystra/shared test           # Zod 契约（ProviderCapability 不变量、注册/心跳/状态）
pnpm --filter @mystra/runner test           # provider-discovery（PATH/登录 shell/覆盖/可用性/重扫）
pnpm --filter @mystra/control-plane test     # RdbProvider 契约（Runtime CRUD/心跳）+ /api/runtimes、/api/runner/* 路由
pnpm typecheck && pnpm lint
```

## 边界提醒

- 本走查**不含**发起任务、Context/worktree、Agent 配置、执行回放——均为后续 feature。
- 具体间隔/阈值/最低版本为 Deferred Decisions，实现前经 `/speckit.clarify` 定值。
