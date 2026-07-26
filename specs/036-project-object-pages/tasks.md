# Tasks: Project Object Pages

- [x] T001 Project 页面直接引用 shared Project type，删除本地重复 type
  - Acceptance: Project runtime、lifecycle 和 config 字段均由 canonical schema 推导
  - Verification: `pnpm typecheck`
  - Dependencies: none
- [x] T002 [US1] 增加 Projects 一级导航、route title 和 responsive list grid
  - Acceptance: `/projects` 导航可见且 active state 正确
  - Verification: browser keyboard + responsive check
  - Dependencies: T001
- [x] T003 [US1] 实现 `/projects` list 页面
  - Acceptance: loading/error/empty/data 状态完整，字段与 CLI list 同源
  - Verification: CLI/Web fixture comparison
  - Dependencies: T001, T002
- [x] T004 [US2] 实现 `/projects/:slug` detail 页面
  - Acceptance: identity、repo、runtime、context、mount、port、cache、policy 和 secret refs 可检查
  - Verification: CLI/Web fixture comparison + not-found browser check
  - Dependencies: T001, T002
- [x] T005 [US3] 从 Tasks 删除通用 Issue dispatch UI
  - Acceptance: 文件与 import/render 全部移除，空状态不再提 Linear/Issue 配置
  - Verification: source search + browser network
  - Dependencies: none
- [x] T006 运行 focused API/CLI tests 与全仓质量门
  - Acceptance: lint、typecheck、test、build 全通过
  - Verification: command output
  - Dependencies: T003, T004, T005
- [x] T007 完成真实浏览器和 CLI 同旅程验收
  - Acceptance: list/detail/tasks、console、network、keyboard、4 个 viewport 通过
  - Verification: browser evidence + CLI output
  - Dependencies: T006
- [x] T008 完成 GitNexus detect changes、五轴代码审查与 Spec-Kit closeout
  - Acceptance: 影响范围符合规格，无 Critical/Important finding
  - Verification: staged detect_changes + status/doctor
  - Dependencies: T007

## Checkpoint

- [x] 现有 Project API/CLI 无修改
- [x] Linear/GitHub Issue 无请求、无数据变更
- [x] 只 stage 本功能文件，保留所有无关工作区改动
