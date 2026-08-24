"use client";

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
import { useMemo, useState } from "react";

import styles from "./skill-library-prototype.module.css";
import { skillFixtures } from "./skill-library-model";
import { PrototypeDialog, PrototypeShell } from "./prototype-shell";

const defaultSkill = skillFixtures[0]!;
const defaultRevision = defaultSkill.revisions[0]!;

export function SkillLibraryPrototype() {
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedSkillName, setSelectedSkillName] = useState(defaultSkill.name);
  const [selectedRevisionSequence, setSelectedRevisionSequence] = useState(defaultRevision.sequence);
  const [selectedFilePath, setSelectedFilePath] = useState("SKILL.md");
  const [showUpload, setShowUpload] = useState(false);
  const [notice, setNotice] = useState("Viewing immutable Revision 3");

  const visibleSkills = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return skillFixtures.filter((skill) => {
      if (!includeArchived && skill.status === "archived") return false;
      return !normalized || `${skill.name} ${skill.description}`.toLowerCase().includes(normalized);
    });
  }, [includeArchived, query]);

  const selectedSkill = skillFixtures.find((skill) => skill.name === selectedSkillName) ?? defaultSkill;
  const selectedRevision = selectedSkill.revisions.find((revision) => revision.sequence === selectedRevisionSequence) ?? selectedSkill.revisions[0]!;
  const selectedFile = selectedRevision.files.find((file) => file.path === selectedFilePath) ?? selectedRevision.files[0]!;

  function selectSkill(name: string) {
    const skill = skillFixtures.find((candidate) => candidate.name === name) ?? defaultSkill;
    const revision = skill.revisions[0]!;
    setSelectedSkillName(skill.name);
    setSelectedRevisionSequence(revision.sequence);
    setSelectedFilePath(revision.files[0]!.path);
    setNotice(`Viewing immutable Revision ${revision.sequence}`);
  }

  function selectRevision(sequence: number) {
    const revision = selectedSkill.revisions.find((candidate) => candidate.sequence === sequence) ?? selectedSkill.revisions[0]!;
    setSelectedRevisionSequence(revision.sequence);
    setSelectedFilePath(revision.files[0]!.path);
    setNotice(`Viewing immutable Revision ${revision.sequence}`);
  }

  return (
    <PrototypeShell
      breadcrumbItems={[{ label: "Team" }, { label: "Skills" }]}
      headerActions={<UiButton onClick={() => setShowUpload(true)} tone="solid"><ShellIcon name="plus" /> Upload ZIP</UiButton>}
      onNewTask={() => setNotice("New Task remains a global action")}
      onSearch={() => setNotice("Global search remains separate from Skill filtering")}
    >
      <main className={styles.page}>
        <UiSurface as="section" aria-labelledby="skill-library-title" className={styles.library}>
          <UiSurfaceHeader className={styles.libraryHeader}>
            <div>
              <strong id="skill-library-title">Skill library</strong>
              <span>{visibleSkills.length} visible</span>
            </div>
            <label className={styles.archiveToggle}>
              <input checked={includeArchived} onChange={(event) => setIncludeArchived(event.currentTarget.checked)} type="checkbox" />
              Include archived
            </label>
          </UiSurfaceHeader>
          <div className={styles.searchField}>
            <ShellIcon name="search" />
            <UiInput aria-label="Filter Skills" placeholder="Filter Skills" type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          </div>
          <div className={styles.skillList}>
            {visibleSkills.map((skill) => (
              <UiButton
                active={skill.name === selectedSkill.name}
                block
                className={styles.skillRow}
                key={skill.name}
                onClick={() => selectSkill(skill.name)}
              >
                <span className={styles.skillRowTitle}><strong>{skill.name}</strong><small data-status={skill.status}>{skill.status}</small></span>
                <span>{skill.description}</span>
                <span className={styles.skillMeta}>Revision {skill.revisions[0]!.sequence} · {skill.updatedAt}</span>
              </UiButton>
            ))}
          </div>
        </UiSurface>

        <UiSurface as="section" aria-labelledby="skill-detail-title" className={styles.detail}>
          <UiSurfaceHeader className={styles.detailHeader}>
            <div>
              <strong id="skill-detail-title">{selectedSkill.name}</strong>
              <span>{selectedSkill.description}</span>
            </div>
            <div className={styles.detailActions}>
              <UiButton onClick={() => setNotice(`Downloading Revision ${selectedRevision.sequence} original ZIP`)} tone="soft">Download ZIP</UiButton>
              <UiButton disabled={selectedSkill.status === "archived"} onClick={() => setShowUpload(true)} tone="soft">New revision</UiButton>
              <UiButton disabled={selectedSkill.status === "archived"} onClick={() => setNotice("Archive confirmation would preserve every Revision and ZIP")} tone="danger">Archive</UiButton>
            </div>
          </UiSurfaceHeader>

          <div className={styles.revisionBar}>
            <label>
              <span>Revision</span>
              <UiSelect value={selectedRevision.sequence} onChange={(event) => selectRevision(Number(event.currentTarget.value))}>
                {selectedSkill.revisions.map((revision) => <option key={revision.sequence} value={revision.sequence}>Revision {revision.sequence}</option>)}
              </UiSelect>
            </label>
            <dl>
              <div><dt>Published</dt><dd>{selectedRevision.createdAt}</dd></div>
              <div><dt>ZIP</dt><dd>{selectedRevision.zipSize}</dd></div>
              <div><dt>Content</dt><dd><code>{selectedRevision.contentDigest}</code></dd></div>
            </dl>
          </div>

          <div className={styles.browser}>
            <aside aria-label="Revision file tree" className={styles.fileTree}>
              <header><strong>Files</strong><span>{selectedRevision.files.length}</span></header>
              {selectedRevision.files.map((file) => (
                <UiButton
                  active={file.path === selectedFile.path}
                  block
                  className={styles.fileRow}
                  key={file.path}
                  onClick={() => setSelectedFilePath(file.path)}
                >
                  <span>{file.path}</span><small>{file.size}</small>
                </UiButton>
              ))}
            </aside>

            <section aria-label="File preview" className={styles.preview}>
              <header>
                <div><strong>{selectedFile.path}</strong><span>{selectedFile.mediaType} · {selectedFile.size}</span></div>
                <code>Revision {selectedRevision.sequence}</code>
              </header>
              {selectedFile.previewable ? (
                <pre><code>{selectedFile.content}</code></pre>
              ) : (
                <div className={styles.noPreview}><ShellIcon name="alert" /><strong>Preview unavailable</strong><span>Binary files expose metadata only. The Control Plane does not render or execute uploaded content.</span></div>
              )}
            </section>
          </div>
          <UiSurfaceFooter className={styles.statusLine} aria-live="polite">{notice}</UiSurfaceFooter>
        </UiSurface>
      </main>

      {showUpload ? (
        <PrototypeDialog onClose={() => setShowUpload(false)} title="Upload Skill ZIP">
          <UiDialogSurface className={styles.uploadDialog}>
            <UiSurfaceHeader>
              <div><strong>Upload Skill ZIP</strong><span>Creates an immutable Revision</span></div>
              <UiDialogCloseButton aria-label="Close upload dialog" onClick={() => setShowUpload(false)} />
            </UiSurfaceHeader>
            <UiSurfaceBody className={styles.uploadBody}>
              <label className={styles.dropZone}>
                <ShellIcon name="attachment" />
                <strong>Choose one .zip file</strong>
                <span>20 MiB compressed · 100 MiB expanded · no temporary extraction</span>
                <input accept=".zip,application/zip" type="file" />
              </label>
              <div className={styles.uploadRules}>
                <span><ShellIcon name="check" /> Root SKILL.md or one common top-level folder</span>
                <span><ShellIcon name="check" /> Every entry validated before publication</span>
                <span><ShellIcon name="check" /> Scripts are stored, never executed</span>
              </div>
            </UiSurfaceBody>
            <UiSurfaceFooter className={styles.uploadFooter}>
              <UiButton onClick={() => setShowUpload(false)}>Cancel</UiButton>
              <UiButton onClick={() => { setShowUpload(false); setNotice("Prototype publication validated · no data was written"); }} tone="solid">Validate and publish</UiButton>
            </UiSurfaceFooter>
          </UiDialogSurface>
        </PrototypeDialog>
      ) : null}
    </PrototypeShell>
  );
}
