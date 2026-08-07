# 043 本地用户、Team 与 RBAC

本目录定义开源 Mystra 的 username/password Human User、每 User 注册时自动获得一个初始 Team、Team lifecycle 与 Owner/Admin/Member RBAC。外部安装流程未来提供 `admin/admin` + 初始 Team bootstrap state；043 不实现安装器。self-host 不引入 email，Agent authentication 与强认证因子不属于本期实现。

## 当前阶段

- Specify：已生成，等待 Owner 评审。
- Plan：已生成（research/data-model/contracts/quickstart），等待 Owner 评审。
- Implementation：041 已落地；等待 040 Prisma RDB 合入和 5xP boundary amendment。

## 分支选择

Owner 明确要求在当前 branch 更新 043 artifacts，没有创建或切换 `043-*` branch。当前 branch 为 `main`。后续 Spec-Kit 命令必须显式指定 feature：

```sh
export SPECIFY_FEATURE=043-identity-team-rbac
```

不得仅从 `main` 推断 feature。

## 评审入口

- [规格](spec.md)
- [功能摘要](features.md)
- [Owner 评审清单](checklists.md)
- [Requirements quality checklist](checklists/requirements.md)
- [原型说明](prototype.md)
- [独立低保真原型](mockups/index.html)
- [Spec View](index.html)

`index.html` 由仓库 renderer 生成。当前交付是静态规格和低保真原型，不声称提供运行时认证、持久化或浏览器验收证据。
