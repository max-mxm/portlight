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
import { useT } from "../i18n";
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
  const t = useT();
  const p = t.palette;
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
    <Modal title={p.title} wide onClose={() => setPalette(false)}>
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
          placeholder={p.placeholder}
          aria-label={p.label}
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
              <strong>{p.refresh}</strong>
              <span>{p.refreshText}</span>
            </div>
            <kbd>⌘ R</kbd>
          </button>
        )}
        {items.map((s) => (
          <button key={s.id} onClick={() => confirm(s)}>
            <Terminal aria-hidden="true" size={18} />
            <div>
              <strong>
                {port !== null ? p.freePort(port) : p.stop}
                {s.name}
                <span className="palette-ports">
                  {s.ports.map((n) => `:${n}`).join(" ")}
                </span>
              </strong>
              <span>
                {s.project} · {p.stopText}
              </span>
            </div>
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        ))}
        {holders.map((s) => (
          <p className="palette-empty palette-holder" key={s.id}>
            <Shield aria-hidden="true" size={16} />
            {p.protectedHolder(port ?? 0, s.name)}
          </p>
        ))}
        {port !== null && !matches.length && (
          <p className="palette-empty palette-holder">
            <CircleCheck aria-hidden="true" size={16} />
            {p.free(port)}
          </p>
        )}
        {port === null && !items.length && paletteQuery && (
          <p className="palette-empty">{p.none(paletteQuery)}</p>
        )}
      </div>
      <div className="palette-footer">
        <kbd>Tab</kbd> {p.browse} <kbd>↵</kbd> {p.select} <kbd>esc</kbd>{" "}
        {p.close}
      </div>
    </Modal>
  );
}
