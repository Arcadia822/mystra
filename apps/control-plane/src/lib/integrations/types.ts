import type {
  EventCatalogItem,
  EventSubject,
  IntegrationDescriptor,
  Issue,
  IssueGetRequest,
  IssueListRequest,
  IssueListResponse,
  NormalizedEvent,
  RepositoryListRequest,
  RepositoryListResponse,
  RepositorySnapshot,
  TaskIssueReference,
  WorkspaceBranchDecision,
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
  resolveWorkspaceBranch(input: {
    issue: TaskIssueReference;
    taskId: string;
  }): Promise<WorkspaceBranchDecision>;
}
export interface CandidateEvent {
  readonly providerEventId: string;
  readonly eventType: string;
  readonly subject: EventSubject;
  readonly occurredAt: string; // RFC3339
  readonly scope: {
    readonly scopeType: string;
    readonly scopeExternalId: string;
  };
  readonly organizationId?: string;
  readonly changes: Record<string, unknown>;
}

export type WebhookParseResult =
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "events"; readonly events: CandidateEvent[] };

export interface IntegrationEventCapability {
  readonly descriptors: EventCatalogItem[];
  readonly requiredHeaders?: string[];
  parseWebhook(input: {
    rawBody: string;
    headers: Record<string, string>;
    connectionConfig: Record<string, unknown>;
  }): Promise<WebhookParseResult> | WebhookParseResult;
  validateFilters(
    eventType: string,
    filters: Record<string, string>,
  ): Record<string, string>;
  matches(
    eventType: string,
    canonicalFilters: Record<string, string>,
    normalizedEvent: NormalizedEvent,
  ): boolean;
}

export interface IntegrationPlugin {
  readonly descriptor: IntegrationDescriptor;
  readonly capabilities: {
    readonly repositories?: RepoProvider;
    readonly issues?: IssueProvider;
    readonly events?: IntegrationEventCapability;
  };
}
