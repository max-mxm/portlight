import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  Command,
  Laptop,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import * as api from "./api";
import type { Activity, Service, Snapshot, View } from "./types";
import { isOld, visibleServices } from "./services";
import { views, titles } from "./navigation";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./components/Overview";
import { ServicesPanel } from "./components/ServicesPanel";
import { ActivityPanel } from "./components/ActivityPanel";
import { ServiceDetails } from "./components/ServiceDetails";
import { StopConfirmation } from "./components/StopConfirmation";
import { CommandPalette } from "./components/CommandPalette";

function readHistory(): Activity[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("portlight.history") ?? "[]",
    );
    return Array.isArray(value)
      ? value
          .filter(
            (item): item is Activity =>
              typeof item?.id === "string" &&
              typeof item?.name === "string" &&
              Array.isArray(item?.ports) &&
              item.ports.every((port: unknown) => typeof port === "number") &&
              typeof item?.at === "number" &&
              typeof item?.message === "string" &&
              typeof item?.success === "boolean",
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [paused, setPaused] = useState(false);
  const [details, setDetails] = useState<Service | null>(null);
  const [confirm, setConfirm] = useState<{
    service: Service;
    force: boolean;
  } | null>(null);
  const [resistant, setResistant] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [activity, setActivity] = useState<Activity[]>(readHistory);
  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(
    () => localStorage.getItem("portlight.theme") === "dark",
  );
  const [sort, setSort] = useState<"project" | "age">("project");
  const [now, setNow] = useState(Date.now());
  const scanning = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const services = snapshot?.services ?? [];
  const devServices = services.filter(
    (s) => s.kind === "process" || s.kind === "docker",
  );
  const oldServices = services.filter(isOld);
  const projects = [...new Set(devServices.map((s) => s.project))].sort();
  const ports = new Set(devServices.flatMap((s) => s.ports));
  const refresh = useCallback(async () => {
    if (!api.native || scanning.current) return;
    scanning.current = true;
    setLoading(true);
    try {
      setSnapshot(await api.scan());
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      scanning.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!paused && !busy && document.visibilityState === "visible")
        void refresh();
    }, 10000);
    const visible = () => {
      if (!paused && !busy && document.visibilityState === "visible")
        void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [paused, busy, refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("portlight.theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    localStorage.setItem("portlight.history", JSON.stringify(activity));
  }, [activity]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        setPaletteQuery("");
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        void refresh();
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refresh]);
  const visible = visibleServices(services, view, query, project);
  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    const items = [...visible].sort((a, b) =>
      sort === "age"
        ? b.elapsedSeconds - a.elapsedSeconds
        : a.project.localeCompare(b.project) || a.ports[0] - b.ports[0],
    );
    for (const s of items) {
      const key = sort === "age" ? "Par durée d’activité" : s.project;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [visible, sort]);
  function navigate(next: View) {
    setView(next);
    setProject("");
    setQuery("");
  }
  async function open(s: Service, port: number) {
    try {
      await api.openPort(s.id, port);
    } catch (e) {
      setToast(String(e));
    }
  }
  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function stop(s: Service, force: boolean) {
    setConfirm(null);
    setBusy(s.id);
    try {
      const result = await api.stop(s.id, force);
      setToast(result.message);
      setActivity((items) =>
        [
          {
            id: crypto.randomUUID(),
            name: s.name,
            ports: s.ports,
            at: Date.now(),
            message: result.message,
            success: result.stopped,
          },
          ...items,
        ].slice(0, 50),
      );
      if (!result.stopped) setResistant((ids) => new Set([...ids, s.id]));
      else {
        setResistant((ids) => {
          const next = new Set(ids);
          next.delete(s.id);
          return next;
        });
        setDetails(null);
      }
      await refresh();
    } catch (e) {
      setToast(String(e));
    } finally {
      setBusy(null);
    }
  }
  const lastScan = snapshot
    ? Math.max(0, Math.floor((now - snapshot.scannedAt) / 1000))
    : null;
  const stale = lastScan !== null && lastScan > 30;
  const paletteItems = devServices.filter((s) =>
    `${s.name} ${s.project} ${s.ports.join(" ")}`
      .toLowerCase()
      .includes(paletteQuery.toLowerCase()),
  );

  return (
    <div className="app-shell">
      <Sidebar
        {...{
          view,
          project,
          projects,
          services,
          devServices,
          oldServices,
          dark,
          navigate,
          setPalette,
          setPaletteQuery,
          setView,
          setProject,
          setQuery,
          setDark,
        }}
      />
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <Laptop aria-hidden="true" size={16} />
            <span>Ce Mac</span>
            <span>/</span>
            <strong>{views.find((v) => v.id === view)?.name}</strong>
          </div>
          <div className="topbar-right">
            <span className={`live-status ${paused || stale ? "muted" : ""}`}>
              <span className={`dot ${paused || stale ? "amber" : "green"}`} />
              {!snapshot
                ? "En attente"
                : paused
                  ? "Actualisation en pause"
                  : stale
                    ? "Relevé ancien"
                    : "Actualisation auto"}
            </span>
            <button
              className="icon-button"
              aria-label={
                paused
                  ? "Reprendre l’actualisation"
                  : "Mettre l’actualisation en pause"
              }
              onClick={() => setPaused(!paused)}
            >
              {paused ? (
                <Play aria-hidden="true" size={15} />
              ) : (
                <Pause aria-hidden="true" size={15} />
              )}
            </button>
          </div>
        </header>
        <div className="main-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">VOTRE ENVIRONNEMENT LOCAL</div>
              <h1>{titles[view].title}</h1>
              <p>{titles[view].description}</p>
            </div>
            <button
              className="refresh-button"
              onClick={() => void refresh()}
              disabled={loading || !api.native}
            >
              <RefreshCw
                aria-hidden="true"
                size={16}
                className={loading ? "spin" : ""}
              />
              {loading ? "Analyse…" : "Actualiser"}
              <kbd>⌘ R</kbd>
            </button>
          </section>
          {!api.native && (
            <div className="notice warning-notice">
              <TriangleAlert aria-hidden="true" size={18} />
              <div>
                <strong>
                  Ouvrez l’application Mac pour analyser vos ports.
                </strong>
                <p>
                  Cette page est l’interface web. Lancez{" "}
                  <code>npm run app:dev</code> ou ouvrez Portlight.app pour
                  accéder aux processus locaux.
                </p>
              </div>
            </div>
          )}
          {error && (
            <div className="notice error-notice" role="alert">
              <TriangleAlert aria-hidden="true" size={18} />
              <div>
                <strong>Le relevé n’a pas abouti.</strong>
                <p>{error}</p>
              </div>
              <button onClick={() => void refresh()}>Réessayer</button>
            </div>
          )}
          {snapshot?.warnings.map((w) => (
            <div className="notice warning-notice" key={w}>
              <TriangleAlert aria-hidden="true" size={18} />
              <p>{w}</p>
            </div>
          ))}
          {view !== "history" && (
            <>
              <Overview
                {...{ snapshot, ports, services, oldServices, view, navigate }}
              />
              <ServicesPanel
                {...{
                  project,
                  view,
                  visible,
                  query,
                  setQuery,
                  searchRef,
                  sort,
                  setSort,
                  loading,
                  snapshot,
                  groups,
                  busy,
                  setDetails,
                  setConfirm,
                  open,
                }}
              />
              <div className="access-legend">
                <span>
                  <span className="dot green" />
                  Local : accessible depuis ce Mac
                </span>
                <span>
                  <span className="dot amber" />
                  Réseau : écoute sur toutes les interfaces, selon le pare-feu
                </span>
              </div>
            </>
          )}
          {view === "history" && (
            <ActivityPanel {...{ activity, setActivity }} />
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck aria-hidden="true" size={14} />
              Sans serveur · Sans compte · Sur votre Mac
            </span>
            <button className="text-button" onClick={() => setPalette(true)}>
              <Command aria-hidden="true" size={13} />
              Les actions au bout des doigts <kbd>⌘ K</kbd>
            </button>
          </footer>
        </div>
      </main>
      {details && (
        <ServiceDetails
          {...{ details, setDetails, resistant, busy, setConfirm, copy }}
        />
      )}
      {confirm && <StopConfirmation {...{ confirm, setConfirm, stop }} />}
      {palette && (
        <CommandPalette
          {...{
            setPalette,
            paletteQuery,
            setPaletteQuery,
            paletteItems,
            refresh,
            setConfirm,
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <ActivityIcon aria-hidden="true" size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Fermer la notification"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
