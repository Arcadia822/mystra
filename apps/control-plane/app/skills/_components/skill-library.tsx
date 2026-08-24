"use client";

import type {
  SkillDetail,
  SkillFilePreviewResponse,
  SkillManifestEntry,
  SkillPage,
  SkillRevisionDetail,
  SkillRevisionPage,
} from "@mystra/shared";
import {
  ShellIcon,
  UiButton,
  UiDialogCloseButton,
  UiDialogSurface,
  UiInput,
  UiSelect,
  UiSurface,
  UiSurfaceBody,
  UiSurfaceFooter,
  UiSurfaceHeader,
} from "@mystra/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ShellMainHeader } from "../../_components/shell-main-header";
import styles from "./skill-library.module.css";
import { filePreviewPresentation, findExactManifestFile, skillListUrl, skillRevisionDownloadUrl } from "./skill-library-model";

interface ApiFailure {
  error?: { code?: string; message?: string };
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "include", ...init });
  const payload = await response.json().catch(() => null) as ApiFailure | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.error?.code ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SkillLibrary({ initialSkillId }: { initialSkillId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState<SkillPage | null>(null);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [revisions, setRevisions] = useState<SkillRevisionPage | null>(null);
  const [revision, setRevision] = useState<SkillRevisionDetail | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<SkillFilePreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [notice, setNotice] = useState("Loading Skill library…");
  const [uploadMode, setUploadMode] = useState<"create" | "revision" | null>(null);

  const loadRevision = useCallback(async (skillId: string, revisionId: string) => {
    const next = await apiJson<SkillRevisionDetail>(`/api/skills/${encodeURIComponent(skillId)}/revisions/${encodeURIComponent(revisionId)}`);
    setRevision(next);
    setSelectedPath(next.manifest[0]?.path ?? null);
    setPreview(null);
    setNotice(`Viewing immutable Revision ${next.sequence}`);
  }, []);

  const loadSkill = useCallback(async (skillId: string) => {
    const [nextSkill, nextRevisions] = await Promise.all([
      apiJson<SkillDetail>(`/api/skills/${encodeURIComponent(skillId)}`),
      apiJson<SkillRevisionPage>(`/api/skills/${encodeURIComponent(skillId)}/revisions?limit=100`),
    ]);
    setSkill(nextSkill);
    setRevisions(nextRevisions);
    await loadRevision(skillId, nextSkill.currentRevisionId);
  }, [loadRevision]);

  const refreshList = useCallback(async () => {
    try {
      const next = await apiJson<SkillPage>(skillListUrl({ query, includeArchived }));
      setPage(next);
      if (!initialSkillId && !skill && next.items[0]) await loadSkill(next.items[0].id);
      if (next.items.length === 0) setNotice("No Skills match this view");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load Skills");
    }
  }, [includeArchived, initialSkillId, loadSkill, query, skill]);

  useEffect(() => { void refreshList(); }, [refreshList]);
  useEffect(() => {
    if (!initialSkillId) return;
    void loadSkill(initialSkillId).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Skill not found"));
  }, [initialSkillId, loadSkill]);

  const selectSkill = useCallback((skillId: string) => {
    router.push(`/skills/${encodeURIComponent(skillId)}`);
  }, [router]);

  const selectFile = useCallback(async (file: SkillManifestEntry) => {
    if (!skill || !revision) return;
    setSelectedPath(file.path);
    setPreview(null);
    if (file.previewability !== "text") {
      setNotice(`Preview unavailable: ${file.previewability}`);
      return;
    }
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({ path: file.path });
      const next = await apiJson<SkillFilePreviewResponse>(
        `/api/skills/${encodeURIComponent(skill.id)}/revisions/${encodeURIComponent(revision.id)}/file?${params}`,
      );
      setPreview(next);
      setNotice(`Previewing ${file.path} from immutable Revision ${revision.sequence}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }, [revision, skill]);

  useEffect(() => {
    const file = revision?.manifest.find(({ path }) => path === selectedPath);
    if (file) void selectFile(file);
  }, [revision?.id]); // Load the first manifest entry once for each immutable Revision.

  const archive = useCallback(async () => {
    if (!skill || !window.confirm(`Archive ${skill.name}? Its Revisions and ZIP objects will be preserved.`)) return;
    try {
      await apiJson<SkillDetail>(`/api/skills/${encodeURIComponent(skill.id)}/archive`, {
        method: "POST",
        headers: { "if-match": `"${skill.resourceRevision}"` },
      });
      await Promise.all([loadSkill(skill.id), refreshList()]);
      setNotice(`${skill.name} archived; its name is available for a new Skill`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Archive failed");
    }
  }, [loadSkill, refreshList, skill]);

  const selectedFile = revision ? findExactManifestFile(revision.manifest, selectedPath) : null;
  const previewPresentation = filePreviewPresentation({ file: selectedFile, preview, loading: loadingPreview });
  const uploadAction = <UiButton className={styles.uploadAction} onClick={() => setUploadMode("create")} tone="solid"><ShellIcon name="plus" /> Upload ZIP</UiButton>;

  return (
    <div className={`pageContent ${styles.host}`}>
      <ShellMainHeader actions={uploadAction} breadcrumbItems={[{ label: "Team" }, { label: "Skills" }]} />
      <main className={styles.page}>
        <UiSurface as="section" aria-labelledby="skill-library-title" className={styles.library}>
          <UiSurfaceHeader className={styles.libraryHeader}>
            <div><strong id="skill-library-title">Skill library</strong><span>{page?.items.length ?? 0} visible</span></div>
            <label className={styles.archiveToggle}><input checked={includeArchived} onChange={(event) => setIncludeArchived(event.currentTarget.checked)} type="checkbox" /> Include archived</label>
          </UiSurfaceHeader>
          <div className={styles.searchField}><ShellIcon name="search" /><UiInput aria-label="Filter Skills" placeholder="Filter Skills" type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></div>
          <div className={styles.skillList}>
            {page?.items.map((item) => (
              <UiButton active={item.id === skill?.id} block className={styles.skillRow} key={item.id} onClick={() => selectSkill(item.id)}>
                <span className={styles.skillRowTitle}><strong>{item.name}</strong><small data-status={item.status}>{item.status}</small></span>
                <span>{item.description}</span>
                <span className={styles.skillMeta}>Revision {item.currentRevision.sequence} · {formatDate(item.updatedAt)}</span>
              </UiButton>
            ))}
          </div>
        </UiSurface>

        <UiSurface as="section" aria-labelledby="skill-detail-title" className={styles.detail}>
          {skill && revision ? <>
            <UiSurfaceHeader className={styles.detailHeader}>
              <div><strong id="skill-detail-title">{skill.name}</strong><span>{skill.description}</span></div>
              <div className={styles.detailActions}>
                <a className="uiAction" data-size="header" data-tone="soft" download href={skillRevisionDownloadUrl(skill.id, revision.id)}>Download ZIP</a>
                <UiButton disabled={skill.status === "archived"} onClick={() => setUploadMode("revision")} tone="soft">New revision</UiButton>
                <UiButton disabled={skill.status === "archived"} onClick={() => void archive()} tone="danger">Archive</UiButton>
              </div>
            </UiSurfaceHeader>
            <div className={styles.revisionBar}>
              <label><span>Revision</span><UiSelect value={revision.id} onChange={(event) => void loadRevision(skill.id, event.currentTarget.value)}>{revisions?.items.map((item) => <option key={item.id} value={item.id}>Revision {item.sequence}</option>)}</UiSelect></label>
              <dl><div><dt>Published</dt><dd>{formatDate(revision.readyAt)}</dd></div><div><dt>ZIP</dt><dd>{formatBytes(revision.compressedSizeBytes)}</dd></div><div><dt>Content</dt><dd><code>{revision.contentSha256.slice(0, 12)}…</code></dd></div></dl>
            </div>
            <div className={styles.browser}>
              <aside aria-label="Revision file tree" className={styles.fileTree}>
                <header><strong>Files</strong></header>
                {revision.manifest.map((file) => <UiButton active={file.path === selectedPath} block className={styles.fileRow} key={file.path} onClick={() => void selectFile(file)}><span>{file.path}</span><small>{formatBytes(file.sizeBytes)}</small></UiButton>)}
              </aside>
              <section aria-label="File preview" className={styles.preview}>
                <header><div><strong>{selectedFile?.path ?? "Select a file"}</strong><span>{selectedFile ? `${selectedFile.mediaType} · ${formatBytes(selectedFile.sizeBytes)}` : ""}</span></div><code>Revision {revision.sequence}</code></header>
                {previewPresentation.kind === "loading" ? <div className={styles.noPreview}>Loading preview…</div> : previewPresentation.kind === "text" ? <pre><code>{previewPresentation.text}</code></pre> : <div className={styles.noPreview}><ShellIcon name="alert" /><strong>Preview unavailable</strong><span>Binary, oversized, invalid UTF-8, and unsupported files expose metadata only. Uploaded content is never rendered or executed.</span></div>}
              </section>
            </div>
          </> : <div className={styles.emptyDetail}><strong>Select a Skill</strong><span>Inspect immutable Revisions and exact manifest files.</span></div>}
          <UiSurfaceFooter className={styles.statusLine} aria-live="polite">{notice}</UiSurfaceFooter>
        </UiSurface>
      </main>
      {uploadMode ? <SkillUploadDialog mode={uploadMode} skill={uploadMode === "revision" ? skill : null} onClose={() => setUploadMode(null)} onPublished={async (published) => { setUploadMode(null); await refreshList(); await loadSkill(published.id); router.push(`/skills/${published.id}`); setNotice(`${published.name} published as Revision ${published.currentRevision.sequence}`); }} /> : null}
    </div>
  );
}

function SkillUploadDialog({ mode, skill, onClose, onPublished }: {
  mode: "create" | "revision";
  skill: SkillDetail | null;
  onClose: () => void;
  onPublished: (skill: SkillDetail) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || (mode === "revision" && !skill)) return;
    setSubmitting(true);
    setError(null);
    try {
      const url = mode === "create" ? "/api/skills" : `/api/skills/${skill!.id}/revisions`;
      const result = await apiJson<{ skill: SkillDetail }>(url, {
        method: "POST",
        headers: { "content-type": "application/zip", ...(skill ? { "if-match": `"${skill.resourceRevision}"` } : {}) },
        body: await file.arrayBuffer(),
      });
      await onPublished(result.skill);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog aria-labelledby="skill-upload-title" className="featureDialog" onCancel={onClose} onClose={onClose} ref={dialogRef}>
      <UiDialogSurface className={styles.uploadDialog} layout="rows">
        <form onSubmit={(event) => void submit(event)}>
          <UiSurfaceHeader><div><strong id="skill-upload-title">{mode === "create" ? "Upload Skill ZIP" : `Publish ${skill?.name} Revision`}</strong><span>Creates one immutable Revision</span></div><UiDialogCloseButton aria-label="Close upload dialog" onClick={onClose} /></UiSurfaceHeader>
          <UiSurfaceBody className={styles.uploadBody}>
            <label className={styles.dropZone}><ShellIcon name="attachment" /><strong>Choose one .zip file</strong><span>20 MiB compressed · 100 MiB expanded · validated in memory</span><input accept=".zip,application/zip" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} required type="file" /></label>
            <div className={styles.uploadRules}><span><ShellIcon name="check" /> Root SKILL.md or one common top-level folder</span><span><ShellIcon name="check" /> Every entry validated before publication</span><span><ShellIcon name="check" /> Scripts are stored, never executed</span></div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
          </UiSurfaceBody>
          <UiSurfaceFooter className={styles.uploadFooter}><UiButton onClick={onClose} type="button">Cancel</UiButton><UiButton disabled={!file || submitting} tone="solid" type="submit">{submitting ? "Publishing…" : "Validate and publish"}</UiButton></UiSurfaceFooter>
        </form>
      </UiDialogSurface>
    </dialog>
  );
}
