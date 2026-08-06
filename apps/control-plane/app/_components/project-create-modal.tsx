"use client";

import type { IntegrationConnectionListResponse, RepositoryListResponse, RepositorySnapshot } from "@mystra/shared";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useResource } from "../_lib/use-resource";
import { SettingGroup, SettingRow } from "./setting-row";
import { UiActionAnchor, UiButton, UiIconButton } from "./ui-actions";
import { UiInput, UiSelect } from "./ui-fields";
import { UiDialogSurface } from "./ui-surfaces";

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
  const connections = useResource<IntegrationConnectionListResponse>("/api/integration-connections");
  const activeConnection = connections.data?.connections.find((item) => item.integration === "github" && item.status === "active");
  const provider = connections.data?.providers.find((item) => item.integration === "github");
  const [repositories, setRepositories] = useState<RepositorySnapshot[]>([]);
  const [pageInfo, setPageInfo] = useState<RepositoryListResponse["pageInfo"] | null>(null);
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [repositoryError, setRepositoryError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RepositorySnapshot | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [agent, setAgent] = useState<"codex" | "copilot">("copilot");
  const [runtimeImage, setRuntimeImage] = useState("mystra-runner:local");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { const dialog = dialogRef.current; if (dialog && !dialog.open) dialog.showModal(); }, []);

  async function loadRepositories(cursor?: string) {
    if (!activeConnection) return;
    setRepositoryLoading(true);
    setRepositoryError(null);
    try {
      const params = new URLSearchParams({ limit: "50", connectionId: activeConnection.id });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/integrations/github/repositories?${params}`, { cache: "no-store" });
      const payload = await response.json() as RepositoryListResponse;
      if (!response.ok) throw new Error(responseError(payload, response.status));
      setRepositories((current) => cursor
        ? [...new Map([...current, ...payload.items].map((item) => [item.externalId, item])).values()]
        : payload.items);
      setPageInfo(payload.pageInfo);
    } catch (error) {
      setRepositoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setRepositoryLoading(false);
    }
  }

  useEffect(() => { if (activeConnection) void loadRepositories(); }, [activeConnection?.id]);

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
    if (!selected || !activeConnection || !name.trim() || !slug.trim() || !runtimeImage.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), slug: slug.trim(),
          repository: { integration: "github", connectionId: activeConnection.id, identifier: selected.fullName },
          defaultAgent: agent,
          runtime: { provider: "docker", image: runtimeImage.trim() },
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

  const connectHref = `${provider?.connectUrl ?? "/api/integration-connections/github/connect"}?returnTo=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`;

  return (
    <dialog aria-labelledby="project-create-title" className="projectCreateModal" ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <UiDialogSurface className="projectCreateModalSurface">
        <header className="projectCreateModalHeader">
          <div><h2 id="project-create-title">{zh ? "添加 Project" : "Add Project"}</h2><span>{zh ? "从远程仓库创建执行边界" : "Create an execution boundary from a remote repository"}</span></div>
          <UiIconButton aria-label={zh ? "关闭" : "Close"} onClick={onClose}>×</UiIconButton>
        </header>
        <form className="projectCreateModalBody" onSubmit={(event) => void submit(event)}>
          <SettingGroup><SettingRow title={zh ? "来源" : "Source"} description={zh ? "以后可以扩展更多来源" : "More sources can be added later"}>
            <UiSelect aria-label={zh ? "项目来源" : "Project source"} value="github" onChange={() => undefined}><option value="github">GitHub</option><option disabled>GitLab — Soon</option></UiSelect>
          </SettingRow></SettingGroup>

          {!activeConnection ? (
            <div className="projectRepositoryState">
              <strong>{provider?.configured ? (zh ? "尚未连接 GitHub App" : "GitHub App is not connected") : (zh ? "GitHub App 尚未配置" : "GitHub App is not configured")}</strong>
              <span>{zh ? "请先在设置的集成页面完成连接。" : "Connect it from Settings → Integrations first."}</span>
              {provider?.configured ? <UiActionAnchor href={connectHref} tone="solid">{zh ? "连接 GitHub" : "Connect GitHub"}</UiActionAnchor> : null}
            </div>
          ) : !selected ? (
            <section className="projectRepositoryPicker" aria-label={zh ? "选择仓库" : "Choose repository"}>
              <UiInput autoFocus placeholder={zh ? "筛选仓库" : "Filter repositories"} type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
              {repositoryError ? <div className="projectRepositoryState"><span>{repositoryError}</span><UiButton tone="soft" onClick={() => void loadRepositories()}>{zh ? "重试" : "Retry"}</UiButton></div> : null}
              {!repositoryError && repositoryLoading && repositories.length === 0 ? <div className="projectRepositoryState">…</div> : null}
              {!repositoryError && !repositoryLoading && visibleRepositories.length === 0 ? <div className="projectRepositoryState">{zh ? "没有可用仓库" : "No repositories available"}</div> : null}
              <div className="projectRepositoryList">{visibleRepositories.map((repository) => (
                <UiButton block disabled={repository.isArchived} key={repository.externalId} onClick={() => selectRepository(repository)}>
                  <span><strong>{repository.fullName}</strong><small>{repository.visibility}{repository.isArchived ? " · archived" : ""}</small></span><span>›</span>
                </UiButton>
              ))}</div>
              {pageInfo?.hasNextPage && pageInfo.endCursor ? <UiButton disabled={repositoryLoading} tone="soft" onClick={() => void loadRepositories(pageInfo.endCursor!)}>{repositoryLoading ? "…" : (zh ? "加载更多" : "Load more")}</UiButton> : null}
            </section>
          ) : (
            <SettingGroup>
              <SettingRow title={zh ? "关联仓库" : "Repository"} description={`${selected.fullName} · ${selected.visibility}`}><UiButton tone="soft" onClick={() => setSelected(null)}>{zh ? "更换" : "Change"}</UiButton></SettingRow>
              <SettingRow title={zh ? "名称" : "Name"}><UiInput required value={name} onChange={(event) => setName(event.currentTarget.value)} /></SettingRow>
              <SettingRow title="Slug"><UiInput pattern="[a-z0-9][a-z0-9-]*" required value={slug} onChange={(event) => setSlug(event.currentTarget.value)} /></SettingRow>
              <SettingRow title={zh ? "默认 Agent" : "Default Agent"}><UiSelect value={agent} onChange={(event) => setAgent(event.currentTarget.value as "codex" | "copilot")}><option value="copilot">Copilot</option><option value="codex">Codex</option></UiSelect></SettingRow>
              <SettingRow title={zh ? "运行时镜像" : "Runtime image"}><UiInput required value={runtimeImage} onChange={(event) => setRuntimeImage(event.currentTarget.value)} /></SettingRow>
            </SettingGroup>
          )}
          {submitError ? <p className="formNotice formError" role="alert">{submitError}</p> : null}
          <footer className="projectCreateModalFooter"><UiButton onClick={onClose}>{zh ? "取消" : "Cancel"}</UiButton><UiButton disabled={!selected || submitting} tone="solid" type="submit">{submitting ? (zh ? "创建中…" : "Creating…") : (zh ? "创建 Project" : "Create Project")}</UiButton></footer>
        </form>
      </UiDialogSurface>
    </dialog>
  );
}
