# IssueProvider Contract

```ts
export interface IssueProvider {
  readonly providerName: string;
  listIssues(input: {
    first: number;
    after?: string;
  }): Promise<{
    items: Issue[];
    pageInfo: { hasNextPage: boolean; endCursor?: string };
  }>;
  getIssue(identifier: string): Promise<Issue | undefined>;
}

export interface Integration {
  readonly name: string;
  readonly provider: string;
  readonly capabilities: { issues?: IssueProvider };
}
```

## Invariants

- provider 响应是不可信输入，返回前必须经过共享 Zod schema。
- `listIssues` 不返回 partial data；GraphQL `errors` 存在即失败。
- `getIssue` 仅在远端明确无匹配时返回 `undefined`。
- IssueProvider 不创建 Job、不读 SQLite、不启动 runner。
- API key 不出现在对象序列化、错误 message 或日志。

## Stable error codes

- `INTEGRATION_NOT_FOUND`
- `ISSUE_CAPABILITY_UNAVAILABLE`
- `ISSUE_NOT_FOUND`
- `INTEGRATION_NOT_CONFIGURED`
- `INTEGRATION_UNAUTHORIZED`
- `INTEGRATION_RATE_LIMITED`
- `INTEGRATION_TIMEOUT`
- `INTEGRATION_UPSTREAM_ERROR`
- `INTEGRATION_INVALID_RESPONSE`
