"use client";

import type { Project } from "@mystra/shared";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ErrorState, LoadingState } from "../../_components/states";
import { StatusBadge } from "../../_components/status-badge";
import { relativeTime } from "../../_lib/format";
import { useResource } from "../../_lib/use-resource";

function listOrNone(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function objectKeysOrNone(value: Record<string, unknown>): string {
  return listOrNone(Object.keys(value).sort());
}

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const resource = useResource<{ project: Project }>(
    `/api/projects/${encodeURIComponent(slug)}`,
  );

  if (resource.isLoading) {
    return <div className="pageContent"><LoadingState label="Loading project detail" /></div>;
  }
  if (resource.error || !resource.data) {
    return (
      <div className="pageContent">
        <ErrorState message={resource.error ?? "Project response missing"} onRetry={() => void resource.refresh()} />
      </div>
    );
  }

  const { project } = resource.data;
  const { runtime } = project;

  return (
    <div className="pageContent">
      <div className="pageToolbar">
        <div className="pageIdentity">
          <Link className="backLink" href="/projects">← Projects</Link>
          <strong>{project.name}</strong>
          <StatusBadge
            state={project.archivedAt ? "archived" : "active"}
            tone={project.archivedAt ? "muted" : "good"}
          />
        </div>
        <button className="secondaryButton" type="button" onClick={() => void resource.refresh()}>Refresh</button>
      </div>
      <div className="detailGrid">
        <div className="detailStack">
          <section className="panel">
            <div className="panelHeader"><h2>Project</h2><span className="mono">{project.id}</span></div>
            <dl className="definitionList">
              <div><dt>Slug</dt><dd>{project.slug}</dd></div>
              <div><dt>Repository</dt><dd className="mono">{project.repo}</dd></div>
              <div><dt>Base branch</dt><dd className="mono">{project.baseBranch}</dd></div>
              <div><dt>Default agent</dt><dd>{project.defaultAgent}</dd></div>
              <div><dt>Created</dt><dd>{relativeTime(project.createdAt)} · {project.createdAt}</dd></div>
              <div><dt>Updated</dt><dd>{relativeTime(project.updatedAt)} · {project.updatedAt}</dd></div>
              {project.archivedAt ? <div><dt>Archived</dt><dd>{project.archivedAt}</dd></div> : null}
            </dl>
          </section>
          <section className="panel">
            <div className="panelHeader"><h2>Runtime inputs</h2><span>{runtime.contextBundleRefs.length + runtime.mounts.length}</span></div>
            <dl className="definitionList">
              <div>
                <dt>Context bundles</dt>
                <dd>{listOrNone(runtime.contextBundleRefs.map((bundle) => (
                  `${bundle.slug} · ${bundle.accessMode}${bundle.required ? " · required" : ""}`
                )))}</dd>
              </div>
              <div>
                <dt>Mounts</dt>
                <dd>{listOrNone(runtime.mounts.map((mount) => (
                  `${mount.kind} · ${mount.target} · ${mount.readOnly ? "read-only" : "read-write"}`
                )))}</dd>
              </div>
              <div>
                <dt>Ports</dt>
                <dd>{listOrNone(runtime.exposedPorts.map((port) => (
                  `${port.name ?? "port"} · ${port.containerPort}${port.hostBinding ? ` → ${port.hostBinding}` : ""}`
                )))}</dd>
              </div>
            </dl>
          </section>
        </div>
        <div className="detailStack">
          <section className="panel">
            <div className="panelHeader"><h2>Runtime</h2><span>{runtime.provider}</span></div>
            <dl className="definitionList">
              <div><dt>Provider</dt><dd>{runtime.provider}</dd></div>
              <div><dt>Image</dt><dd className="mono">{runtime.image}</dd></div>
              <div><dt>Cold start</dt><dd>{runtime.cache.coldStartAllowed ? "allowed" : "not allowed"}</dd></div>
              <div>
                <dt>Cache entries</dt>
                <dd>{listOrNone(runtime.cache.entries.map((entry) => `${entry.kind} · ${entry.target}`))}</dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <div className="panelHeader"><h2>Policy and references</h2><span>read-only</span></div>
            <dl className="definitionList">
              <div><dt>Image override</dt><dd>{runtime.overridePolicy.allowImageOverride ? "allowed" : "blocked"}</dd></div>
              <div><dt>Context additions</dt><dd>{runtime.overridePolicy.allowContextBundleAdditions ? "allowed" : "blocked"}</dd></div>
              <div><dt>Allowed bundles</dt><dd>{listOrNone(runtime.overridePolicy.allowedContextBundleSlugs)}</dd></div>
              <div>
                <dt>Secret references</dt>
                <dd>{listOrNone(runtime.secretRefs.map((secret) => (
                  `${secret.name} · ${secret.mode}${secret.target ? ` · ${secret.target}` : ""}`
                )))}</dd>
              </div>
              <div><dt>Prewarm keys</dt><dd>{objectKeysOrNone(project.prewarmConfig)}</dd></div>
              <div><dt>Project metadata keys</dt><dd>{objectKeysOrNone(project.metadata)}</dd></div>
              <div><dt>Runtime metadata keys</dt><dd>{objectKeysOrNone(runtime.metadata)}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
