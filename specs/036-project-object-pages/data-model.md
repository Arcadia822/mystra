# 数据模型

本功能不新增持久化模型，只消费现有 `projectSchema`。

## Project View

- identity: `id`、`name`、`slug`
- repository: `repo`、`baseBranch`
- execution default: `defaultAgent`
- lifecycle: `archivedAt`、`createdAt`、`updatedAt`
- configuration keys: `prewarmConfig`、`metadata`

## ProjectRuntimeConfig View

- `provider`
- `image`
- `contextBundleRefs`
  - `slug`
  - `required`
  - `accessMode`
- `mounts`
  - `kind`
  - `owner`
  - `target`
  - `sourceRef`
  - `readOnly`
- `exposedPorts`
  - `containerPort`
  - `hostBinding`
  - `name`
- `cache`
  - `coldStartAllowed`
  - `entries` (`kind`, `target`)
- `secretRefs`
  - `name`
  - `mode`
  - `target`
- `overridePolicy`
  - `allowImageOverride`
  - `allowContextBundleAdditions`
  - `allowedContextBundleSlugs`
- `metadata`

## State Rules

- active: `archivedAt === null`
- archived: `archivedAt !== null`
- list endpoint default excludes archived Projects
- detail endpoint can inspect a Project by slug

## Security Invariant

`secretRefs` 是引用 metadata。页面不得解析环境变量、文件或 secret provider，不得把任何
secret value 引入 response、日志或 DOM。
