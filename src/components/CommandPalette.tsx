import {
  ArrowRight,
  CircleCheck,
  RefreshCw,
  Search,
  Shield,
  Terminal,
} from "lucide-react";
import type { Service, StopRequest } from "../types";
import { paletteMatches, portQuery } from "../services";
import { Modal } from "./Modal";
export function CommandPalette({
  setPalette,
  paletteQuery,
  setPaletteQuery,
  services,
  refresh,
  setConfirm,
}: {
  setPalette: (v: boolean) => void;
  paletteQuery: string;
  setPaletteQuery: (v: string) => void;
  services: Service[];
  refresh: () => Promise<unknown>;
  setConfirm: (value: StopRequest) => void;
}) {
  const port = portQuery(paletteQuery);
  const matches = paletteMatches(services, paletteQuery);
  const items = matches.filter(
    (s) => s.stoppable && (s.kind === "process" || s.kind === "docker"),
  );
  // A port held by a protected service still deserves an answer.
  const holders = port !== null ? matches.filter((s) => !s.stoppable) : [];
  const confirm = (service: Service) => {
    setPalette(false);
    setConfirm({ service, force: false, scope: "service" });
  };
  return (
    <Modal title="Actions rapides" wide onClose={() => setPalette(false)}>
      <div className="palette-search">
        <Search aria-hidden="true" size={19} />
        <input
          data-autofocus
          autoFocus
          value={paletteQuery}
          onChange={(e) => setPaletteQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (paletteQuery && items[0]) confirm(items[0]);
              else if (!paletteQuery) {
                setPalette(false);
                void refresh();
              }
            }
          }}
          placeholder="Chercher un service ou libérer un port (:3000)…"
          aria-label="Chercher une action"
        />
      </div>
      <div className="palette-items">
        {!paletteQuery && (
          <button
            onClick={() => {
              setPalette(false);
              void refresh();
            }}
          >
            <RefreshCw aria-hidden="true" size={18} />
            <div>
              <strong>Actualiser les services</strong>
              <span>Faire un nouveau relevé de ce Mac</span>
            </div>
            <kbd>⌘ R</kbd>
          </button>
        )}
        {items.map((s) => (
          <button key={s.id} onClick={() => confirm(s)}>
            <Terminal aria-hidden="true" size={18} />
            <div>
              <strong>
                {port !== null ? `Libérer le port :${port} · ` : "Arrêter "}
                {s.name}
                <span className="palette-ports">
                  {s.ports.map((p) => `:${p}`).join(" ")}
                </span>
              </strong>
              <span>{s.project} · Demander un arrêt normal</span>
            </div>
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        ))}
        {holders.map((s) => (
          <p className="palette-empty palette-holder" key={s.id}>
            <Shield aria-hidden="true" size={16} />
            Le port :{port} est utilisé par {s.name}, un service protégé.
          </p>
        ))}
        {port !== null && !matches.length && (
          <p className="palette-empty palette-holder">
            <CircleCheck aria-hidden="true" size={16} />
            Le port :{port} est libre.
          </p>
        )}
        {port === null && !items.length && paletteQuery && (
          <p className="palette-empty">
            Aucun service pour « {paletteQuery} ».
          </p>
        )}
      </div>
      <div className="palette-footer">
        <kbd>Tab</kbd> parcourir les actions <kbd>↵</kbd> sélectionner{" "}
        <kbd>esc</kbd> fermer
      </div>
    </Modal>
  );
}
