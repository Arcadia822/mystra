"use client";

import {
  MystraLogo,
  ShellIcon,
  SidebarIcon,
  SidebarIconButton,
  SidebarMark,
  TaskStatusIcon,
  UiActionAnchor,
  UiBreadcrumb,
  UiIconButton,
  UiRightPanelToggle,
  UiShellRightPanel,
  VerticalNavItem,
  type ShellIconName,
  type TaskStatus,
  type UiBreadcrumbItem,
} from "@mystra/ui";
import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";

interface PrototypeTaskShortcut {
  id: string;
  name: string;
  status: TaskStatus;
}

interface PrototypeProjectGroup {
  name: string;
  tasks: PrototypeTaskShortcut[];
}

interface PrototypeShellRightPanel {
  ariaLabel: string;
  content: ReactNode;
  header: ReactNode;
}

const navigation: Array<{ icon: ShellIconName; label: string; active?: boolean }> = [
  { icon: "overview", label: "Overview" },
  { icon: "inbox", label: "Inbox" },
  { icon: "list", label: "Tasks", active: true },
  { icon: "repository", label: "Runtimes" },
];

const projectGroups: PrototypeProjectGroup[] = [
  {
    name: "Mystra",
    tasks: [
      { id: "MYS-118", name: "Navigation task workbench", status: "in_progress" },
      { id: "MYS-114", name: "Overview review", status: "blocked" },
    ],
  },
  {
    name: "Castrel AI",
    tasks: [{ id: "CAS-62", name: "Repair provider health", status: "blocked" }],
  },
  {
    name: "No project",
    tasks: [{ id: "MYS-109", name: "Draft release notes", status: "pending" }],
  },
];

export function PrototypeShell({
  breadcrumbItems,
  children,
  headerActions,
  onNewTask,
  onSearch,
  rightPanel,
  title,
}: {
  breadcrumbItems?: readonly UiBreadcrumbItem[];
  children: ReactNode;
  headerActions?: ReactNode;
  onNewTask: () => void;
  onSearch: () => void;
  rightPanel?: PrototypeShellRightPanel;
  title?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const rightPanelVisible = Boolean(rightPanel && !rightPanelCollapsed);

  return (
    <div className={`appShell prototypeShell ${collapsed ? "sidebarCollapsed" : ""} ${rightPanelVisible ? "hasRightPanel" : ""}`}>
      <aside aria-hidden={collapsed || undefined} className="sidebar" data-collapsed={collapsed || undefined}>
        <header className="sidebarHeader prototypeSidebarHeader">
          <MystraLogo className="brandMark" title="Mystra" />
          <span className="brandText">Mystra</span>
          <div className="prototypeHeaderActions">
            <UiIconButton aria-label="New Task" onClick={onNewTask} size="compact" title="New Task"><ShellIcon name="plus" /></UiIconButton>
            <UiIconButton aria-label="Search" onClick={onSearch} size="compact" title="Search"><ShellIcon name="search" /></UiIconButton>
          </div>
          <SidebarIconButton aria-label="Collapse sidebar" icon="collapse" onClick={() => setCollapsed(true)} title="Collapse sidebar" />
        </header>

        <div className="sidebarContent">
          <nav aria-label="Primary navigation" className="sidebarNav">
            {navigation.map((item) => (
              <VerticalNavItem active={Boolean(item.active)} ariaLabel={item.label} className="navItem" key={item.label}>
                <SidebarIcon name={item.icon} />
                <span>{item.label}</span>
                {item.label === "Inbox" ? <span className="sidebarBadge">3</span> : null}
              </VerticalNavItem>
            ))}
          </nav>

          <section aria-labelledby="prototype-projects" className="sidebarProjectSection">
            <div className="sidebarSectionHeader"><h2 id="prototype-projects">Projects</h2></div>
            <div className="sidebarProjectList">
              {projectGroups.slice(0, 2).map((group) => (
                <UiActionAnchor block className="sidebarProject" href="#" key={group.name} onClick={(event) => event.preventDefault()}>
                  <SidebarMark /><span>{group.name}</span>
                </UiActionAnchor>
              ))}
            </div>
          </section>

          <section aria-labelledby="prototype-active-tasks" className="sidebarTaskSection">
            <div className="sidebarSectionHeader"><h2 id="prototype-active-tasks">Active Tasks</h2></div>
            <div className="sidebarTaskScroll">
              {projectGroups.map((group) => (
                <div className="taskProjectGroup" key={group.name}>
                  <div className="taskProjectHeader"><SidebarMark /><span>{group.name}</span></div>
                  <div className="projectTaskList">
                    {group.tasks.map((task) => (
                      <UiActionAnchor block className="sidebarTask" href={`/054-navigation-task-workbench/tasks/${encodeURIComponent(task.id)}`} key={task.id}>
                        <span className="sidebarVisual" data-visual="status"><TaskStatusIcon status={task.status} /></span>
                        <span>{task.name}</span>
                      </UiActionAnchor>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <VerticalNavItem ariaLabel="Settings" className="navItem settingsButton">
            <SidebarIcon name="settings" /><span>Settings</span>
          </VerticalNavItem>
        </div>
      </aside>

      <main className="shellMain">
        <header className="shellHeader prototypeShellHeader">
          <div className="collapsedHeaderInset">
            <MystraLogo className="brandMark" />
            <span className="collapsedHeaderBrand">Mystra</span>
            <UiIconButton aria-label="New Task" className="collapsedHeaderAction" onClick={onNewTask} title="New Task"><ShellIcon name="plus" /></UiIconButton>
            <UiIconButton aria-label="Search" className="collapsedHeaderAction" onClick={onSearch} title="Search"><ShellIcon name="search" /></UiIconButton>
            <UiIconButton aria-label="Expand sidebar" className="collapsedHeaderAction" onClick={() => setCollapsed(false)} title="Expand sidebar"><ShellIcon name="expand" /></UiIconButton>
          </div>
          {breadcrumbItems?.length ? <UiBreadcrumb items={breadcrumbItems} /> : title ? <strong>{title}</strong> : null}
          {headerActions || (rightPanel && rightPanelCollapsed) ? (
            <div className="shellHeaderControls">
              {headerActions}
              {rightPanel && rightPanelCollapsed ? (
                <UiRightPanelToggle expanded={false} label="Expand Task details" onToggle={() => setRightPanelCollapsed(false)} />
              ) : null}
            </div>
          ) : null}
        </header>
        <div className="shellMainContent">{children}</div>
      </main>

      {rightPanel ? (
        <UiShellRightPanel
          ariaLabel={rightPanel.ariaLabel}
          collapseLabel="Collapse Task details"
          header={rightPanel.header}
          hidden={!rightPanelVisible}
          onCollapse={() => setRightPanelCollapsed(true)}
        >
          {rightPanel.content}
        </UiShellRightPanel>
      ) : null}
    </div>
  );
}

export function PrototypeDialog({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="prototypeBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <div aria-label={title} aria-modal="true" onKeyDown={handleDialogKeyDown} role="dialog">{children}</div>
    </div>
  );
}
