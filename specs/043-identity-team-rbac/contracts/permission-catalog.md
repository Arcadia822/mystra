# 合同：Permission catalog 与 Role 矩阵

**落地形式**：代码级稳定目录（research R3），不建数据库表。定义在 `apps/control-plane/src/lib/rbac`，通过 `@mystra/shared` 暴露稳定 machine-readable 字符串。API、MCP、CLI、Web 使用相同语义（FR-033）。

## Permission catalog（首期，kebab/dot 稳定 key，可扩展）

| Permission key | 含义 |
|---|---|
| `team.settings.manage` | 修改 Team 设置与 display name |
| `team.member.manage` | 添加/移除/停用成员、设置非 Owner 角色 |
| `team.role.manage` | 管理成员角色（含 Owner 授予/移除，仅 Owner 有效） |
| `team.delete` | 归档删除普通 Team |
| `team.resource.access` | 访问普通 Team 资源（成员基线） |

Permission 是稳定目录；缺失某 key 不等于 disabled，而是未授予。未来新增 permission key 不需要数据库 migration。

## 内建 Role → Permission 静态矩阵（FR-032）

| Permission \ Role | owner | admin | member |
|---|:--:|:--:|:--:|
| `team.resource.access` | ✓ | ✓ | ✓ |
| `team.member.manage` | ✓ | ✓（不含 Owner 操作，FR-031） | ✗ |
| `team.settings.manage` | ✓ | ✗ | ✗ |
| `team.role.manage` | ✓ | ✗ | ✗ |
| `team.delete` | ✓ | ✗ | ✗ |

约束：
- 内建 3 角色不可删除；首期不提供自定义 Role 或 Project-scoped Role（FR-032，Extension-ready only）。
- `team.role.manage` 中“授予/移除/修改 Owner”只对 Owner 生效；Admin 持有的成员管理能力被限定在非 Owner 目标（FR-031）。
- 服务端每请求解析 effective permission = role→matrix，结合 last-owner / last-active-team 不变量做最终判定。

## 一致性验证（SC-008）

同一 (User, Team, Role, 目标资源) 输入下，API/MCP/CLI/Web 的 allow/deny 结果必须一致；跨 Team 与已撤销 membership 用例 100% fail closed。contract 测试以此矩阵为 golden。

## 扩展 seam

未来自定义 Role / Project-scoped Role / AgentPrincipal 时，将本矩阵提升为 `permissions`/`roles`/`role_bindings` 表并保留同一 permission key 语义（research R3；FR-048 仅结构预留，不在 043 实现）。
