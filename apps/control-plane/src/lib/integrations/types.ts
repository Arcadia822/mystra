import type {
  Issue,
  IssueListRequest,
  IssueListResponse,
} from "@mystra/shared";

export interface IssueProvider {
  readonly providerName: string;
  listIssues(input: IssueListRequest): Promise<IssueListResponse>;
  getIssue(identifier: string): Promise<Issue | undefined>;
}

export interface Integration {
  readonly name: string;
  readonly provider: string;
  readonly capabilities: {
    readonly issues?: IssueProvider;
  };
}
