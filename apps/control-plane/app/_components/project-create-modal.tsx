"use client";

import type { IntegrationConnectionListResponse, RepositoryListResponse, RepositorySnapshot } from "@mystra/shared";
import {
  ShellIcon,
  StackedList,
  StackedListField,
  StackedListRow,
  UiActionAnchor,
  UiButton,
  UiDialogCloseButton,
  UiDialogSurface,
  UiDropdown,
  UiInput,
  UiLabel,
  UiSurfaceBody,
  UiSurfaceFooter,
  UiSurfaceHeader,
  UiSurfaceTitle,
  type StackedListStandardFieldDefinition,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { SettingGroup, SettingRow } from "./setting-row";
import { githubConnectionAccountLogin } from "./github-connection-model";

const repositoryFields = [
  { key: "repository", align: "left", renderType: "icon" },
  { key: "name", align: "left", renderType: "text" },
  { key: "visibility", align: "right", renderType: "labels" },
  { key: "branch", align: "right", renderType: "text" },
] as const satisfies readonly StackedListStandardFieldDefinition[];

function suggestedSlug(fullName: string): string {
  return (fullName.split("/").at(-1) ?? fullName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function responseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: unknown };
    if (typeof error?.message === "string") return error.message;
  }
  return `Request failed with status ${status}`;
}

