# 043 Identity, Team 与 RBAC

本目录定义 Mystra 的 Human identity、Team tenancy、Role/RBAC、Control-plane Agent identity 与 Sandbox workload identity。

## 当前阶段

- Specify：已生成，等待 Owner 评审。
- Plan：尚未开始。
- Implementation：受 040 Prisma RDB 落地、041 最终 schema 冻结和 5xP boundary amendment 阻塞。

## 分支例外

Owner 明确要求在当前 `041-github-integration-connections` branch 创建 043 artifacts，没有创建 `043-*` branch。后续 Spec-Kit 命令必须显式指定 feature：

```sh
export SPECIFY_FEATURE=043-identity-team-rbac
```

不得仅从当前 branch name 推断 feature，否则命令会错误选择 041。

## 评审入口

- [规格](spec.md)
- [功能摘要](features.md)
- [Owner 评审清单](checklists.md)
- [Requirements quality checklist](checklists/requirements.md)
- [原型说明](prototype.md)
- [独立低保真原型](mockups/index.html)
- [Spec View](index.html)

`index.html` 已通过 renderer 生成。Codex 应用内浏览器的 URL policy 会阻止 `file://`，因此本轮没有声称完成浏览器 review；可使用允许访问本地文件的外部浏览器打开上述 HTML。
