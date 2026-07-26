import type {
  IntegrationDescriptor,
  Issue,
  IssueGetRequest,
  IssueListRequest,
  IssueListResponse,
  RepositoryListRequest,
  RepositoryListResponse,
  RepositorySnapshot,
} from "@mystra/shared";

export interface RepoProvider {
  readonly providerName: string;
  listRepositories(input: RepositoryListRequest): Promise<RepositoryListResponse>;
  getRepository(identifier: string): Promise<RepositorySnapshot | undefined>;
}

export interface IssueProvider {
  readonly providerName: string;
  readonly repositoryScope: "required" | "optional" | "unsupported";
  listIssues(input: IssueListRequest): Promise<IssueListResponse>;
  getIssue(input: IssueGetRequest): Promise<Issue | undefined>;
}

export interface IntegrationPlugin {
  readonly descriptor: IntegrationDescriptor;
  readonly capabilities: {
    readonly repositories?: RepoProvider;
    readonly issues?: IssueProvider;
  };
}