export function ProjectCreateModal({ locale, onClose, onCreated }: {
  locale: "en" | "zh-CN";
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const zh = locale === "zh-CN";
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const repositoryRequestRef = useRef(0);
  const connections = useResource<IntegrationConnectionListResponse>("/api/integration-connections");
  const activeConnections = useMemo(() => (
    connections.data?.connections.filter((item) => (
      item.integration === "github" && item.status === "active" && item.credentialState === "ready"
    )) ?? []
  ), [connections.data]);
  const [connectionId, setConnectionId] = useState("");
  const activeConnection = activeConnections.find((item) => item.id === connectionId);
  const provider = connections.data?.providers.find((item) => item.integration === "github");
  const appMethod = provider?.methods.find((method) => method.type === "github-app");
  const [repositories, setRepositories] = useState<RepositorySnapshot[]>([]);
  const [pageInfo, setPageInfo] = useState<RepositoryListResponse["pageInfo"] | null>(null);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [repositoryError, setRepositoryError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RepositorySnapshot | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { const dialog = dialogRef.current; if (dialog && !dialog.open) dialog.showModal(); }, []);

  useEffect(() => {
    if (activeConnections.some((connection) => connection.id === connectionId)) return;
    setConnectionId(activeConnections.length === 1 ? activeConnections[0]!.id : "");
  }, [activeConnections, connectionId]);

  async function loadRepositories(cursor?: string) {
    if (!activeConnection) return;
    const requestId = ++repositoryRequestRef.current;
    setRepositoryLoading(true);
    setRepositoryError(null);
    try {
      const params = new URLSearchParams({ limit: "50", connectionId: activeConnection.id });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/integrations/github/repositories?${params}`, { cache: "no-store" });
      const payload = await response.json() as RepositoryListResponse;
      if (!response.ok) throw new Error(responseError(payload, response.status));
      if (repositoryRequestRef.current !== requestId) return;
      setRepositories((current) => cursor
        ? [...new Map([...current, ...payload.items].map((item) => [item.externalId, item])).values()]
        : payload.items);
      setPageInfo(payload.pageInfo);
    } catch (error) {
      if (repositoryRequestRef.current === requestId) {
        setRepositoryError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (repositoryRequestRef.current === requestId) setRepositoryLoading(false);
    }
  }

  useEffect(() => {
    repositoryRequestRef.current += 1;
    setRepositoryLoading(false);
    setRepositories([]);
    setPageInfo(null);
    setSelected(null);
    setQuery("");
    setRepositoryError(null);
    if (activeConnection) void loadRepositories();
  }, [activeConnection?.id]);

  const visibleRepositories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? repositories.filter((item) => item.fullName.toLowerCase().includes(normalized)) : repositories;
  }, [query, repositories]);

  function selectRepository(repository: RepositorySnapshot) {
    if (repository.isArchived) return;
    setSelected(repository);
    const suggestedName = repository.fullName.split("/").at(-1) ?? repository.fullName;
    setName(suggestedName);
    setSlug(suggestedSlug(repository.fullName));
    setSubmitError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !activeConnection || !name.trim() || !slug.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          repositoryConnectionId: activeConnection.id,
          repositoryExternalId: selected.externalId,
          repositoryBaseBranch: selected.defaultBranch,
          metadata: { repositoryFullName: selected.fullName },
        }),
      });
      const payload = await response.json() as { project?: { slug: string } };
      if (!response.ok || !payload.project) throw new Error(responseError(payload, response.status));
      await onCreated();
      onClose();
      router.push(`/projects/${encodeURIComponent(payload.project.slug)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      setSubmitting(false);
    }
  }

  const connectHref = `${appMethod?.connectUrl ?? "/api/integration-connections/github/connect"}?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`;

  return (
    <dialog aria-labelledby="project-create-title" className="projectCreateModal" ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="projectCreateModalForm" onSubmit={(event) => void submit(event)}>
        <UiDialogSurface className="projectCreateModalSurface">
          <UiSurfaceHeader>
            <UiSurfaceTitle id="project-create-title">{zh ? "创建 Project" : "Create Project"}</UiSurfaceTitle>
            <UiDialogCloseButton aria-label={zh ? "关闭" : "Close"} onClick={onClose} />
          </UiSurfaceHeader>
          <UiSurfaceBody className="projectCreateModalBody">
          {!selected ? (
            <SettingGroup>
              <SettingRow
                control={(
                  <UiDropdown
                    aria-label={zh ? "项目来源" : "Project source"}
                    className="projectCreateSettingField"
                    onValueChange={() => undefined}
                    options={[
                      { value: "github", label: "GitHub" },
                      { value: "gitlab", label: "GitLab", description: zh ? "即将支持" : "Soon", disabled: true },
                    ]}
                    placeholder={zh ? "选择来源" : "Select a source"}
                    size="inline"
                    value="github"
                  />
                )}
                description={zh ? "以后可以扩展更多来源" : "More sources can be added later"}
                title={zh ? "来源" : "Source"}
              />
            </SettingGroup>
          ) : null}

          {activeConnections.length > 0 && !selected ? (
            <SettingGroup>
              <SettingRow
                control={(
                  <UiDropdown
                    aria-label={zh ? "GitHub 连接" : "GitHub connection"}
                    className="projectCreateSettingField"
                    onValueChange={setConnectionId}
                    options={activeConnections.map((connection) => ({
                      value: connection.id,
                      label: connection.displayName ?? githubConnectionAccountLogin(connection),
                      description: `${githubConnectionAccountLogin(connection)} · ${connection.authMethod === "github-app" ? "GitHub App" : "PAT"}`,
                    }))}
                    placeholder={zh ? "请选择连接" : "Select a connection"}
                    size="inline"
                    value={connectionId}
                  />
                )}
                description={activeConnections.length === 1
                  ? (zh ? "已使用唯一可用连接" : "The only available connection is selected")
                  : (zh ? "选择仓库所属的 GitHub 身份" : "Choose the GitHub identity that owns the repository")}
                title={zh ? "连接" : "Connection"}
              />
            </SettingGroup>
          ) : null}

          {activeConnections.length === 0 ? (
            <div className="projectRepositoryState">
              <strong>{provider?.methods.some((method) => method.configured) ? (zh ? "尚未连接 GitHub" : "GitHub is not connected") : (zh ? "GitHub 连接方式尚未配置" : "GitHub connection methods are not configured")}</strong>
              <span>{zh ? "请先在设置的集成页面完成连接。" : "Connect it from Settings → Integrations first."}</span>
              {appMethod?.configured ? <UiActionAnchor href={connectHref} tone="solid">{zh ? "连接 GitHub" : "Connect GitHub"}</UiActionAnchor> : null}
            </div>
          ) : !activeConnection ? (
            <div className="projectRepositoryState" role="status">
              {zh ? "选择一个连接后再浏览仓库。" : "Select a connection before browsing repositories."}
            </div>
          ) : !selected ? (
            <section className="projectRepositoryPicker" aria-label={zh ? "选择仓库" : "Choose repository"}>
              <UiInput aria-label={zh ? "筛选仓库" : "Filter repositories"} autoFocus placeholder={zh ? "筛选仓库" : "Filter repositories"} type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
              {repositoryError ? <div className="projectRepositoryState"><span>{repositoryError}</span><UiButton tone="soft" onClick={() => void loadRepositories()}>{zh ? "重试" : "Retry"}</UiButton></div> : null}
              {!repositoryError && repositoryLoading && repositories.length === 0 ? <div className="projectRepositoryState">…</div> : null}
              {!repositoryError && !repositoryLoading && visibleRepositories.length === 0 ? <div className="projectRepositoryState">{zh ? "没有可用仓库" : "No repositories available"}</div> : null}
              {visibleRepositories.length > 0 ? (
                <div className="projectRepositoryTableViewport">
                  <StackedList className="projectRepositoryTable" fields={repositoryFields}>
                    {visibleRepositories.map((repository) => (
                      <StackedListRow
                        disabled={repository.isArchived}
                        key={repository.externalId}
                        left={<StackedListField field={repositoryFields[0]}><ShellIcon name="repository" /></StackedListField>}
                        name={repository.fullName}
                        onClick={() => selectRepository(repository)}
                        right={<>
                          <StackedListField field={repositoryFields[2]}><UiLabel>{repository.visibility}{repository.isArchived ? ` · ${zh ? "已归档" : "archived"}` : ""}</UiLabel></StackedListField>
                          <StackedListField field={repositoryFields[3]}>{repository.defaultBranch}</StackedListField>
                        </>}
                      />
                    ))}
                  </StackedList>
                </div>
              ) : null}
              {pageInfo?.hasNextPage && pageInfo.endCursor ? <UiButton disabled={repositoryLoading} tone="soft" onClick={() => void loadRepositories(pageInfo.endCursor!)}>{repositoryLoading ? "…" : (zh ? "加载更多" : "Load more")}</UiButton> : null}
            </section>
          ) : (
            <SettingGroup>
              <SettingRow
                control={<span className="settingRowStatus">{activeConnection.authMethod === "github-app" ? "GitHub App" : "PAT"}</span>}
                description={githubConnectionAccountLogin(activeConnection)}
                title={zh ? "连接" : "Connection"}
              />
              <SettingRow
                control={<UiButton tone="soft" onClick={() => setSelected(null)}>{zh ? "更换" : "Change"}</UiButton>}
                description={`${selected.fullName} · ${selected.visibility}`}
                title={zh ? "关联仓库" : "Repository"}
              />
              <SettingRow
                control={(
                  <UiInput
                    aria-label={zh ? "Project 名称" : "Project name"}
                    className="projectCreateSettingField"
                    fieldSize="default"
                    required
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                )}
                description={zh ? "显示在 Mystra 中，用于识别这个 Project" : "Shown in Mystra and used to identify this Project"}
                title={zh ? "名称" : "Name"}
              />
              <SettingRow
                control={(
                  <UiInput
                    aria-label="Project slug"
                    className="projectCreateSettingField"
                    fieldSize="default"
                    pattern="[a-z0-9][a-z0-9-]*"
                    required
                    value={slug}
                    onChange={(event) => setSlug(event.currentTarget.value)}
                  />
                )}
                description={zh ? "用于 Project URL，仅支持小写字母、数字和连字符" : "Used in Project URLs; lowercase letters, numbers, and hyphens"}
                title="Slug"
              />
            </SettingGroup>
          )}
          {submitError ? <p className="formNotice formError" role="alert">{submitError}</p> : null}
          </UiSurfaceBody>
          <UiSurfaceFooter className="projectCreateModalFooter">
            <UiButton disabled={!selected || submitting} size="inline" tone="solid" type="submit">{submitting ? (zh ? "创建中…" : "Creating…") : (zh ? "创建" : "Create")}</UiButton>
          </UiSurfaceFooter>
        </UiDialogSurface>
      </form>
    </dialog>
  );
}
