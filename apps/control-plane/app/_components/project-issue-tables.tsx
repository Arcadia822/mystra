import type { GitHubIssueListItem, LinearIssueListItem } from "@mystra/shared";

import { ISSUE_COPY, type ShellLocale } from "./shell-copy";

function updated(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ProviderLink({ href, label }: { href: string; label: string }) {
  return <a aria-label={label} className="issueExternalLink" href={href} rel="noreferrer" target="_blank">↗</a>;
}

export function GitHubIssueTable({ items, locale }: { items: GitHubIssueListItem[]; locale: ShellLocale }) {
  const headers = ISSUE_COPY[locale].githubHeaders;
  return (
    <div className="issueTableViewport">
      <table className="issueNativeTable">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th><span className="srOnly">Open</span></th></tr></thead>
        <tbody>{items.map((issue) => (
          <tr key={issue.externalId}>
            <td className="issueIdentifier">#{issue.number}</td>
            <td className="issueTitle">{issue.title}</td>
            <td><span className="issuePill" data-tone={issue.state === "open" ? "success" : "muted"}>{issue.state}</span></td>
            <td>{issue.assignees.length ? issue.assignees.map((assignee) => assignee.login).join(", ") : "—"}</td>
            <td>{issue.labels.length ? issue.labels.map((label) => label.name).join(", ") : "—"}</td>
            <td>{issue.milestone?.title ?? "—"}</td>
            <td><time dateTime={issue.updatedAt}>{updated(issue.updatedAt)}</time></td>
            <td><ProviderLink href={issue.url} label={`Open GitHub Issue #${issue.number}`} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function LinearIssueTable({ items, locale }: { items: LinearIssueListItem[]; locale: ShellLocale }) {
  const headers = ISSUE_COPY[locale].linearHeaders;
  return (
    <div className="issueTableViewport">
      <table className="issueNativeTable">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th><span className="srOnly">Open</span></th></tr></thead>
        <tbody>{items.map((issue) => (
          <tr key={issue.externalId}>
            <td className="issueIdentifier">{issue.identifier}</td>
            <td className="issueTitle">{issue.title}</td>
            <td><span className="issuePill" data-tone="info">{issue.status.name}</span></td>
            <td>{issue.priority?.label ?? "—"}</td>
            <td>{issue.assignee?.name ?? "—"}</td>
            <td>{issue.cycle?.name ?? "—"}</td>
            <td><time dateTime={issue.updatedAt}>{updated(issue.updatedAt)}</time></td>
            <td><ProviderLink href={issue.url} label={`Open Linear Issue ${issue.identifier}`} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
