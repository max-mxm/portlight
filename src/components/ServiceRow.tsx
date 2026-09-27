import {
  Box,
  Code2,
  ExternalLink,
  Info,
  Shield,
  Square,
  Clock3,
} from "lucide-react";
import type { Service } from "../types";
import {
  cpu,
  duration,
  isOld,
  isWebPort,
  memory,
  serviceDescription,
} from "../services";
export function ServiceRow({
  service: s,
  onDetails,
  onStop,
  onOpen,
  busy,
  disabled,
  reviewHours,
}: {
  service: Service;
  reviewHours: number;
  onDetails: () => void;
  onStop: () => void;
  onOpen: (port: number) => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="service-row" role="row">
      <div className={`service-icon ${s.kind}`} role="cell">
        {s.kind === "docker" ? (
          <Box aria-hidden="true" size={19} />
        ) : s.stoppable ? (
          <Code2 aria-hidden="true" size={19} />
        ) : (
          <Shield aria-hidden="true" size={19} />
        )}
      </div>
      <div className="service-name" role="cell">
        <button className="text-button name-button" onClick={onDetails}>
          {s.name}
        </button>
        <span>{serviceDescription(s)}</span>
      </div>
      <div className="port-list" role="cell">
        {s.ports.map((port) =>
          isWebPort(port) ? (
            <button
              key={port}
              className="port"
              title={`Ouvrir http://localhost:${port}`}
              aria-label={`Ouvrir le port ${port} dans le navigateur`}
              onClick={() => onOpen(port)}
            >
              {port}
              <ExternalLink aria-hidden="true" size={11} />
            </button>
          ) : (
            <span
              key={port}
              className="port static"
              title={`Port ${port} : service sans page web`}
            >
              {port}
            </span>
          ),
        )}
      </div>
      <div
        className={`uptime ${isOld(s, reviewHours) ? "old" : ""}`}
        role="cell"
      >
        <span className="uptime-value">
          {isOld(s, reviewHours) && <Clock3 aria-hidden="true" size={13} />}
          {duration(s.elapsedSeconds)}
        </span>
        {s.memoryBytes !== null && (
          <span
            className="resources"
            title="Processeur récent · mémoire résidente"
          >
            {cpu(s.cpuPercent)} · {memory(s.memoryBytes)}
          </span>
        )}
      </div>
      <div className="scope" role="cell">
        <span className={`dot ${s.exposed ? "amber" : "green"}`} />
        {s.exposed ? "Réseau" : "Local"}
      </div>
      <div className="row-actions" role="cell">
        <button
          className="icon-button"
          aria-label={`Détails de ${s.name}`}
          onClick={onDetails}
        >
          <Info aria-hidden="true" size={17} />
        </button>
        <button
          className="stop-button"
          disabled={!s.stoppable || disabled}
          title={s.reason ?? "Arrêter normalement ce service"}
          onClick={onStop}
        >
          <Square aria-hidden="true" size={12} />
          {busy ? "Arrêt…" : s.stoppable ? "Arrêter" : "Protégé"}
        </button>
      </div>
    </div>
  );
}
