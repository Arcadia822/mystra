"use client";

import { UiSegmented, UiSurfaceTitle } from "@mystra/ui";
import { useState } from "react";

import { PrototypeShell } from "./prototype-shell";

type ProjectTab = "overview" | "issues" | "settings";

const projectTabs = [
  { label: "Overview", value: "overview" },
  { label: "Issues", value: "issues" },
  { label: "Settings", value: "settings" },
] as const;

export function ProjectDetailPrototype() {
  const [tab, setTab] = useState<ProjectTab>("issues");

  return (
    <PrototypeShell
      onNewTask={() => undefined}
      onSearch={() => undefined}
      title={<><UiSurfaceTitle as="span">Mystra</UiSurfaceTitle><UiSegmented aria-label="Project sections" onValueChange={setTab} options={projectTabs} role="tablist" value={tab} /></>}
    >
      <div className="pageContent projectDetailPage">
        {tab === "overview" ? <section aria-label="Project overview" className="projectOverview"><dl><div><dt>Repository external ID</dt><dd>R_kgDOMystra</dd></div><div><dt>Base branch</dt><dd>main</dd></div></dl></section> : null}
        {tab === "issues" ? <section aria-label="Project Issues" className="projectIssuesBrowser"><div className="issueState" role="status">Project Issue content</div></section> : null}
        {tab === "settings" ? <section aria-label="Project settings" className="projectOverview"><dl><div><dt>Repository</dt><dd>R_kgDOMystra</dd></div></dl></section> : null}
      </div>
    </PrototypeShell>
  );
}
