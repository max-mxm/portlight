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
import { useT } from "../i18n";
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
  const t = useT();
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
        <span>{serviceDescription(s, t)}</span>
      </div>
      <div className="port-list" role="cell">
        {s.ports.map((port) =>
          isWebPort(port) ? (
            <button
              key={port}
              className="port"
              title={t.row.openTitle(port)}
              aria-label={t.row.openPort(port)}
              onClick={() => onOpen(port)}
            >
              {port}
              <ExternalLink aria-hidden="true" size={11} />
            </button>
          ) : (
            <span key={port} className="port static" title={t.row.nonWeb(port)}>
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
          {duration(s.elapsedSeconds, t)}
        </span>
        {s.memoryBytes !== null && (
          <span className="resources" title={t.row.resources}>
            {cpu(s.cpuPercent, t)} · {memory(s.memoryBytes, t)}
          </span>
        )}
      </div>
      <div className="scope" role="cell">
        <span className={`dot ${s.exposed ? "amber" : "green"}`} />
        {s.exposed ? t.row.network : t.row.local}
      </div>
      <div className="row-actions" role="cell">
        <button
          className="icon-button"
          aria-label={t.row.details(s.name)}
          onClick={onDetails}
        >
          <Info aria-hidden="true" size={17} />
        </button>
        <button
          className="stop-button"
          disabled={!s.stoppable || disabled}
          title={s.reason ?? t.row.stopTitle}
          onClick={onStop}
        >
          <Square aria-hidden="true" size={12} />
          {busy ? t.row.stopping : s.stoppable ? t.row.stop : t.row.protected}
        </button>
      </div>
    </div>
  );
}
