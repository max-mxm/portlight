import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Service, StopRequest, View } from "./types";
import { isOld, resistantKey, visibleServices } from "./services";
import { views, heading } from "./navigation";
import { useInventory } from "./hooks/useInventory";
import { useHistory } from "./hooks/useHistory";
import { useShortcuts } from "./hooks/useShortcuts";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./components/Overview";
import { ServicesPanel } from "./components/ServicesPanel";
import { ActivityPanel } from "./components/ActivityPanel";
import { ServiceDetails } from "./components/ServiceDetails";
import { StopConfirmation } from "./components/StopConfirmation";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPanel } from "./components/SettingsPanel";

export default function App() {
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");
  const [paused, setPaused] = useState(false);
  const [details, setDetails] = useState<Service | null>(null);
  const [confirm, setConfirm] = useState<StopRequest | null>(null);
  const [resistant, setResistant] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [toast, setToast] = useState("");
  const [sort, setSort] = useState<"project" | "age">("project");
  const searchRef = useRef<HTMLInputElement>(null);
  const { snapshot, loading, error, refresh, now, latest } = useInventory({
    paused,
    busy: busy !== null,
  });
  const { activity, record, clear } = useHistory();
  const { preference: theme, setPreference: setTheme } = useTheme();
  const { settings, save: saveSettings } = useSettings();
  const { reviewHours } = settings;
  const services = useMemo(() => snapshot?.services ?? [], [snapshot]);
  const devServices = services.filter(
    (s) => s.kind === "process" || s.kind === "docker",
  );
  const oldServices = services.filter((s) => isOld(s, reviewHours));
  const projects = [...new Set(devServices.map((s) => s.project))].sort();
  const ports = new Set(devServices.flatMap((s) => s.ports));
  useShortcuts({
    palette: () => {
      setPalette((p) => !p);
      setPaletteQuery("");
    },
    refresh: () => void refresh(),
    search: () => searchRef.current?.focus(),
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  // "Arrêter…" from the menu bar: confirm on a fresh inventory.
  useEffect(() => {
    if (!api.native) return;
    const unlisten = api.onConfirmStop(async (id) => {
      const fresh = (await refresh()) ?? latest.current;
      const service = fresh?.services.find((s) => s.id === id);
      if (service) setConfirm({ service, force: false, scope: "service" });
      else setToast("Ce service ne tourne plus. Ses ports sont libérés.");
    });
    return () => void unlisten.then((stop) => stop());
  }, [refresh, latest]);
  const groups = useMemo(() => {
    const visible = visibleServices(
      services,
      view,
      query,
      project,
      reviewHours,
    );
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
    return { visible, entries: [...map.entries()] };
  }, [services, view, query, project, reviewHours, sort]);
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
  async function openFolder(s: Service, editor: string | null) {
    try {
      await api.openFolder(s.id, editor);
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

  async function stop(request: StopRequest) {
    const { service: s, force, scope } = request;
    setConfirm(null);
    setBusy(s.id);
    try {
      const result = await api.stop(s.id, force, scope);
      setToast(result.message);
      const affected =
        scope === "group"
          ? s.launchGroup.flatMap((p) => p.ports)
          : scope === "compose"
            ? services
                .filter((x) => x.composeProject === s.composeProject)
                .flatMap((x) => x.ports)
            : s.ports;
      record({
        name:
          scope === "group"
            ? `${s.name} et son lanceur`
            : scope === "compose"
              ? `Projet Compose ${s.composeProject}`
              : s.name,
        ports: [...new Set(affected)].sort((a, b) => a - b),
        message: result.message,
        success: result.stopped,
      });
      const key = resistantKey(scope, s.id);
      setResistant((ids) => {
        const next = new Set(ids);
        if (result.stopped) next.delete(key);
        else next.add(key);
        return next;
      });
      if (result.stopped) setDetails(null);
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
  const page = heading(view, reviewHours);

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
          theme,
          navigate,
          setPalette,
          setPaletteQuery,
          setView,
          setProject,
          setQuery,
          setTheme,
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
              <h1>{page.title}</h1>
              <p>{page.description}</p>
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
          {view !== "history" && view !== "settings" && (
            <>
              <Overview
                {...{
                  snapshot,
                  ports,
                  services,
                  oldServices,
                  view,
                  navigate,
                  reviewHours,
                }}
              />
              <ServicesPanel
                {...{
                  project,
                  view,
                  visible: groups.visible,
                  query,
                  setQuery,
                  searchRef,
                  sort,
                  setSort,
                  loading,
                  snapshot,
                  groups: groups.entries,
                  busy,
                  setDetails,
                  setConfirm,
                  open,
                  reviewHours,
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
            <ActivityPanel activity={activity} onClear={clear} />
          )}
          {view === "settings" && (
            <SettingsPanel
              settings={settings}
              save={async (next) => {
                const saved = await saveSettings(next);
                void refresh();
                return saved;
              }}
            />
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
          {...{
            details,
            setDetails,
            resistant,
            busy,
            setConfirm,
            copy,
            openFolder,
          }}
          editor={settings.editor}
        />
      )}
      {confirm && <StopConfirmation {...{ confirm, setConfirm, stop }} />}
      {palette && (
        <CommandPalette
          {...{
            setPalette,
            paletteQuery,
            setPaletteQuery,
            services,
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
