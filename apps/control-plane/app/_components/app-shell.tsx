"use client";

import type { Project, TaskWorkbenchPage } from "@mystra/shared";
import { TaskStatusIcon, UiBreadcrumb } from "@mystra/ui";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { taskTitle } from "../_lib/task-view";
import { useResource } from "../_lib/use-resource";
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearanceToDocument,
  getAppearanceDetailDefaults,
  getDefaultAppearancePreferences,
  getThemeById,
  normalizeAppearancePreferences,
  parseAppearancePreferences,
  resolveAppearanceTheme,
  THEME_STORAGE_KEY,
  type AppearancePreferences,
  type ThemeVariant,
} from "../theme-system";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { activeTasks, groupTasksByProject, inboxTasks } from "./shell-model";
import { ShellIcon } from "./shell-icons";
import { ShellSearchDialog } from "./shell-search-dialog";
import { ShellSettings, type SettingsSection } from "./shell-settings";
import { ShellTasksProvider } from "./shell-resources";
import { ShellLocaleProvider } from "./shell-locale";
import { ShellMainHeaderProvider } from "./shell-main-header";
import { PRIMARY_ITEMS } from "./shell-navigation";
import { ShellRightPanelProvider } from "./shell-right-panel";
import { MystraLogo } from "./mystra-logo";
import { NewTaskDialog } from "./new-task-dialog";
import { UiActionLink, UiButton, UiIconButton } from "./ui-actions";
import { UiRightPanelToggle, UiShellRightPanel } from "./ui-surfaces";
import { ProjectCreateModal } from "./project-create-modal";
import { VerticalNavItem } from "./vertical-nav-item";
import {
  SidebarCountBadge,
  SidebarIcon,
  SidebarIconButton,
  SidebarMark,
} from "./sidebar-visual";

const LANGUAGE_STORAGE_KEY = "mystra-control-plane-language";
const SIDEBAR_STORAGE_KEY = "mystra-control-plane-sidebar-collapsed";

function readBrowserPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeBrowserPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences remain usable for the current tab when browser storage is unavailable.
  }
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
function routeTitle(pathname: string, locale: ShellLocale): string {
  const zh = locale === "zh-CN";
  if (pathname.startsWith("/runners/")) return zh ? "运行环境详情" : "Runtime detail";
  if (pathname === "/runners") return zh ? "运行环境" : "Runtimes";
  if (pathname.startsWith("/sessions/")) return zh ? "Session 详情" : "Session detail";
  if (pathname === "/automations") return zh ? "自动化" : "Automations";
  if (pathname.startsWith("/skills/")) return zh ? "Skill 详情" : "Skill detail";
  if (pathname === "/skills") return zh ? "Skills" : "Skills";
  if (pathname.startsWith("/tasks/")) return zh ? "Task 详情" : "Task detail";
  if (pathname === "/issues") return zh ? "议题" : "Issues";
  if (pathname === "/tasks") return zh ? "任务" : "Tasks";
  if (pathname === "/inbox") return zh ? "收件箱" : "Inbox";
  if (pathname.startsWith("/projects/")) return zh ? "Project 详情" : "Project detail";
  if (pathname === "/projects") return "Projects";
  return zh ? "概览" : "Overview";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tasksResource = useResource<TaskWorkbenchPage>("/api/tasks?limit=100", 3_000);
  const projectsResource = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const sidebarNewTaskRef = useRef<HTMLButtonElement>(null);
  const collapsedNewTaskRef = useRef<HTMLButtonElement>(null);
  const newTaskReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("account");
  const [appearance, setAppearance] = useState<AppearancePreferences>(getDefaultAppearancePreferences);
  const [systemVariant, setSystemVariant] = useState<ThemeVariant>("dark");
  const [locale, setLocale] = useState<ShellLocale>("en");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsedRightPanelId, setCollapsedRightPanelId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [narrowSidebarOpen, setNarrowSidebarOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const theme = useMemo(() => resolveAppearanceTheme(appearance, systemVariant), [appearance, systemVariant]);
  const copy = SHELL_COPY[locale];

  useEffect(() => {
    const savedAppearance = readBrowserPreference(APPEARANCE_STORAGE_KEY);
    const savedTheme = readBrowserPreference(THEME_STORAGE_KEY);
    const savedLanguage = readBrowserPreference(LANGUAGE_STORAGE_KEY);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemVariant(media.matches ? "dark" : "light");
    if (savedAppearance) {
      setAppearance(parseAppearancePreferences(savedAppearance));
    } else if (savedTheme) {
      const legacyTheme = getThemeById(savedTheme);
      if (legacyTheme) {
        setAppearance(normalizeAppearancePreferences({
          ...getDefaultAppearancePreferences(),
          mode: legacyTheme.variant,
          [`${legacyTheme.variant}ThemeId`]: legacyTheme.codeThemeId,
        }));
      }
    }
    if (savedLanguage === "en" || savedLanguage === "zh-CN") setLocale(savedLanguage);
    setSidebarCollapsed(readBrowserPreference(SIDEBAR_STORAGE_KEY) === "true");
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    setCollapsedRightPanelId(null);
  }, [pathname]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("settings") !== "integrations") return;
    setSettingsSection("integrations");
    setSettingsOpen(true);
    url.searchParams.delete("settings");
    url.searchParams.delete("github");
    url.searchParams.delete("reason");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    const normalized = normalizeAppearancePreferences(appearance);
    applyAppearanceToDocument(normalized, systemVariant);
    writeBrowserPreference(APPEARANCE_STORAGE_KEY, JSON.stringify(normalized));
  }, [appearance, preferencesReady, systemVariant]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemVariant(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.lang = locale;
    writeBrowserPreference(LANGUAGE_STORAGE_KEY, locale);
  }, [locale, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    writeBrowserPreference(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [preferencesReady, sidebarCollapsed]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const update = () => {
      setIsNarrow(media.matches);
      if (media.matches) setNarrowSidebarOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!narrowSidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNarrowSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [narrowSidebarOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  useEffect(() => {
    setNarrowSidebarOpen(false);
  }, [pathname]);

  const projectById = useMemo(
    () => new Map((projectsResource.data?.projects ?? []).map((project) => [project.id, project])),
    [projectsResource.data?.projects],
  );

  const taskGroups = useMemo(() => groupTasksByProject(activeTasks(tasksResource.data?.items ?? [])).map((group) => ({
      project: group.projectId ? projectById.get(group.projectId) : undefined,
      ...group,
    })), [projectById, tasksResource.data?.items]);

  const inboxCount = inboxTasks(tasksResource.data?.items ?? []).length;
  const shellTitle = routeTitle(pathname, locale);
  const sidebarHidden = isNarrow ? !narrowSidebarOpen : sidebarCollapsed;

  return (
    <ShellMainHeaderProvider>
    {(mainHeader) => (
    <ShellRightPanelProvider>
    {(rightPanel) => {
    const rightPanelCollapsed = Boolean(rightPanel && collapsedRightPanelId === rightPanel.id);
    const rightPanelVisible = Boolean(rightPanel && !rightPanelCollapsed);
    return (
    <ShellLocaleProvider locale={locale}>
    <ShellTasksProvider resource={tasksResource}>
    <div className={`appShell ${sidebarCollapsed ? "sidebarCollapsed" : ""} ${narrowSidebarOpen ? "sidebarNarrowOpen" : ""} ${rightPanelVisible ? "hasRightPanel" : ""}`}>
      <aside aria-hidden={sidebarHidden || undefined} className="sidebar" data-collapsed={sidebarHidden || undefined} id="primary-sidebar" inert={sidebarHidden}>
        <header className="sidebarHeader">
          <MystraLogo className="brandMark" />
          <span className="sidebarLabel brandText">Mystra</span>
          <div className="sidebarHeaderActions">
            <UiIconButton aria-label={copy.newTask} onClick={(event) => { newTaskReturnFocusRef.current = event.currentTarget; setSearchOpen(false); setNewTaskOpen(true); }} ref={sidebarNewTaskRef} title={copy.newTask}>
              <ShellIcon name="plus" />
            </UiIconButton>
            <UiIconButton aria-label={copy.search} onClick={() => { setNewTaskOpen(false); setSearchOpen(true); }} title={copy.search}>
              <ShellIcon name="search" />
            </UiIconButton>
          </div>
          <SidebarIconButton
            aria-controls="primary-sidebar"
            aria-label={isNarrow ? copy.collapseSidebar : sidebarCollapsed ? copy.expandSidebar : copy.collapseSidebar}
            aria-expanded={isNarrow ? narrowSidebarOpen : !sidebarCollapsed}
            icon={isNarrow ? "collapse" : sidebarCollapsed ? "expand" : "collapse"}
            onClick={() => isNarrow ? setNarrowSidebarOpen(false) : setSidebarCollapsed((current) => !current)}
          />
        </header>

        <div className="sidebarContent">
        <nav aria-label="Primary navigation" className="sidebarNav">
          {PRIMARY_ITEMS.map((item) => {
            const label = copy[item.key];
            const active = isActive(pathname, item.href);
            const content = (
              <>
                <SidebarIcon name={item.icon} />
                <span className="sidebarLabel">{label}</span>
                {item.key === "inbox" ? <SidebarCountBadge count={inboxCount} /> : null}
              </>
            );

            return (
              <VerticalNavItem
                active={active}
                {...(active ? { ariaCurrent: "page" as const } : {})}
                ariaLabel={label}
                className="navItem"
                href={item.href}
                key={item.key}
                onClick={() => setNarrowSidebarOpen(false)}
              >
                {content}
              </VerticalNavItem>
            );
          })}
        </nav>
        <section aria-labelledby="sidebar-projects-title" className="sidebarProjectSection">
          <div className="sidebarSectionHeader">
            <h2 id="sidebar-projects-title">{copy.projects}</h2>
            <SidebarIconButton
              aria-label={locale === "zh-CN" ? "添加项目" : "Add project"}
              icon="plus"
              title={locale === "zh-CN" ? "添加项目" : "Add project"}
              onClick={() => {
                setSettingsOpen(false);
                setProjectCreateOpen(true);
              }}
            />
          </div>
          <div className="sidebarProjectList">
            {(projectsResource.data?.projects ?? []).map((project) => (
              <UiActionLink active={pathname === `/projects/${project.slug}`} block className="sidebarProject" href={`/projects/${encodeURIComponent(project.slug)}`} key={project.id}>
                <SidebarIcon name="project" />
                <span>{project.name}</span>
              </UiActionLink>
            ))}
          </div>
        </section>

        <section aria-labelledby="sidebar-tasks-title" className="sidebarTaskSection">
          <div className="sidebarSectionHeader">
            <h2 id="sidebar-tasks-title">{locale === "zh-CN" ? "活跃 Tasks" : "Active Tasks"}</h2>
          </div>
          <div className="sidebarTaskScroll">
            {taskGroups.map((group) => (
              <div className="taskProjectGroup" key={group.projectId}>
                {group.project ? (
                  <UiActionLink block className="taskProjectHeader" href={`/projects/${encodeURIComponent(group.project.slug)}`}>
                    <SidebarMark />
                    <span>{group.project.repositoryExternalId}</span>
                  </UiActionLink>
                ) : (
                  <div className="taskProjectHeader">
                    <SidebarMark />
                    <span>{locale === "zh-CN" ? "无 Project" : "No project"}</span>
                  </div>
                )}
                <div className="projectTaskList">
                  {group.tasks.map((task) => {
                    return (
                      <UiActionLink active={pathname === `/tasks/${task.id}`} block className="sidebarTask" href={`/tasks/${task.id}`} key={task.id}>
                        <span className="sidebarVisual" data-visual="status"><TaskStatusIcon status={task.status} /></span>
                        <span>{taskTitle(task)}</span>
                      </UiActionLink>
                    );
                  })}
                </div>
              </div>
            ))}
            {!tasksResource.isLoading && taskGroups.length === 0 ? <p className="sidebarEmpty">{copy.noTasks}</p> : null}
            {tasksResource.isLoading ? <p className="sidebarEmpty" aria-live="polite">…</p> : null}
          </div>
        </section>

        <VerticalNavItem ariaLabel={copy.settings} className="navItem settingsButton" onClick={() => {
          setSettingsSection("account");
          setSettingsOpen(true);
        }}>
          <SidebarIcon name="settings" />
          <span className="sidebarLabel">{copy.settings}</span>
        </VerticalNavItem>
        </div>
      </aside>

      <main className="shellMain">
        <header className="shellHeader">
          <div className="collapsedHeaderInset">
              <MystraLogo className="brandMark" />
              <span className="collapsedHeaderBrand">Mystra</span>
              <UiIconButton aria-label={copy.newTask} className="collapsedHeaderAction" onClick={(event) => { newTaskReturnFocusRef.current = event.currentTarget; setSearchOpen(false); setNewTaskOpen(true); }} ref={collapsedNewTaskRef} title={copy.newTask}>
                <ShellIcon name="new" />
              </UiIconButton>
              <UiIconButton aria-label={copy.search} className="collapsedHeaderAction" onClick={() => { setNewTaskOpen(false); setSearchOpen(true); }} title={copy.search}>
                <ShellIcon name="search" />
              </UiIconButton>
              <UiIconButton
                aria-controls="primary-sidebar"
                aria-label={copy.expandSidebar}
                aria-expanded={isNarrow ? narrowSidebarOpen : false}
                className="collapsedHeaderAction"
                title={copy.expandSidebar}
                onClick={() => isNarrow ? setNarrowSidebarOpen(true) : setSidebarCollapsed(false)}
              >
                <ShellIcon name="expand" />
              </UiIconButton>
            </div>
          {mainHeader?.breadcrumbItems ? <UiBreadcrumb items={mainHeader.breadcrumbItems} /> : <strong>{mainHeader?.title ?? shellTitle}</strong>}
          {mainHeader?.actions || (rightPanel && rightPanelCollapsed) ? (
            <div className="shellHeaderControls">
              {mainHeader?.actions}
              {rightPanel && rightPanelCollapsed ? (
              <UiRightPanelToggle
                expanded={false}
                label={locale === "zh-CN" ? `展开${rightPanel.ariaLabel}` : `Expand ${rightPanel.ariaLabel}`}
                onToggle={() => setCollapsedRightPanelId(null)}
              />
              ) : null}
            </div>
          ) : null}
        </header>
        <div className="shellMainContent">{children}</div>
      </main>

      {rightPanel ? (
        <UiShellRightPanel
          ariaLabel={rightPanel.ariaLabel}
          collapseLabel={locale === "zh-CN" ? `收起${rightPanel.ariaLabel}` : `Collapse ${rightPanel.ariaLabel}`}
          header={rightPanel.header}
          hidden={!rightPanelVisible}
          onCollapse={() => setCollapsedRightPanelId(rightPanel.id)}
        >
          {rightPanel.content}
        </UiShellRightPanel>
      ) : null}

      {settingsOpen ? (
        <ShellSettings
          initialSection={settingsSection}
          locale={locale}
          onAppearanceChange={(change) => setAppearance((current) => ({ ...current, ...change }))}
          onClose={() => setSettingsOpen(false)}
          onLocaleChange={setLocale}
          onResetAppearanceDetails={() => setAppearance((current) => ({
            ...current,
            ...getAppearanceDetailDefaults(current, systemVariant),
          }))}
          preferences={appearance}
          systemVariant={systemVariant}
          theme={theme}
        />
      ) : null}
      {projectCreateOpen ? (
        <ProjectCreateModal
          locale={locale}
          onClose={() => setProjectCreateOpen(false)}
          onCreated={projectsResource.refresh}
        />
      ) : null}
      {newTaskOpen ? (
        <NewTaskDialog
          locale={locale}
          onClose={() => setNewTaskOpen(false)}
          onCreated={tasksResource.refresh}
          triggerRef={newTaskReturnFocusRef}
        />
      ) : null}
      <ShellSearchDialog
        actionsLabel={copy.actions}
        closeLabel={copy.closeSearch}
        emptyLabel={copy.noSearchResults}
        locale={locale}
        newTaskLabel={copy.newTask}
        noTasksLabel={copy.noTasksToSearch}
        onClose={() => setSearchOpen(false)}
        onNewTask={() => {
          newTaskReturnFocusRef.current = sidebarHidden ? collapsedNewTaskRef.current : sidebarNewTaskRef.current;
          setNewTaskOpen(true);
        }}
        open={searchOpen}
        openTaskLabel={copy.openTask}
        placeholder={copy.searchPlaceholder}
        previewEmptyLabel={copy.previewSearch}
        repositoryLabel="Project"
        issueLabel={copy.issues}
        showAllLabel={copy.showAll}
        tasks={tasksResource.data?.items ?? []}
        tasksLabel={copy.tasks}
        title={copy.search}
        updatedLabel={copy.updated}
      />
      <UiButton
        aria-label={copy.collapseSidebar}
        className="narrowSidebarBackdrop"
        onClick={() => setNarrowSidebarOpen(false)}
      />
    </div>
    </ShellTasksProvider>
    </ShellLocaleProvider>
    );
    }}
    </ShellRightPanelProvider>
    )}
    </ShellMainHeaderProvider>
  );
}
