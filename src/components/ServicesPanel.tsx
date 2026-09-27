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
import type { Service, Snapshot, View } from "../types";
import { views } from "../navigation";
import { ServiceRow } from "./ServiceRow";
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
  setConfirm: (value: { service: Service; force: boolean }) => void;
  open: (s: Service, port: number) => Promise<void>;
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
}: Props) {
  return (
    <section className="services-panel" aria-label="Services en écoute">
      <div className="panel-toolbar">
        <div className="panel-title">
          <h2>
            {project ||
              (view === "all"
                ? "Services en cours"
                : views.find((v) => v.id === view)?.name)}
          </h2>
          <span className="count-badge">{visible.length}</span>
        </div>
        <div className="toolbar-controls">
          <label className="search-box">
            <Search aria-hidden="true" size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un port, un projet…"
              aria-label="Rechercher un service"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
              >
                <X aria-hidden="true" size={14} />
              </button>
            ) : (
              <kbd>⌘ F</kbd>
            )}
          </label>
          <label className="sort-select">
            <ArrowDownUp aria-hidden="true" size={15} />
            <select
              aria-label="Trier les services"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="project">Par projet</option>
              <option value="age">Plus anciens</option>
            </select>
            <ChevronDown aria-hidden="true" size={12} />
          </label>
        </div>
      </div>
      <div role="table" aria-label="Ports et services">
        <div className="table-heading" role="row">
          <span role="columnheader">SERVICE</span>
          <span role="columnheader">PORTS</span>
          <span role="columnheader">ACTIF DEPUIS</span>
          <span role="columnheader">ACCÈS</span>
          <span role="columnheader">ACTIONS</span>
        </div>
        {loading && !snapshot ? (
          <div className="empty-state">
            <RefreshCw aria-hidden="true" className="spin" size={24} />
            <h3>Un instant, on fait le tour de votre Mac.</h3>
            <p>Identification des ports, des projets et des conteneurs…</p>
          </div>
        ) : groups.length ? (
          groups.map(([p, items]) => (
            <div key={p} role="rowgroup">
              <div className="group-heading">
                <Folder aria-hidden="true" size={15} />
                <strong>{p}</strong>
                <span>
                  {items.length} service{items.length > 1 ? "s" : ""}
                </span>
              </div>
              {items.map((s) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  busy={busy === s.id}
                  disabled={busy !== null}
                  onDetails={() => setDetails(s)}
                  onStop={() => setConfirm({ service: s, force: false })}
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
                ? "Aucun service ne correspond."
                : !snapshot
                  ? "Votre environnement, bientôt en clair."
                  : view === "old"
                    ? "Tout est à jour."
                    : "Aucun service dans cette vue."}
            </h3>
            <p>
              {query
                ? "Essayez un numéro de port ou le nom d’un projet."
                : !snapshot
                  ? "Le premier relevé apparaîtra dès que l’application Mac sera ouverte."
                  : view === "old"
                    ? "Aucun serveur de développement ne tourne depuis plus de 8 heures."
                    : "Les nouveaux services apparaîtront au prochain relevé."}
            </p>
            {query && (
              <button className="secondary-button" onClick={() => setQuery("")}>
                Effacer la recherche
              </button>
            )}
          </div>
        )}
      </div>
      <div className="panel-footer">
        <span>
          <ShieldCheck aria-hidden="true" size={14} /> Arrêt normal en priorité
          · Services système protégés
        </span>
        <span>
          {snapshot
            ? `Relevé à ${new Date(snapshot.scannedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "Aucun relevé"}
        </span>
      </div>
    </section>
  );
}
