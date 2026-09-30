import { Laptop, Monitor, Moon, Radio, Search, Sun } from "lucide-react";
import type { Service, ThemePreference, View } from "../types";
import { native } from "../api";
import { views } from "../navigation";
import { LANGUAGES, useT, type Language } from "../i18n";
interface Props {
  view: View;
  project: string;
  projects: string[];
  services: Service[];
  devServices: Service[];
  oldServices: Service[];
  theme: ThemePreference;
  navigate: (v: View) => void;
  setPalette: (value: boolean) => void;
  setPaletteQuery: (value: string) => void;
  setView: (value: View) => void;
  setProject: (value: string) => void;
  setQuery: (value: string) => void;
  setTheme: (value: ThemePreference) => void;
  language: Language;
  setLanguage: (value: Language) => void;
}
const themes = [
  { id: "system", icon: Monitor },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
] as const;
export function Sidebar({
  view,
  project,
  projects,
  services,
  devServices,
  oldServices,
  theme,
  navigate,
  setPalette,
  setPaletteQuery,
  setView,
  setProject,
  setQuery,
  setTheme,
  language,
  setLanguage,
}: Props) {
  const t = useT();
  return (
    <aside className="sidebar">
      {native && <div className="titlebar-space" data-tauri-drag-region />}
      <div className="brand">
        <div className="brand-mark">
          <Radio aria-hidden="true" size={22} />
        </div>
        <div>
          Portlight<span>{t.sidebar.tagline}</span>
        </div>
      </div>
      <button
        className="command-trigger"
        onClick={() => {
          setPalette(true);
          setPaletteQuery("");
        }}
      >
        <Search aria-hidden="true" size={16} />
        <span>{t.sidebar.quickAction}</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="nav-label">{t.sidebar.workspace}</div>
      <nav aria-label={t.sidebar.navigation}>
        {views.map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? "active" : ""}`}
            aria-current={view === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{t.views[id]}</span>
            {id === "old" && oldServices.length > 0 ? (
              <span className="nav-count warning">{oldServices.length}</span>
            ) : id === "all" || id === "process" || id === "docker" ? (
              <span className="nav-count">
                {id === "all"
                  ? devServices.length
                  : services.filter((s) => s.kind === id).length}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      <div className="nav-label project-label">
        {t.sidebar.projects} <span>{projects.length}</span>
      </div>
      <div className="project-nav">
        {projects.length ? (
          projects.map((p, i) => (
            <button
              key={p}
              className={`project-item ${project === p ? "selected" : ""}`}
              onClick={() => {
                setView("all");
                setProject(project === p ? "" : p);
                setQuery("");
              }}
            >
              <span className={`project-dot color-${i % 4}`} />
              <span>{p}</span>
              <span className="project-count">
                {devServices.filter((s) => s.project === p).length}
              </span>
            </button>
          ))
        ) : (
          <p className="sidebar-empty">{t.sidebar.projectsEmpty}</p>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="local-machine">
          <Laptop aria-hidden="true" size={19} />
          <div>
            {t.common.thisMac}
            <span>{t.sidebar.machineNote}</span>
          </div>
          <span className="dot green" />
        </div>
        <div className="sidebar-switches">
          <div
            className="theme-switch language-switch"
            role="group"
            aria-label={t.settings.language}
          >
            {LANGUAGES.map(({ id, name }) => (
              <button
                key={id}
                lang={id}
                aria-pressed={language === id}
                title={name}
                onClick={() => setLanguage(id)}
              >
                <span>{id.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <div
            className="theme-switch"
            role="group"
            aria-label={t.sidebar.theme}
          >
            {themes.map(({ id, icon: Icon }) => (
              <button
                key={id}
                aria-pressed={theme === id}
                title={
                  id === "system"
                    ? t.sidebar.themeSystemTitle
                    : t.sidebar.themeTitle(t.sidebar.themes[id])
                }
                onClick={() => setTheme(id)}
              >
                <Icon aria-hidden="true" size={15} />
                <span className="sr-only">{t.sidebar.themes[id]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
