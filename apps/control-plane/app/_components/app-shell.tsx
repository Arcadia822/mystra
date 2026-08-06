"use client";

import type { Project } from "@mystra/shared";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { TaskListItem } from "../_lib/types";
import { useResource } from "../_lib/use-resource";
import {
  applyThemeToDocument,
  getDefaultTheme,
  getThemeById,
  THEME_STORAGE_KEY,
} from "../theme-system";
import { SHELL_COPY, type ShellLocale } from "./shell-copy";
import { groupTasksByProject, inboxTasks } from "./shell-model";
import { ShellIcon, type ShellIconName } from "./shell-icons";
import { ShellSearchDialog } from "./shell-search-dialog";
import { ShellSettings, type SettingsSection } from "./shell-settings";
import { ShellTasksProvider } from "./shell-resources";
import { MystraLogo } from "./mystra-logo";
import { UiActionLink, UiButton, UiIconButton } from "./ui-actions";
import { ProjectCreateModal } from "./project-create-modal";

const LANGUAGE_STORAGE_KEY = "mystra-control-plane-language";
const SIDEBAR_STORAGE_KEY = "mystra-control-plane-sidebar-collapsed";

type UtilityView = "automations" | null;

const PRIMARY_ITEMS: Array<{
  key: "new" | "search" | "inbox" | "issues" | "automations";
  icon: ShellIconName;
  href?: string;
}> = [
  { key: "new", icon: "new", href: "/" },
  { key: "search", icon: "search" },
  { key: "inbox", icon: "inbox", href: "/inbox" },
  { key: "issues", icon: "issue", href: "/tasks" },
  { key: "automations", icon: "automation" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
function routeTitle(pathname: string, locale: ShellLocale): string {
  const zh = locale === "zh-CN";
  if (pathname.startsWith("/runners/")) return zh ? "Runner 详情" : "Runner detail";
  if (pathname === "/runners") return "Runners";
  if (pathname.startsWith("/sessions/")) return zh ? "Session 详情" : "Session detail";
  if (pathname.startsWith("/tasks/")) return zh ? "Task 详情" : "Task detail";
  if (pathname === "/tasks") return zh ? "议题" : "Issues";
  if (pathname === "/inbox") return zh ? "收件箱" : "Inbox";
  if (pathname.startsWith("/projects/")) return zh ? "Project 详情" : "Project detail";
  if (pathname === "/projects") return "Projects";
  return zh ? "新建" : "New";
}

function taskStatus(state?: string): { icon: ShellIconName; kind: string; label: string } {
  if (!state) return { icon: "circle", kind: "idle", label: "No Sessions" };
  if (["assigned", "starting", "running"].includes(state)) {
    return { icon: "spinner", kind: "active", label: state.replaceAll("_", " ") };
  }
  if (state === "waiting_for_review") return { icon: "review", kind: "review", label: "waiting for review" };
  if (state === "succeeded") return { icon: "check", kind: "success", label: "succeeded" };
  if (["failed", "canceled", "timed_out"].includes(state)) {
    return { icon: "alert", kind: "error", label: state.replaceAll("_", " ") };
  }
  return { icon: "circle", kind: "queued", label: state.replaceAll("_", " ") };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tasksResource = useResource<{ tasks: TaskListItem[] }>("/api/tasks", 3_000);
  const projectsResource = useResource<{ projects: Project[] }>("/api/projects", 10_000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("account");
  const [themeId, setThemeId] = useState(getDefaultTheme().id);
  const [locale, setLocale] = useState<ShellLocale>("en");
  const [utilityView, setUtilityView] = useState<UtilityView>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [narrowSidebarOpen, setNarrowSidebarOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const theme = useMemo(() => getThemeById(themeId) ?? getDefaultTheme(), [themeId]);
  const copy = SHELL_COPY[locale];

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedTheme && getThemeById(savedTheme)) setThemeId(savedTheme);
    if (savedLanguage === "en" || savedLanguage === "zh-CN") setLocale(savedLanguage);
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    setPreferencesReady(true);
  }, []);

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
    applyThemeToDocument(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  }, [preferencesReady, theme]);

  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.lang = locale;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  }, [locale, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
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
    setUtilityView(null);
    setNarrowSidebarOpen(false);
  }, [pathname]);

  const projectById = useMemo(
    () => new Map((projectsResource.data?.projects ?? []).map((project) => [project.id, project])),
    [projectsResource.data?.projects],
  );

  const taskGroups = useMemo(() => groupTasksByProject(tasksResource.data?.tasks ?? []).map((group) => ({
      project: projectById.get(group.projectId),
      ...group,
    })), [projectById, tasksResource.data?.tasks]);

  const inboxCount = inboxTasks(tasksResource.data?.tasks ?? []).length;
  const shellTitle = utilityView ? copy[utilityView] : routeTitle(pathname, locale);
  const sidebarHidden = isNarrow ? !narrowSidebarOpen : sidebarCollapsed;

  return (
    <ShellTasksProvider resource={tasksResource}>
    <div className={`appShell ${sidebarCollapsed ? "sidebarCollapsed" : ""} ${narrowSidebarOpen ? "sidebarNarrowOpen" : ""}`}>
      <aside aria-hidden={sidebarHidden || undefined} className="sidebar" data-collapsed={sidebarHidden || undefined} id="primary-sidebar" inert={sidebarHidden}>
        <div className="sidebarHeader">
          <MystraLogo className="brandMark" />
          <span className="sidebarLabel brandText">Mystra</span>
          <UiIconButton
            aria-controls="primary-sidebar"
            aria-label={isNarrow ? copy.collapseSidebar : sidebarCollapsed ? copy.expandSidebar : copy.collapseSidebar}
            aria-expanded={isNarrow ? narrowSidebarOpen : !sidebarCollapsed}
            className="sidebarToggle"
            size="compact"
            onClick={() => isNarrow ? setNarrowSidebarOpen(false) : setSidebarCollapsed((current) => !current)}
          >
            <ShellIcon name={isNarrow ? "collapse" : sidebarCollapsed ? "expand" : "collapse"} />
          </UiIconButton>
        </div>

        <nav aria-label="Primary navigation" className="sidebarNav">
          {PRIMARY_ITEMS.map((item) => {
            const label = copy[item.key];
            const active = item.href
              ? utilityView === null && isActive(pathname, item.href)
              : item.key === "search" ? searchOpen : utilityView === item.key;
            const content = (
              <>
                <span className="navIcon"><ShellIcon name={item.icon} /></span>
                <span className="sidebarLabel">{label}</span>
                {item.key === "inbox" ? <span className="sidebarBadge">{inboxCount}</span> : null}
              </>
            );

            return item.href ? (
              <UiActionLink active={active} aria-current={active ? "page" : undefined} aria-label={label} block className="navItem" href={item.href} key={item.key}>
                {content}
              </UiActionLink>
            ) : (
              <UiButton active={active} aria-label={label} block className="navItem" key={item.key} onClick={() => {
                setNarrowSidebarOpen(false);
                if (item.key === "search") setSearchOpen(true);
                else setUtilityView(item.key as UtilityView);
              }}>
                {content}
              </UiButton>
            );
          })}
        </nav>

        <section aria-labelledby="sidebar-projects-title" className="sidebarProjectSection">
          <div className="sidebarSectionHeader">
            <h2 id="sidebar-projects-title">{copy.projects}</h2>
            <UiIconButton
              aria-label={locale === "zh-CN" ? "添加项目" : "Add project"}
              className="sidebarSectionAction"
              size="compact"
              title={locale === "zh-CN" ? "添加项目" : "Add project"}
              onClick={() => {
                setSettingsOpen(false);
                setProjectCreateOpen(true);
              }}
            >
              <ShellIcon name="plus" />
            </UiIconButton>
          </div>
          <div className="sidebarProjectList">
            {(projectsResource.data?.projects ?? []).map((project) => (
              <UiActionLink active={pathname === `/projects/${project.slug}`} block className="sidebarProject" href={`/projects/${encodeURIComponent(project.slug)}`} key={project.id}>
                <span className="navIcon"><ShellIcon name="project" /></span>
                <span>{project.name}</span>
              </UiActionLink>
            ))}
          </div>
        </section>

        <section aria-labelledby="sidebar-tasks-title" className="sidebarTaskSection">
          <div className="sidebarSectionHeader">
            <h2 id="sidebar-tasks-title">{copy.tasks}</h2>
          </div>
          <div className="sidebarTaskScroll">
            {taskGroups.map((group) => (
              <div className="taskProjectGroup" key={group.projectId}>
                {group.project ? (
                  <UiActionLink block className="taskProjectHeader" href={`/projects/${encodeURIComponent(group.project.slug)}`}>
                    <span aria-hidden="true" className="projectMark" />
                    <span>{group.project.name}</span>
                  </UiActionLink>
                ) : (
                  <div className="taskProjectHeader">
                    <span aria-hidden="true" className="projectMark" />
                    <span>{group.tasks[0]?.repository.fullName ?? group.projectId}</span>
                  </div>
                )}
                <div className="projectTaskList">
                  {group.tasks.map((task) => {
                    const status = taskStatus(task.latestSession?.state);
                    return (
                      <UiActionLink active={pathname === `/tasks/${task.id}`} block className="sidebarTask" href={`/tasks/${task.id}`} key={task.id}>
                        <span aria-label={status.label} className="taskStatusIcon" data-status={status.kind} role="img" title={status.label}>
                          <ShellIcon name={status.icon} />
                        </span>
                        <span>{task.issue?.title ?? task.objective}</span>
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

        <UiButton aria-label={copy.settings} block className="navItem settingsButton" onClick={() => {
          setSettingsSection("account");
          setSettingsOpen(true);
        }}>
          <span className="navIcon"><ShellIcon name="settings" /></span>
          <span className="sidebarLabel">{copy.settings}</span>
        </UiButton>
      </aside>

      <main className="shellMain">
        <header className="shellHeader">
          <div className="collapsedHeaderInset">
              <MystraLogo className="brandMark" />
              <span className="collapsedHeaderBrand">Mystra</span>
              <UiActionLink aria-label={copy.new} className="collapsedHeaderAction" href="/" iconOnly title={copy.new}>
                <ShellIcon name="new" />
              </UiActionLink>
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
          <strong>{shellTitle}</strong>
        </header>
        {children}
      </main>

      {settingsOpen ? (
        <ShellSettings
          initialSection={settingsSection}
          locale={locale}
          onClose={() => setSettingsOpen(false)}
          onLocaleChange={setLocale}
          onThemeChange={setThemeId}
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
      <ShellSearchDialog
        actionsLabel={copy.actions}
        closeLabel={copy.closeSearch}
        emptyLabel={copy.noSearchResults}
        locale={locale}
        newTaskLabel={copy.newTask}
        noTasksLabel={copy.noTasksToSearch}
        onClose={() => setSearchOpen(false)}
        open={searchOpen}
        openTaskLabel={copy.openTask}
        placeholder={copy.searchPlaceholder}
        previewEmptyLabel={copy.previewSearch}
        repositoryLabel={copy.repository}
        sessionsLabel={copy.sessions}
        showAllLabel={copy.showAll}
        tasks={tasksResource.data?.tasks ?? []}
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
  );
}
