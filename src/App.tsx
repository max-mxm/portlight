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
import { heading } from "./navigation";
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
import { I18nProvider, messages, type Language } from "./i18n";

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
  const latestLanguage = useRef(settings.language);
  latestLanguage.current = settings.language;
  const t = messages[settings.language] ?? messages.en;
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);
  async function setLanguage(language: Language) {
    try {
      await saveSettings({ ...settings, language });
      // Protection reasons and warnings come from the backend.
      void refresh();
    } catch (e) {
      setToast(String(e));
    }
  }
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
      else setToast(messages[latestLanguage.current].page.gone);
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
      const key = sort === "age" ? t.page.byAge : s.project;
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return { visible, entries: [...map.entries()] };
  }, [services, view, query, project, reviewHours, sort, t]);
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
            ? t.page.historyGroup(s.name)
            : scope === "compose"
              ? t.page.historyCompose(s.composeProject ?? "")
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
  const page = heading(view, reviewHours, t);

  return (
    <I18nProvider language={settings.language}>
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
            language: settings.language,
            setLanguage,
          }}
        />
        <main>
          <header className="topbar">
            <div className="breadcrumb">
              <Laptop aria-hidden="true" size={16} />
              <span>{t.common.thisMac}</span>
              <span>/</span>
              <strong>{t.views[view]}</strong>
            </div>
            <div className="topbar-right">
              <span className={`live-status ${paused || stale ? "muted" : ""}`}>
                <span
                  className={`dot ${paused || stale ? "amber" : "green"}`}
                />
                {!snapshot
                  ? t.topbar.waiting
                  : paused
                    ? t.topbar.paused
                    : stale
                      ? t.topbar.stale
                      : t.topbar.live}
              </span>
              <button
                className="icon-button"
                aria-label={paused ? t.topbar.resume : t.topbar.pause}
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
                <div className="eyebrow">{t.page.eyebrow}</div>
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
                {loading ? t.page.scanning : t.page.refresh}
                <kbd>⌘ R</kbd>
              </button>
            </section>
            {!api.native && (
              <div className="notice warning-notice">
                <TriangleAlert aria-hidden="true" size={18} />
                <div>
                  <strong>{t.page.webTitle}</strong>
                  <p>
                    {t.page.webBefore}
                    <code>npm run app:dev</code>
                    {t.page.webAfter}
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="notice error-notice" role="alert">
                <TriangleAlert aria-hidden="true" size={18} />
                <div>
                  <strong>{t.page.scanFailed}</strong>
                  <p>{error}</p>
                </div>
                <button onClick={() => void refresh()}>{t.page.retry}</button>
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
                    {t.page.legendLocal}
                  </span>
                  <span>
                    <span className="dot amber" />
                    {t.page.legendNetwork}
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
                setLanguage={(language) => void setLanguage(language)}
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
                {t.page.footer}
              </span>
              <button className="text-button" onClick={() => setPalette(true)}>
                <Command aria-hidden="true" size={13} />
                {t.page.footerActions} <kbd>⌘ K</kbd>
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
              aria-label={t.page.closeNotification}
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        )}
      </div>
    </I18nProvider>
  );
}
