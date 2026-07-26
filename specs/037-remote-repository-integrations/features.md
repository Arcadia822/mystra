# 功能说明：远程仓库 Integration 与 Project 强绑定

## 摘要

Project 不再保存本地路径或任意 repository 字符串。操作员从 GitHub Integration 选择真实远程仓库，Mystra 保存经 RepoProvider 验证的仓库快照，并将它贯穿 Job、Runner 与 Review。

## 功能地图

- GitHub Integration：Repository list/get、Issue list/get。
- Linear Integration：Issue list/get。
- Project：强制绑定一个远程 Repository snapshot。
- API、CLI、Web UI：共享同一管理契约。
- Runner：消费冻结快照完成 clone、push 与 PR。

## 边界

- 不保留 local repository 或 job-level repo override。
- 不把 GitLab 注册为当前默认 Integration，但契约允许未来实现。
- 不新增 OAuth、webhook、Issue write-back、Integration 管理后台或 per-repository secret manager。
- 不使用任何现有仓库做 E2E。

## 分阶段能力图

1. 冻结共享 Repository 与 Provider contracts。
2. 接入 GitHub 与 Linear 插件能力。
3. 迁移 Project、Job、Runner、API、CLI 与 UI。
4. 创建全新 GitHub 测试仓库并完成真实执行与 Review。
