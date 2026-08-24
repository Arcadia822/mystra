---
title: "Prototype：Control Plane Skill 库"
taco_scope: spec
---

## 入口

- 运行：`pnpm dev:prototype`
- Route：<http://localhost:3010/056-skill-library>
- 通用起点：<http://localhost:3010/starter>
- Feature composition：`apps/spec-prototype/app/_components/skill-library-prototype.tsx`
- Review fixtures：`apps/spec-prototype/app/_components/skill-library-model.ts`
- 可复用 shell：`apps/spec-prototype/app/_components/prototype-shell.tsx`

## UX Intent

- **Experience problem**：Team 需要在内容进入 Agent/Session/Runtime 交付合同之前，先有一个可审阅、可追溯、不会执行上传代码的 Skill 内容库。
- **Intent**：把“当前 Skill”与“不可变 Revision”同时讲清。默认路径快速展示当前 Revision，但文件预览、摘要和下载始终标明确切 Revision。
- **Affected surfaces**：Team Skill 列表、Skill 详情、Revision selector、文件树、安全文本 preview、原始 ZIP download、上传/发布与 archive 确认。Prototype 不模拟 API、S3 或真实 ZIP 解析。
- **Navigation**：入口不进入 MVP primary menu。Prototype 使用 `Team / Skills` breadcrumb，表达它属于 Team 管理上下文；生产信息架构可从 Team 管理表面或稳定直达路由进入。
- **Reuse**：页面直接使用 `PrototypeShell`，并从生产与 prototype 共同依赖的 `@mystra/ui` 导入 surface、action、field、dialog 和 icon primitives。Feature 文件只拥有 mock data、状态和布局 CSS，没有复制生产 SVG、theme 或 popup anatomy。
- **Responsive and accessibility**：列表、Revision selector、文件树均使用可聚焦原生 controls；当前操作通过 `aria-live` 通知；预览能力以文本说明，不依赖颜色。宽屏使用 library/detail 两栏，窄屏纵向堆叠。

## 覆盖状态与交互

- Active Skill 默认列表，以及显式 `Include archived` 切换。
- Skill 名称/描述过滤；选择 Skill 后固定到其当前 Revision 与 `SKILL.md`。
- Revision 3/2 切换时，文件树、摘要、发布时间、ZIP 大小和预览一起切换。
- 允许的 UTF-8 文本显示只读 source preview；PNG fixture 只显示 metadata 和稳定不可预览说明。
- `Download ZIP` 明确下载当前选中的原始 Revision，而不是动态重打包。
- `New revision` 打开 ZIP-only 发布 dialog；archive fixture 禁用更新与 archive 重复动作。
- 上传 dialog 说明 20 MiB compressed、100 MiB expanded、全 entry 校验、内存 lazy-entry 和不执行脚本。
- Archive action 在 prototype 中只展示确认语义：保留全部 Revision 与 ZIP。

## Mock 与边界

- 所有 Skill、Revision 与文件均为 fixture；不调用 Mystra API，不读取真实 ZIP，不访问 S3-compatible provider，不写数据库。
- Prototype 不验证 ZIP path normalization、CRC、zip bomb 或 publication failure；这些由 contracts、安全测试和 provider integration tests 负责。
- Prototype 不包含 Agent/Session/Runtime Skill picker、安装按钮、执行状态或交付证据。
- Prototype 不证明 production routes、RBAC、object checksum 或 publication transaction 已实现。

## 验证

- Source contract test 确认 composition 复用 shared shell/UI primitives，未内联 SVG，并保留 Revision identity、安全上传和 preview boundary 文案。
- `@mystra/spec-prototype` test、typecheck 与 build 验证 route 可编译。
- 浏览器验收覆盖：搜索、include archived、Skill/Revision/file 选择、二进制 no-preview、上传 dialog keyboard close，以及 320/768/1024/1440px 宽度。
