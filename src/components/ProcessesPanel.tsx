import { useMemo, useRef, useState } from "react";
import {
  AppWindow,
  ArrowDown,
  ChevronRight,
  Cpu,
  Hand,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import * as api from "../api";
import type { Activity, ProcessInfo, Service } from "../types";
import { useT } from "../i18n";
import { useActivity } from "../hooks/useActivity";
import { cpu, duration, memory } from "../services";
import {
  activityRows,
  allRows,
  holdOrder,
  rowValues,
  selectionTotals,
  type ActivityRow,
  type ActivitySort,
} from "../activity";
import { CpuChart, HeatStrip, heatStep, heatThresholds } from "./ProcessCharts";
import { Modal } from "./Modal";

/** One-line note under a figure, the full text on hover. */
const Note = ({ text }: { text: string }) => <small title={text}>{text}</small>;

/** Rows shown before "Show all": the heaviest ones, like top. */
const TOP = 40;
/** Line of the CPU that no process accounts for. */
const KERNEL = "kernel";

interface Props {
  paused: boolean;
  services: Service[];
  busy: string | null;
  setBusy: (value: string | null) => void;
  setToast: (value: string) => void;
  record: (entry: Omit<Activity, "id" | "at">) => void;
  /** Compact list without the CPU history. */
  simple: boolean;
}

interface Request {
  rows: ActivityRow[];
  force: boolean;
}

export function ProcessesPanel({
  paused,
  services,
  busy,
  setBusy,
  setToast,
  record,
  simple,
}: Props) {
  const t = useT();
  const a = t.activity;
  const { snapshot, history, error, refresh } = useActivity({
    paused: paused || busy !== null,
    history: !simple,
  });
  const [mine, setMine] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ActivitySort>("cpu");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resistant, setResistant] = useState<Set<string>>(new Set());
  const [pointing, setPointing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const order = useRef<string[]>([]);
  const projects = useMemo(
    () => new Map(services.map((s) => [s.pid, s.project])),
    [services],
  );

  const sorted = useMemo(
    () => (snapshot ? activityRows(snapshot, mine, query, sort) : []),
    [snapshot, mine, query, sort],
  );
  // The order holds while the pointer is on the list or a choice is pending.
  const frozen = pointing || selected.size > 0 || request !== null;
  const byId = new Map(sorted.map((row) => [row.id, row]));
  // The unattributed CPU takes its place among the processes, sorted by CPU.
  const unattributed =
    sort === "cpu" && !query.trim() && snapshot
      ? snapshot.system.unattributedPercent
      : null;
  const sortedIds = sorted.map((row) => row.id);
  if (unattributed !== null) {
    const index = sorted.findIndex(
      (row) => rowValues(row).cpuPercent < unattributed,
    );
    sortedIds.splice(index < 0 ? sortedIds.length : index, 0, KERNEL);
  }
  const ids = frozen ? holdOrder(sortedIds, order.current) : sortedIds;
  order.current = ids;
  const rows = sorted;
  const shown = showAll ? ids : ids.slice(0, TOP);
  const every = useMemo(() => (snapshot ? allRows(snapshot) : []), [snapshot]);
  const totals = selectionTotals(every, selected);
  const forceable =
    selected.size > 0 && [...selected].every((id) => resistant.has(id));

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  }
  function ask(ids: string[]) {
    const chosen = every.filter((row) => ids.includes(row.id));
    if (chosen.length)
      setRequest({
        rows: chosen,
        force: chosen.every((row) => resistant.has(row.id)),
      });
  }
  async function stop({ rows: chosen, force }: Request) {
    setRequest(null);
    const ids = chosen.map((row) => row.id);
    setPending(ids);
    setBusy("activity");
    try {
      const result = await api.stopActivity(ids, force);
      setToast(result.message);
      const names = chosen.map((row) => rowValues(row).name);
      record({
        name:
          names.length > 3
            ? `${names.slice(0, 3).join(", ")}…`
            : names.join(", "),
        ports: [],
        message: result.message,
        success: result.stopped,
      });
      setResistant((current) => {
        const next = new Set(current);
        for (const id of ids)
          if (result.stopped) next.delete(id);
          else next.add(id);
        return next;
      });
      if (result.stopped) setSelected(new Set());
    } catch (e) {
      setToast(String(e));
    } finally {
      setPending([]);
      setBusy(null);
      await refresh();
    }
  }

  const s = snapshot?.system;
  const sensors = s?.sensors;
  const thermal = sensors?.thermalPressure ?? null;
  // The fastest fan is the one heard.
  const fan = sensors?.fans?.length
    ? sensors.fans.reduce((top, f) => (f.rpm > top.rpm ? f : top))
    : null;
  const celsius = (n: number) => t.units.celsius(Math.round(n));
  const rpm = (n: number) => Math.round(n).toLocaleString(t.locale);
  const sortButton = (key: ActivitySort, label: string) => (
    <button
      className={`sort-heading ${sort === key ? "active" : ""}`}
      title={key === "cpu" && s ? a.cpuScale(s.cores) : undefined}
      aria-label={a.sortBy(label)}
      aria-pressed={sort === key}
      onClick={() => setSort(key)}
    >
      {label}
      {sort === key && key !== "name" && (
        <ArrowDown aria-hidden="true" size={11} />
      )}
    </button>
  );

  const actionButton = (
    id: string,
    name: string,
    app: boolean,
    stoppable: boolean,
    reason: string | null,
  ) => (
    <button
      className="stop-button"
      disabled={!stoppable || busy !== null}
      title={reason ?? undefined}
      aria-label={`${stoppable ? (resistant.has(id) ? a.force : app ? a.quit : a.stop) : a.protected} ${name}`}
      onClick={() => ask([id])}
    >
      <Square aria-hidden="true" size={11} />
      {pending.includes(id)
        ? t.row.stopping
        : !stoppable
          ? a.protected
          : resistant.has(id)
            ? a.force
            : app
              ? a.quit
              : a.stop}
    </button>
  );

  const cores = snapshot?.system.cores ?? 8;
  const trail = (id: string) => history.map((h) => h.rows[id]);
  // The guide shows the CPU now and its last two minutes; the simple view a bar.
  const figures = (
    id: string,
    v: {
      cpuPercent: number;
      memoryBytes: number;
      precise: boolean;
      exactMemory: boolean;
      elapsedSeconds: number;
    },
  ) => (
    <>
      {simple ? (
        <div
          className="activity-cpu"
          role="cell"
          title={v.precise ? undefined : a.approximate}
        >
          <span>
            {v.precise ? "" : "≈ "}
            {t.units.percent(
              v.cpuPercent.toLocaleString(t.locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }),
            )}
          </span>
          <span className="load-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, v.cpuPercent)}%` }} />
          </span>
        </div>
      ) : (
        <>
          <div
            className={`activity-ident h${heatStep(v.cpuPercent, cores)}`}
            role="cell"
            title={v.precise ? undefined : a.approximate}
          >
            {v.precise ? "" : "≈"}
            {v.cpuPercent.toLocaleString(t.locale, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </div>
          <div className="activity-trail" role="cell">
            <HeatStrip values={trail(id)} cores={cores} />
          </div>
        </>
      )}
      <div
        className="activity-number"
        role="cell"
        title={v.exactMemory ? undefined : a.residentMemory}
      >
        {v.exactMemory ? "" : "≈ "}
        {memory(v.memoryBytes, t)}
      </div>
      {simple && (
        <div className="activity-number muted" role="cell">
          {duration(v.elapsedSeconds, t)}
        </div>
      )}
    </>
  );

  const processLine = (p: ProcessInfo, member: boolean) => (
    <div
      key={p.id}
      className={`activity-row ${member ? "member" : ""} ${selected.has(p.id) ? "selected" : ""}`}
      role="row"
    >
      <div role="cell">
        {p.stoppable && (
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            aria-label={a.select(`${p.name} (${p.pid})`)}
            onChange={() => setSelected((set) => toggle(set, p.id))}
          />
        )}
      </div>
      <div className="activity-name" role="cell" title={p.command}>
        <strong>{p.name}</strong>
        <span>
          <span className="mono">{p.pid}</span>
          {projects.has(p.pid) && (
            <span className="project-tag">{projects.get(p.pid)}</span>
          )}
          {!p.stoppable && <ShieldCheck aria-hidden="true" size={12} />}
        </span>
      </div>
      {figures(p.id, p)}
      <div className="row-actions" role="cell">
        {actionButton(
          p.id,
          `${p.name} (${p.pid})`,
          false,
          p.stoppable,
          p.reason,
        )}
      </div>
    </div>
  );

  const temperature = sensors?.cpuCelsius ?? null;
  const sensorFigures = (
    <>
      <div
        className={thermal && thermal !== "nominal" ? "warn" : ""}
        title={a.temperatureHelp}
      >
        <span>{a.temperature}</span>
        <b>{temperature !== null ? celsius(temperature) : "—"}</b>
        <Note
          text={
            !sensors
              ? ""
              : sensors.cpuMaxCelsius != null
                ? [
                    a.temperatureNote(celsius(sensors.cpuMaxCelsius)),
                    thermal && a.thermal[thermal],
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : a.unavailable
          }
        />
      </div>
      <div
        title={fan ? a.fanHelp(rpm(fan.minRpm), rpm(fan.maxRpm)) : undefined}
      >
        <span>{a.fan}</span>
        <b>{!fan ? "—" : fan.rpm < 1 ? a.fanOff : rpm(fan.rpm)}</b>
        <Note
          text={
            !sensors
              ? ""
              : !sensors.fans
                ? a.unavailable
                : !fan
                  ? a.noFan
                  : fan.rpm < 1
                    ? a.fanOffNote
                    : a.fanNote(
                        fan.maxRpm > 0
                          ? Math.round((fan.rpm * 100) / fan.maxRpm)
                          : null,
                        sensors.fans.length,
                      )
          }
        />
      </div>
      <div title={a.gpuHelp}>
        <span>{a.gpu}</span>
        <b>
          {sensors?.gpuPercent != null
            ? `${Math.round(sensors.gpuPercent)} %`
            : "—"}
        </b>
        <Note
          text={
            !sensors
              ? ""
              : sensors.gpuPercent != null
                ? a.gpuNote(
                    sensors.gpuCelsius != null
                      ? celsius(sensors.gpuCelsius)
                      : null,
                  )
                : a.unavailable
          }
        />
      </div>
      <div title={a.powerHelp}>
        <span>{a.power}</span>
        <b>
          {sensors?.powerWatts != null
            ? t.units.watts(
                sensors.powerWatts.toLocaleString(t.locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              )
            : "—"}
        </b>
        <Note
          text={
            !sensors
              ? ""
              : sensors.powerWatts != null
                ? a.powerNote(sensors.onBattery)
                : a.unavailable
          }
        />
      </div>
    </>
  );

  return (
    <>
      {simple ? (
        <section className="figure-strip" aria-label={a.summary}>
          <div title={s ? a.cpuScale(s.cores) : undefined}>
            <span>{a.cpu}</span>
            <b>{s ? `${Math.round(s.cpuPercent)} %` : "—"}</b>
            <Note
              text={
                s
                  ? a.cpuShort(
                      Math.round(s.programsPercent),
                      Math.round(s.kernelPercent),
                    )
                  : ""
              }
            />
          </div>
          <div className={s && s.memoryPressure !== "normal" ? "warn" : ""}>
            <span>{a.memory}</span>
            <b>{s ? memory(s.memoryUsed, t) : "—"}</b>
            <Note
              text={
                s
                  ? `${a.memoryOf(memory(s.memoryTotal, t))} · ${a.pressure[s.memoryPressure]}`
                  : ""
              }
            />
          </div>
          <div>
            <span>{a.swap}</span>
            <b>{s ? memory(s.swapUsed, t) : "—"}</b>
            <Note text={a.swapShort} />
          </div>
          {sensorFigures}
        </section>
      ) : (
        <>
          <section className="load-band" aria-label={a.summary}>
            <div className="load-chart">
              <div className="load-heading">
                <h2>{a.cpuChart}</h2>
                <b className="cpu-now">
                  {s ? `${Math.round(s.cpuPercent)} %` : "—"}
                </b>
                {s && (
                  <small className="cpu-split">
                    {a.cpuPrograms(Math.round(s.programsPercent))} ·{" "}
                    {a.cpuKernel(Math.round(s.kernelPercent))}
                  </small>
                )}
                <span className="legend-item">
                  <i className="key programs" />
                  {a.programs}
                </span>
                <span className="legend-item">
                  <i className="key kernel" />
                  {a.kernel}
                </span>
              </div>
              <CpuChart
                history={history}
                label={a.cpuChartLabel(
                  Math.round(s?.cpuPercent ?? 0),
                  Math.round(
                    Math.max(0, ...history.map((h) => h.programs + h.kernel)),
                  ),
                )}
              />
            </div>
            <div
              className={`load-memory ${s && s.memoryPressure !== "normal" ? "warn" : ""}`}
            >
              <h2>{a.memory}</h2>
              <div className="big">
                {s ? memory(s.memoryUsed, t) : "—"}
                {s && <Note text={a.memoryNote(memory(s.memoryTotal, t))} />}
              </div>
              <span className="memory-meter" aria-hidden="true">
                <span
                  style={{
                    width: s?.memoryTotal
                      ? `${Math.min(100, (s.memoryUsed * 100) / s.memoryTotal)}%`
                      : 0,
                  }}
                />
              </span>
              {s && (
                <span className="pressure">
                  {s.memoryPressure !== "normal" && (
                    <span className="review-key" aria-hidden="true" />
                  )}
                  {a.pressure[s.memoryPressure]}
                </span>
              )}
              <div className="memory-pair">
                <div>
                  {a.swap}
                  <b>{s ? memory(s.swapUsed, t) : "—"}</b>
                </div>
                <div title={s ? a.processesNote(s.ownCount) : undefined}>
                  {a.processes}
                  <b>{s ? s.processCount : "—"}</b>
                </div>
              </div>
            </div>
          </section>
          <section className="sensor-strip" aria-label={a.sensors}>
            {sensorFigures}
          </section>
        </>
      )}
      <section className="services-panel activity-panel" aria-label={a.label}>
        <div className="panel-toolbar">
          <div className="panel-title">
            <h2>{t.views.processes}</h2>
            <span className="count-badge">{rows.length}</span>
          </div>
          <div className="toolbar-controls">
            <div className="filter-switch" role="group" aria-label={a.filter}>
              <button aria-pressed={mine} onClick={() => setMine(true)}>
                {a.mine}
              </button>
              <button aria-pressed={!mine} onClick={() => setMine(false)}>
                {a.all}
              </button>
            </div>
            <label className="search-box">
              <Search aria-hidden="true" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={a.search}
                aria-label={a.searchLabel}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label={t.services.clearSearch}
                >
                  <X aria-hidden="true" size={14} />
                </button>
              )}
            </label>
          </div>
        </div>
        <div
          role="table"
          className={`activity-table ${simple ? "simple" : "guide"}`}
          aria-label={a.label}
          onMouseEnter={() => setPointing(true)}
          onMouseLeave={() => setPointing(false)}
        >
          <div className="activity-row activity-heading" role="row">
            <span role="columnheader" />
            <span role="columnheader">
              {sortButton("name", a.columns.name)}
            </span>
            <span role="columnheader">{sortButton("cpu", a.columns.cpu)}</span>
            {!simple && (
              <span role="columnheader" className="trail-heading">
                {a.ticks.map((tick, i) => (
                  <span key={i} style={{ left: `${(i / 4) * 100}%` }}>
                    {tick}
                  </span>
                ))}
              </span>
            )}
            <span role="columnheader">
              {sortButton("memory", a.columns.memory)}
            </span>
            {simple && (
              <span role="columnheader">
                {sortButton("uptime", a.columns.uptime)}
              </span>
            )}
            <span role="columnheader">{a.columns.actions}</span>
          </div>
          {!snapshot ? (
            <div className="empty-state">
              {api.native ? (
                <RefreshCw aria-hidden="true" className="spin" size={24} />
              ) : (
                <div className="empty-icon">
                  <Cpu aria-hidden="true" size={25} />
                </div>
              )}
              <h3>{api.native ? a.loadingTitle : a.webTitle}</h3>
              <p>{error || (api.native ? a.loadingText : "")}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Search aria-hidden="true" size={25} />
              </div>
              <h3>{a.noMatch}</h3>
              <p>{a.noMatchText}</p>
            </div>
          ) : (
            shown.map((id) => {
              if (id === KERNEL)
                return (
                  <div
                    key={KERNEL}
                    className="activity-row kernel"
                    role="row"
                    title={a.unattributedHelp}
                  >
                    <div role="cell" />
                    <div className="activity-name" role="cell">
                      <strong>{a.unattributed}</strong>
                      <span>{a.unattributedDetail}</span>
                    </div>
                    {simple ? (
                      <div className="activity-cpu" role="cell">
                        <span>{cpu(unattributed ?? 0, t)}</span>
                        <span className="load-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.min(100, unattributed ?? 0)}%`,
                            }}
                          />
                        </span>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`activity-ident h${heatStep(unattributed ?? 0, cores)}`}
                          role="cell"
                        >
                          {(unattributed ?? 0).toLocaleString(t.locale, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="activity-trail" role="cell">
                          <HeatStrip
                            values={history.map((h) => h.unattributed)}
                            cores={cores}
                          />
                        </div>
                      </>
                    )}
                    <div className="activity-number muted" role="cell">
                      —
                    </div>
                    {simple && (
                      <div className="activity-number muted" role="cell">
                        —
                      </div>
                    )}
                    <div role="cell" />
                  </div>
                );
              const row = byId.get(id)!;
              if (row.kind === "process")
                return processLine(row.process, false);
              const app = row.app;
              const open = expanded.has(app.id);
              return (
                <div key={app.id} role="rowgroup">
                  <div
                    className={`activity-row app ${selected.has(app.id) ? "selected" : ""}`}
                    role="row"
                  >
                    <div role="cell">
                      {app.stoppable && (
                        <input
                          type="checkbox"
                          checked={selected.has(app.id)}
                          aria-label={a.select(app.name)}
                          onChange={() =>
                            setSelected((set) => toggle(set, app.id))
                          }
                        />
                      )}
                    </div>
                    <div
                      className="activity-name"
                      role="cell"
                      title={app.bundle}
                    >
                      <button
                        className="group-toggle"
                        aria-expanded={open}
                        aria-label={a.expand(app.name)}
                        onClick={() =>
                          setExpanded((set) => toggle(set, app.id))
                        }
                      >
                        <ChevronRight
                          aria-hidden="true"
                          size={14}
                          className="group-chevron"
                        />
                        <AppWindow aria-hidden="true" size={15} />
                        <strong>{app.name}</strong>
                      </button>
                      <span>
                        {a.count(app.processes.length)}
                        {!app.stoppable && (
                          <ShieldCheck aria-hidden="true" size={12} />
                        )}
                      </span>
                    </div>
                    {figures(app.id, app)}
                    <div className="row-actions" role="cell">
                      {actionButton(
                        app.id,
                        app.name,
                        true,
                        app.stoppable,
                        app.reason,
                      )}
                    </div>
                  </div>
                  {open &&
                    [...app.processes]
                      .sort((x, y) => y.cpuPercent - x.cpuPercent)
                      .map((p) => processLine(p, true))}
                </div>
              );
            })
          )}
          {ids.length > TOP && (
            <button
              className="text-button show-all"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? a.showLess : a.showAll(rows.length)}
            </button>
          )}
        </div>
        {!simple && snapshot && (
          <div className="guide-legend">
            <span>{a.heatLegend}</span>
            <span className="heat-keys">
              {[
                "<1",
                ...heatThresholds(cores).map(
                  (v) => `${Math.round(v * 10) / 10}`,
                ),
              ].map((label, i) => (
                <span key={label}>
                  <i className={`key h${i}`} />
                  {i === 4 ? `${label} %+` : label}
                </span>
              ))}
            </span>
            <span>
              {a.coreShare(
                cores,
                (100 / cores).toLocaleString(t.locale, {
                  maximumFractionDigits: 1,
                }),
              )}
            </span>
          </div>
        )}
        {selected.size > 0 && (
          <div className="selection-bar" role="region" aria-label={a.items}>
            <span>
              {a.selection(
                totals.count,
                memory(totals.memoryBytes, t),
                cpu(totals.cpuPercent, t),
              )}
            </span>
            <button
              className="secondary-button"
              onClick={() => setSelected(new Set())}
            >
              {a.clearSelection}
            </button>
            <button
              className="danger-button"
              disabled={busy !== null}
              onClick={() => ask([...selected])}
            >
              {forceable ? a.forceSelection : a.stopSelection}
            </button>
          </div>
        )}
        <div className="panel-footer">
          <span>
            <ShieldCheck aria-hidden="true" size={14} /> {a.safety}
          </span>
          <span>
            {frozen && (
              <>
                <Hand aria-hidden="true" size={13} /> {a.frozen} ·{" "}
              </>
            )}
            {snapshot &&
              a.sampledAt(
                new Date(snapshot.sampledAt).toLocaleTimeString(t.locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              )}
          </span>
        </div>
      </section>
      {request && (
        <Modal
          title={
            request.force
              ? a.forceTitle(request.rows.length)
              : a.confirmTitle(request.rows.length)
          }
          onClose={() => setRequest(null)}
        >
          <div className="confirm-content">
            <p>{request.force ? a.forceText : a.confirmText}</p>
            <ul className="member-list" aria-label={a.items}>
              {request.rows.map((row) => {
                const v = rowValues(row);
                return (
                  <li key={row.id}>
                    <strong>{v.name}</strong>
                    <span className="mono">
                      {row.kind === "app"
                        ? a.count(row.app.processes.length)
                        : row.process.pid}
                    </span>
                    <span className="mono">{memory(v.memoryBytes, t)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="modal-actions">
              <button
                className="secondary-button"
                data-autofocus
                onClick={() => setRequest(null)}
              >
                {t.common.cancel}
              </button>
              <button
                className="danger-button"
                onClick={() => void stop(request)}
              >
                {request.force ? a.confirmForce : a.confirm}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
