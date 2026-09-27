import { ArrowRight, RefreshCw, Search, Terminal } from "lucide-react";
import type { Service } from "../types";
import { Modal } from "./Modal";
export function CommandPalette({
  setPalette,
  paletteQuery,
  setPaletteQuery,
  paletteItems,
  refresh,
  setConfirm,
}: {
  setPalette: (v: boolean) => void;
  paletteQuery: string;
  setPaletteQuery: (v: string) => void;
  paletteItems: Service[];
  refresh: () => Promise<void>;
  setConfirm: (value: { service: Service; force: boolean }) => void;
}) {
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
              setPalette(false);
              if (paletteQuery && paletteItems[0])
                setConfirm({ service: paletteItems[0], force: false });
              else if (!paletteQuery) void refresh();
            }
          }}
          placeholder="Chercher un port ou un service…"
          aria-label="Chercher une action"
        />
      </div>
      <div className="palette-items">
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
        {paletteItems.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setPalette(false);
              setConfirm({ service: s, force: false });
            }}
          >
            <Terminal aria-hidden="true" size={18} />
            <div>
              <strong>
                Arrêter {s.name}
                <span className="palette-ports">
                  {s.ports.map((p) => `:${p}`).join(" ")}
                </span>
              </strong>
              <span>{s.project} · Demander un arrêt normal</span>
            </div>
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        ))}
        {!paletteItems.length && paletteQuery && (
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
