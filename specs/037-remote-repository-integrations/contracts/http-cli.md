# HTTP 与 CLI Contract

## HTTP

### Integration descriptors

- `GET /api/integrations`
- response：`{ integrations: IntegrationDescriptor[] }`

### Repository capability

- `GET /api/integrations/{integration}/repositories?limit=25&cursor=...`
- `GET /api/integrations/{integration}/repositories/resolve?identifier=owner%2Frepo`
- list response：`RepositoryListResponse`
- resolve response：`{ repository: RepositorySnapshot }`

### Issues

- `GET /api/integrations/{integration}/issues?limit=25&cursor=...&repository=owner%2Frepo`
- `GET /api/integrations/{integration}/issues/{identifier}?repository=owner%2Frepo`
- GitHub 缺少 `repository` 时返回 `INVALID_REQUEST`。
- Linear 不要求 `repository`。

### Projects

`POST /api/projects`

```json
{
  "name": "Fixture",
  "slug": "fixture",
  "repository": {
    "integration": "github",
    "identifier": "owner/repository"
  },
  "defaultAgent": "copilot",
  "runtime": {
    "provider": "docker",
    "image": "mystra-copilot:fixture"
  }
}
```

响应中的 `project.repository` 是完整 `RepositorySnapshot`。`PATCH` 使用相同 selector 语义。

## CLI

```text
integrations list
repositories list --integration github [--limit N] [--cursor TOKEN]
repositories get owner/repository --integration github
projects create --name NAME --slug SLUG \
  --repository-integration github --repository owner/repository \
  --agent copilot --runtime-image IMAGE
projects list
projects inspect SLUG
issues list --integration github --repository owner/repository
issues get 1 --integration github --repository owner/repository
issues list --integration linear
issues dispatch 1 --integration github --project SLUG --agent copilot --branch BRANCH
```

CLI 不读取 GitHub/Linear secret，不导入 Integration implementation，不写 SQLite。

## Stable errors

- `INTEGRATION_NOT_FOUND`
- `REPOSITORY_CAPABILITY_UNAVAILABLE`
- `ISSUE_CAPABILITY_UNAVAILABLE`
- `REPOSITORY_NOT_FOUND`
- `REPOSITORY_SCOPE_REQUIRED`
- `INTEGRATION_NOT_CONFIGURED`
- `INTEGRATION_UNAUTHORIZED`
- `INTEGRATION_RATE_LIMITED`
- `INTEGRATION_TIMEOUT`
- `INTEGRATION_UPSTREAM_ERROR`
- `INTEGRATION_INVALID_RESPONSE`
- `INVALID_PROJECT`
