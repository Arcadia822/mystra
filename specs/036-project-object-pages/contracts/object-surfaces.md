# Project Object Surface Contract

| Object | Web | API | CLI | Operations |
|---|---|---|---|---|
| Project | `/projects` | `GET /api/projects` | `projects list` | list, refresh |
| Project | `/projects/:slug` | `GET /api/projects/:slug` | `projects inspect SLUG` | inspect, refresh |
| Task | `/tasks` | `GET /api/jobs` | `tasks list` | list, filter, refresh |

## Project Field Parity

| Field group | API | CLI list | CLI inspect | Web list | Web detail |
|---|---:|---:|---:|---:|---:|
| id/name/slug | yes | yes | yes | yes | yes |
| repo/base branch | yes | repo | yes | repo | yes |
| default agent | yes | yes | yes | yes | yes |
| runtime provider/image | yes | provider | yes | yes | yes |
| context/mounts/ports/cache | yes | no | summary | no | yes |
| override policy | yes | no | summary | no | yes |
| secret reference metadata | yes | no | no | no | yes |
| secret value | no | no | no | no | no |

## Deferred Surface Contract

- 不提供 `/issues`。
- `/tasks` 不发起 `/api/integrations/*/issues` 请求。
- Linear/GitHub Issue 页面由未来 provider-specific Integration 规格分别定义。
- 删除 Web 面板不删除现有 Issue API、CLI 或持久化 snapshot。

## Error Contract

复用现有 API 结构：

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found: <slug>"
  }
}
```
