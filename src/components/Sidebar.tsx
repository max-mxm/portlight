import { Laptop, Monitor, Moon, Radio, Search, Sun } from "lucide-react";
import type { Service, ThemePreference, View } from "../types";
import { views } from "../navigation";
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
}
const themes = [
  { id: "system", name: "Système", icon: Monitor },
  { id: "light", name: "Clair", icon: Sun },
  { id: "dark", name: "Sombre", icon: Moon },
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
}: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Radio aria-hidden="true" size={22} />
        </div>
        <div>
          Portlight<span>LOCAL, SOUS CONTRÔLE.</span>
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
        <span>Action rapide</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className="nav-label">ESPACE DE TRAVAIL</div>
      <nav aria-label="Navigation principale">
        {views.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${view === id ? "active" : ""}`}
            aria-current={view === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{name}</span>
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
        PROJETS <span>{projects.length}</span>
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
          <p className="sidebar-empty">
            Les projets apparaîtront ici après le premier relevé.
          </p>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="local-machine">
          <Laptop aria-hidden="true" size={19} />
          <div>
            Ce Mac<span>Tout reste sur votre machine</span>
          </div>
          <span className="dot green" />
        </div>
        <div className="theme-switch" role="group" aria-label="Thème">
          {themes.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              aria-pressed={theme === id}
              title={
                id === "system" ? "Suivre le thème de macOS" : `Thème ${name}`
              }
              onClick={() => setTheme(id)}
            >
              <Icon aria-hidden="true" size={14} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
