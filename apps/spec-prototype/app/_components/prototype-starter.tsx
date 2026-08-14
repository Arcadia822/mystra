"use client";

import { ShellIcon, UiIconButton, UiSurface, UiSurfaceBody, UiSurfaceHeader } from "@mystra/ui";
import { useState } from "react";
import { PrototypeShell } from "./prototype-shell";

export function PrototypeStarter() {
  const [notice, setNotice] = useState("Replace only this feature composition.");
  return (
    <PrototypeShell onNewTask={() => setNotice("New Task action")} onSearch={() => setNotice("Search action")} title="Feature title">
      <main className="prototypeStarter">
        <UiSurface as="section">
          <UiSurfaceHeader><strong>Reusable spec prototype starter</strong><UiIconButton aria-label="Sample action" title="Sample action"><ShellIcon name="plus" /></UiIconButton></UiSurfaceHeader>
          <UiSurfaceBody>
            <p>{notice}</p>
            <p>Shell、theme、surface、action 与 icon 均由生产前端共同依赖的 @mystra/ui 提供。</p>
          </UiSurfaceBody>
        </UiSurface>
      </main>
    </PrototypeShell>
  );
}
