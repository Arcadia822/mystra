# 合同：Post-install Bootstrap

**范围**：043 只**消费**外部 installer 在部署完成后产出的初始状态；不实现 installer、seed 命令或首次部署 orchestration（FR-002）。应用运行时**不得**因空库自建 `admin/admin`（FR-004，research R8）。

## Installer 必须产出的 post-install 状态

| 事实 | 值 / 约束 |
|---|---|
| 默认 User | `username = "admin"`（规范化后），`require_password_change = true`，`status = active` |
| 默认凭据 | 初始 password `admin` 的自适应 hash 存于 `auth_accounts`（providerId=`credential`）；不落明文 |
| 初始 Team | 一个 Team，`display_name` 由 bootstrap 指定（例如 `Default`），`status=active` |
| Membership | admin 在该 Team `role=owner`、`status=active` |

以上状态 MUST 与注册相同、以单事务写入，保证 admin 一登录即拥有其初始 Team 与 Owner 权限。

## 应用启动校验（fail closed）

启动时执行只读检查：
1. 身份 schema 已就绪但**不存在任何有效 User** → fail closed，报告 `installation-incomplete`，不进入正常 shell，不创建默认 admin。
2. 存在 User → 正常提供登录页。

不得在空库时静默创建或重建 `admin/admin`（FR-004）。

## 强制改密（FR-003）

`admin` 首次以 `admin/admin` 成功认证后，`require_password_change=true` 使其只能进入改密流程（见 auth-api 强制改密门）；改密完成前不得访问 Team 资源。

## Secret 卫生

初始 password、session token 与任何 bootstrap secret 不得进入 URL、日志、公共响应或验收证据（边界）。

## 开发环境便利（非应用运行时自建）

本地开发提供**文档化的**手动/脚本 bootstrap（如一次性 CLI/SQL 脚本，独立于应用启动路径）以产出上述状态；它模拟 installer，不是应用运行时行为，因此不违反 FR-004。具体命令在 quickstart 记录。
