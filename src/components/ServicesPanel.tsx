import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Folder,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import type { Service, Snapshot, StopRequest, View } from "../types";
import { ServiceRow } from "./ServiceRow";
import { useT } from "../i18n";
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
  setDetails,
  setConfirm,
  open,
  reviewHours,
}: Props) {
  const t = useT();
  const l = t.services;
  return (
    <section className="services-panel" aria-label={l.label}>
      <div className="panel-toolbar">
        <div className="panel-title">
          <h2>{project || (view === "all" ? l.running : t.views[view])}</h2>
          <span className="count-badge">{visible.length}</span>
        </div>
        <div className="toolbar-controls">
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
          groups.map(([p, items]) => (
            <div key={p} role="rowgroup">
              <div className="group-heading">
                <Folder aria-hidden="true" size={15} />
                <strong>{p}</strong>
                <span>{l.count(items.length)}</span>
              </div>
              {items.map((s) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  busy={busy === s.id}
                  disabled={busy !== null}
                  onDetails={() => setDetails(s)}
                  reviewHours={reviewHours}
                  onStop={() =>
                    setConfirm({ service: s, force: false, scope: "service" })
                  }
                  onOpen={(port) => void open(s, port)}
                />
              ))}
            </div>
          ))
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
