# Object Surface Contract

| Object | Web | API | CLI | Operations |
|---|---|---|---|---|
| Control Plane | `/` | `GET /api/control-plane` | `control-plane inspect` | inspect, refresh |
| Runner | `/runners` | `GET /api/runners` | `runners list` | list, refresh |
| Runner | `/runners/:id` | `GET /api/runners/:id` | `runners inspect ID` | inspect, refresh, open assigned Task |
| Task | `/tasks` | `GET /api/jobs` | `tasks list` / `runs list` | list, filter, refresh |
| Task | `/tasks/:id` | `GET /api/jobs/:id` | `tasks inspect ID` | inspect, wait/refresh |
| Task | `/tasks/:id` | `POST /api/jobs/:id/cancel` | `tasks cancel ID` | cancel |
| Task | `/tasks/:id` | `GET /api/jobs/:id` | `tasks result ID` | terminal result |
| Task | `/tasks/:id` | `GET /api/jobs/:id` | `tasks failure ID` | terminal failure |

## Error Contract

新增 API 使用既有结构：

```json
{
  "error": {
    "code": "RUNNER_NOT_FOUND",
    "message": "Runner not found: <id>"
  }
}
```

## Compatibility

- `runs` 命令继续可用，内部归一化到 Task 操作。
- 现有 `/api/jobs` 路径不重命名。
- 页面不会从 CLI 文本反向解析数据；Web 和 CLI 都消费 JSON API。
