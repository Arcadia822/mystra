# Research: Issue 驱动的 Agent 自主执行

## Decision 1: Linear 使用原生 GraphQL HTTP + Zod

**Decision**: 使用 `fetch("https://api.linear.app/graphql")`，personal API key 通过
`Authorization: <API_KEY>` 传递；list/get query 的响应在 integration 边界用 Zod
校验。任何非 2xx、GraphQL `errors`、partial data 或无效 required field都失败。

**Rationale**: 第一版只有两个只读 query。原生 HTTP 依赖面更小，同时落实 Linear
官方要求：GraphQL 即使 HTTP 200 也可能返回 `errors`，不能只检查状态码。

**Alternatives considered**:

- `@linear/sdk`: 类型便利，但为两个 query 增加 SDK 对象模型，不改善运行时校验。
- OAuth: 适合多用户应用，但今晚是 owner 本机 personal key，明确不在范围。

**Official sources**:

- https://linear.app/developers/graphql
- https://linear.app/developers/pagination

## Decision 2: Integration 是 capability registry，不是新服务

**Decision**: control-plane 进程内注册 `Integration`，其 capability 集合可包含
`issues: IssueProvider`。MVP 只注册名为 `linear` 的 integration。

**Rationale**: capability 模型保留未来扩展空间，但当前 list/get 无需 RPC、数据库
表、管理页面或独立 daemon。IssueProvider 不负责 Job persistence，避免外部系统
模型支配执行核心。

**Alternatives considered**:

- 独立 integration microservice: 单机 MVP 增加部署和故障边界，没有用户收益。
- route 直接 import Linear 函数: 文件更少，但失去明确 capability seam。

## Decision 3: API canonical，CLI 只做请求与展示

**Decision**: 使用 Next.js App Router Route Handlers 实现 canonical API。CLI 不
导入 domain service、Linear adapter 或 SQLite，只构造 URL/body、发 HTTP、验证
响应并格式化。

**Rationale**: 现有 `operator-cli.mjs` 已采用同一模式。Route Handlers 是 Next.js
16 App Router 的正式 HTTP surface，支持本功能需要的 GET/POST。

**Alternatives considered**:

- CLI 直接调用 integration package: 会复制配置、错误和 dispatch 事务语义。
- GraphQL control-plane API: 现有管理 API 是 REST，新增第二套协议无收益。

**Official source**:

- https://nextjs.org/docs/app/getting-started/route-handlers

## Decision 4: list 用 cursor，CLI 暴露 limit/cursor

**Decision**: API list 接受 `limit` 1..100（默认 25）和可选 `cursor`，返回
`items` 与 `pageInfo`。Linear `after` cursor 作为 opaque value 传递。

**Rationale**: Linear 官方 API 使用 cursor pagination。opaque cursor 避免 CLI 或
domain contract 依赖 Linear 内部编码。

**Alternatives considered**:

- 拉取所有 Issues: 数据量和限流不可控。
- 页码 pagination: 需要维护虚假的页码映射。

## Decision 5: dispatch 时 refetch 并冻结 IssueSnapshot

**Decision**: dispatch 接收 project、agent、branch 和可选 review/runtime 字段。
服务端重新 get 精确 Issue，生成 prompt 与 IssueSnapshot，并在一次 `createJob`
调用中持久化。

**Rationale**: list 结果可能过期或被调用方篡改。dispatch-time refetch 保证 provider
失败时不产生半成品 Job。

**Alternatives considered**:

- 客户端提交完整 Issue: 可伪造且产生两个内容真相。
- 只保存 identifier: 后续远端修改会改变历史 Run 的含义。

## Decision 6: runner 使用显式固定 pipeline

**Decision**: `executeDockerJob` 明确依次执行 clone、agent、quality、preview、
push、review。每个阶段发通用 execution event，输出使用 execution-step 命名。

**Rationale**: 这些阶段是当前产品成功定义，不是用户可配置图。显式代码比把
blueprint 改名为 pipeline config 更符合“Agent 自主、平台负责边界”的新定位。

**Alternatives considered**:

- 保留 `apps/workflows`，只隐藏 UI: 违反活动合同清零验收。
- 新增 generic DAG engine: 重建用户要求移除的编排底座。
- 把 test/build/push/preview 全交给 Agent: 失去平台可验证 review gate。

