# Provider Contracts

```ts
interface RepoProvider {
  readonly providerName: string;
  listRepositories(input: RepositoryListRequest): Promise<RepositoryListResponse>;
  getRepository(identifier: string): Promise<RepositorySnapshot | undefined>;
}

interface IssueProvider {
  readonly providerName: string;
  readonly repositoryScope: "required" | "optional" | "unsupported";
  listIssues(input: IssueListRequest): Promise<IssueListResponse>;
  getIssue(input: IssueGetRequest): Promise<Issue | undefined>;
}

interface IntegrationPlugin {
  readonly descriptor: IntegrationDescriptor;
  readonly capabilities: {
    readonly repositories?: RepoProvider;
    readonly issues?: IssueProvider;
  };
}
```

## Registry guarantees

- Integration name 唯一；重复注册在构造时失败。
- descriptor capabilities 必须与实际 capability 对齐。
- `requireRepoProvider` 与 `requireIssueProvider` 只处理 capability 解析和稳定错误。
- registry 不包含 `if provider === "github"` 之类分支。

## Runner boundary

```ts
interface RepoDeliveryProvider {
  readonly providerName: string;
  supports(repository: RepositorySnapshot): boolean;
  pushBranch(input: BranchDeliveryRequest): Promise<BranchDeliveryReceipt>;
  createReview(input: ReviewRequest): Promise<ReviewResult>;
}
```

Runner registry 按 `repository.provider` 精确选择，不通过 hostname 或本地路径猜测。
