import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Folder,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import type { Service, Snapshot, StopRequest, View } from "../types";
import { ServiceRow } from "./ServiceRow";
import { useT } from "../i18n";
import { useCollapsed } from "../hooks/useCollapsed";
import { resistantKey } from "../services";
interface Props {
  project: string;
  view: View;
  visible: Service[];
  query: string;
  setQuery: (v: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  sort: "project" | "age";
  setSort: (v: "project" | "age") => void;
  loading: boolean;
  snapshot: Snapshot | null;
  groups: [string, Service[]][];
  busy: string | null;
  resistant: Set<string>;
  setDetails: (s: Service) => void;
  setConfirm: (value: StopRequest) => void;
  open: (s: Service, port: number) => Promise<void>;
  reviewHours: number;
}
export function ServicesPanel({
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
  resistant,
  setDetails,
  setConfirm,
  open,
  reviewHours,
}: Props) {
  const t = useT();
  const l = t.services;
  const { collapsed, toggle, setAll } = useCollapsed();
  const names = groups.map(([name]) => name);
  const allCollapsed = names.length > 0 && names.every((n) => collapsed.has(n));
  function stopGroup(name: string, items: Service[]) {
    const force = resistant.has(resistantKey("project", name));
    // A force stop only concerns the processes: containers are never forced.
    const members = items.filter(
      (s) => s.stoppable && (!force || s.kind !== "docker"),
    );
    if (members.length)
      setConfirm({
        service: members[0],
        force,
        scope: "project",
        group: { name, members },
      });
  }
  return (
    <section className="services-panel" aria-label={l.label}>
      <div className="panel-toolbar">
        <div className="panel-title">
          <h2>{project || (view === "all" ? l.running : t.views[view])}</h2>
          <span className="count-badge">{visible.length}</span>
        </div>
        <div className="toolbar-controls">
          {names.length > 1 && (
            <button
              className="icon-button collapse-all"
              aria-label={allCollapsed ? l.expandAll : l.collapseAll}
              title={allCollapsed ? l.expandAll : l.collapseAll}
              onClick={() => setAll(names, !allCollapsed)}
            >
              {allCollapsed ? (
                <ChevronsUpDown aria-hidden="true" size={17} />
              ) : (
                <ChevronsDownUp aria-hidden="true" size={17} />
              )}
            </button>
          )}
          <label className="search-box">
            <Search aria-hidden="true" size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={l.search}
              aria-label={l.searchLabel}
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label={l.clearSearch}>
                <X aria-hidden="true" size={14} />
              </button>
            ) : (
              <kbd>⌘ F</kbd>
            )}
          </label>
          <label className="sort-select">
            <ArrowDownUp aria-hidden="true" size={15} />
            <select
              aria-label={l.sortLabel}
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="project">{l.byProject}</option>
              <option value="age">{l.oldest}</option>
            </select>
            <ChevronDown aria-hidden="true" size={12} />
          </label>
        </div>
      </div>
      <div role="table" aria-label={l.table}>
        <div className="table-heading" role="row">
          <span role="columnheader">{l.columns.service}</span>
          <span role="columnheader">{l.columns.ports}</span>
          <span role="columnheader">{l.columns.uptime}</span>
          <span role="columnheader">{l.columns.access}</span>
          <span role="columnheader">{l.columns.actions}</span>
        </div>
        {loading && !snapshot ? (
          <div className="empty-state">
            <RefreshCw aria-hidden="true" className="spin" size={24} />
            <h3>{l.loadingTitle}</h3>
            <p>{l.loadingText}</p>
          </div>
        ) : groups.length ? (
          groups.map(([p, items]) => {
            // A search always shows its matches.
            const expanded = !collapsed.has(p) || query.trim() !== "";
            const key = resistantKey("project", p);
            const stoppable = items.filter((s) => s.stoppable).length;
            return (
              <div key={p} role="rowgroup">
                <div className="group-heading">
                  <button
                    className="group-toggle"
                    aria-expanded={expanded}
                    onClick={() => toggle(p)}
                  >
                    <ChevronRight
                      aria-hidden="true"
                      size={15}
                      className="group-chevron"
                    />
                    <Folder aria-hidden="true" size={15} />
                    <strong>{p}</strong>
                    <span>{l.count(items.length)}</span>
                  </button>
                  {sort === "project" && stoppable > 0 && (
                    <button
                      className="stop-button group-stop"
                      disabled={busy !== null}
                      title={l.stopGroupTitle(p)}
                      onClick={() => stopGroup(p, items)}
                    >
                      <Square aria-hidden="true" size={12} />
                      {busy === key
                        ? t.row.stopping
                        : resistant.has(key)
                          ? l.forceGroup
                          : l.stopGroup}
                    </button>
                  )}
                </div>
                {expanded &&
                  items.map((s) => (
                    <ServiceRow
                      key={s.id}
                      service={s}
                      busy={busy === s.id}
                      disabled={busy !== null}
                      onDetails={() => setDetails(s)}
                      reviewHours={reviewHours}
                      onStop={() =>
                        setConfirm({
                          service: s,
                          force: false,
                          scope: "service",
                        })
                      }
                      onOpen={(port) => void open(s, port)}
                    />
                  ))}
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              {query ? (
                <Search aria-hidden="true" size={25} />
              ) : view === "old" ? (
                <Check aria-hidden="true" size={25} />
              ) : (
                <Radio aria-hidden="true" size={25} />
              )}
            </div>
            <h3>
              {query
                ? l.noMatch
                : !snapshot
                  ? l.emptyTitle
                  : view === "old"
                    ? l.upToDate
                    : l.emptyView}
            </h3>
            <p>
              {query
                ? l.noMatchText
                : !snapshot
                  ? l.emptyText
                  : view === "old"
                    ? l.upToDateText(reviewHours)
                    : l.emptyViewText}
            </p>
            {query && (
              <button className="secondary-button" onClick={() => setQuery("")}>
                {l.clearSearch}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="panel-footer">
        <span>
          <ShieldCheck aria-hidden="true" size={14} /> {l.safety}
        </span>
        <span>
          {snapshot
            ? l.scannedAt(
                new Date(snapshot.scannedAt).toLocaleTimeString(t.locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              )
            : l.noScan}
        </span>
      </div>
    </section>
  );
}