## Decision 7: Copilot 使用真正的有界 autopilot

**Decision**: 命令使用 `copilot --autopilot --allow-all
--max-autopilot-continues 10 --prompt ...`，运行时记录 CLI version、mode 和 cap。
`--no-ask-user` 不能替代 autopilot。

**Rationale**: GitHub 官方文档明确区分 `--no-ask-user` 和 autopilot，前者不会让
Agent 连续自主完成多步任务；官方建议 programmatic 场景设置 continuation cap。

**Alternatives considered**:

- 现有 `--no-ask-user`: 只抑制问题，不提供连续自主执行。
- 无限 autopilot: 对本机时间、费用和失败循环没有边界。

**Official sources**:

- https://docs.github.com/en/copilot/concepts/agents/copilot-cli/autopilot
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference

## Decision 8: generic runner image 归仓库并固定版本

**Decision**: 新增 `runner-images/copilot/Dockerfile`，固定 Node 和 Copilot CLI
版本，构建脚本默认使用该 context/tag。image build 不接收 secret；secret 只在
`docker run/exec` 运行时注入。

**Rationale**: 当前构建脚本指向不在仓库内的 Castrel image，不可复现且越界。
Docker 官方说明 build args/env 不适合 secret，因为可能进入 metadata/history。

**Alternatives considered**:

- 继续 `/tmp/mystra-castrel-runner-image`: 不可审查、不可复制、产品边界错误。
- 在 image 中 bake token/auth files: 明文泄漏风险。

**Official sources**:

- https://docs.docker.com/build/building/secrets/
- https://docs.docker.com/reference/dockerfile

## Decision 9: preview 是受验证的保留 sandbox 能力

**Decision**: publish project-declared port；preview 启动后，host 对 resolved URL
连续探测两次，只有两次均为 2xx/3xx 才允许 Review handoff。
`waiting_for_review` 保留 container，但释放 runner active capacity。

**Rationale**: Docker 默认不暴露未 publish 的端口；字符串 URL 不等于可访问。
保留 container 是 Reviewer 现场，不表示 runner 仍在执行机器工作。

**Alternatives considered**:

- 只检查 container 内 curl: 无法证明宿主机 Reviewer 可访问。
- Run 保持 `running`: 永久占用 runner capacity，状态语义错误。

**Official sources**:

- https://docs.docker.com/engine/network/port-publishing/
- https://docs.docker.com/engine/containers/run/

## Decision 10: GitHub PR create-or-reuse

**Decision**: push 后查询相同 repository/head/base 的 open PR；存在则复用，否则
调用 REST `POST /repos/{owner}/{repo}/pulls`。403、422、5xx 为结构化错误。

**Rationale**: operator retry 或 PR 创建响应丢失后重试不能制造重复 PR。GitHub
官方创建接口要求 title/head/base，并可能返回 403/422。

**Alternatives considered**:

- 每次直接 POST: retry 会重复或收到含糊 422。
- 任何同 branch PR 都复用: base 不同可能指向错误 review。

**Official source**:

- https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request

## Decision 11: 状态名统一为 `waiting_for_review`

**Decision**: 删除 `needs_human_review`，shared state/result/event/CLI/DB 全部使用
`waiting_for_review`。这是机器执行终态。

**Rationale**: 用户验收明确要求该名称。双别名会让 canonical API 和 CLI 重新拥有
两套语义。

**Alternatives considered**:

- 旧名只在 CLI 显示新名: API 与持久状态漂移。
- 同时接受两个枚举: 无必要，owner 已授权删除历史数据。

## Decision 12: 不做旧 workflow 数据迁移

**Decision**: 精确清空本功能使用的开发 SQLite 数据库，以新 schema 初始化。删除
legacy workflow event parser、snapshot projection、旧状态 alias 和数据 backfill。

**Rationale**: owner 明确授权移除全部历史数据。兼容层只会让已判废的 abstraction
继续约束活动合同。

**Alternatives considered**:

- 双读/回填: 增加测试矩阵和永久认知成本，没有数据保留需求。
- 保留旧 event schema 只读: 仍违反活动 shared contract 精确清零。
