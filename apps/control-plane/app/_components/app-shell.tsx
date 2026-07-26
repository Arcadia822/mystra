"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  applyThemeToDocument,
  CONTROL_PLANE_THEMES,
  getDefaultTheme,
  getThemeById,
} from "../theme-system";

const THEME_STORAGE_KEY = "mystra-control-plane-theme";

const NAV_ITEMS = [
  { href: "/", label: "Control Plane", icon: "C" },
  { href: "/runners", label: "Runners", icon: "R" },
  { href: "/tasks", label: "Tasks", icon: "T" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function routeTitle(pathname: string): string {
  if (pathname.startsWith("/runners/")) return "Runner detail";
  if (pathname === "/runners") return "Runners";
  if (pathname.startsWith("/tasks/")) return "Task detail";
  if (pathname === "/tasks") return "Tasks";
  return "Control Plane";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState(getDefaultTheme().id);
  const theme = useMemo(() => getThemeById(themeId) ?? getDefaultTheme(), [themeId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && getThemeById(saved)) setThemeId(saved);
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.id);
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <span aria-hidden="true" className="brandMark">M</span>
          <span className="sidebarLabel">Mystra</span>
        </div>
        <nav aria-label="Primary navigation" className="sidebarNav">
          {NAV_ITEMS.map((item) => (
            <Link
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`navItem ${isActive(pathname, item.href) ? "selected" : ""}`}
              href={item.href}
              key={item.href}
            >
              <span aria-hidden="true" className="navIcon">{item.icon}</span>
              <span className="sidebarLabel">{item.label}</span>
            </Link>
          ))}
        </nav>
        <button className="navItem settingsButton" type="button" onClick={() => setSettingsOpen(true)}>
          <span aria-hidden="true" className="navIcon">S</span>
          <span className="sidebarLabel">Settings</span>
        </button>
      </aside>
      <main className="shellMain">
        <header className="shellHeader">
          <strong>{routeTitle(pathname)}</strong>
          <span className="shellEnvironment">local control plane</span>
        </header>
        {children}
      </main>
      {settingsOpen ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section
            aria-labelledby="settings-title"
            aria-modal="true"
            className="settingsModal"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panelHeader">
              <h2 id="settings-title">Settings</h2>
              <button
                aria-label="Close settings"
                autoFocus
                className="iconButton"
                type="button"
                onClick={() => setSettingsOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="settingsBody">
              <fieldset>
                <legend>Theme</legend>
                <div className="themeOptions">
                  {CONTROL_PLANE_THEMES.map((option) => (
                    <label className="themeChoice" key={option.id}>
                      <input
                        checked={theme.id === option.id}
                        name="theme"
                        type="radio"
                        value={option.id}
                        onChange={() => setThemeId(option.id)}
                      />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
