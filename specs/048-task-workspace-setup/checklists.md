# 评审清单：Task Workspace Setup

## Owner 评审

- [x] 确认无 Issue Task 的确定性 branch fallback。
- [x] 确认所有 Task Session 共享同一个可变目录。
- [x] 确认 feature 顺序调整为 048、049、050。
- [x] 确认 Default branch 是普通 Project repository 配置；RepoProvider 不扩展 branch API，标准 Git reader 负责 branch 读取与 exact commit 解析。
- [x] 确认 branch 读取失败时设置可退化为文本配置，但 Setup 对不存在 branch 仍 fail closed。
- [x] Owner 以“推进 048，直到完成开发”授权按当前规格实施；ready/unavailable Workspace 的自动迁移、重建和删除继续排除在 MVP 外。

## Spec 就绪度

- [x] Task `1 : 0..1` Workspace 关系已定义。
- [x] Project 配置、Integration RepoProvider、标准 Git reader、Issue 与 Runtime 职责已分离。
- [x] 当前 048/049/050 只支持 Task-bound Session；Project-only 与 standalone Session 整体延后，未来必须复用同一 Workspace/attachment contract。
- [x] 幂等、失败、Runtime 亲和性与 secret 边界已定义。
- [x] 技术计划完成 standard Git interface、持久化和 runner protocol 设计。
- [x] 工程评审完成并回写风险处置。

## 后续插件检查

- [x] 使用 plan engineering review 检查现有 044/047/049/050 合同冲突，并按 owner correction 收敛为 task-only consumer contract。
- [x] 使用 GitNexus impact 检查 RepoProvider，确认 MEDIUM blast radius 并保持接口不变；IssueProvider、RdbProvider 与 Session launch 在实现前复核。
- [x] 在真实 control-plane 页面完成 Project branch 与 Task Workspace UI browser verification。
