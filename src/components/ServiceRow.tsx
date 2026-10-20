import { ExternalLink, Square } from "lucide-react";
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
import { ageShare, blockStart, clockLabel, thresholdAt } from "../guide";

/** Below this share of the guide, a block keeps its label outside. */
const SHORT = 0.14;

/** The colour family of a service: identity, or the review state. */
export function serviceTone(s: Service, reviewHours: number) {
  if (isOld(s, reviewHours)) return "review";
  if (s.kind === "docker") return "container";
  return s.kind === "process" ? "server" : "tool";
}

export function ServiceRow({
  service: s,
  onDetails,
  onStop,
  onOpen,
  busy,
  disabled,
  reviewHours,
  simple,
  hours,
  ticks,
  scannedAt,
}: {
  service: Service;
  reviewHours: number;
  onDetails: () => void;
  onStop: () => void;
  onOpen: (port: number) => void;
  busy: boolean;
  disabled: boolean;
  simple: boolean;
  /** Hours covered by the guide. */
  hours: number;
  /** Tick positions, 0 to 1. */
  ticks: number[];
  scannedAt: number;
}) {
  const t = useT();
  const g = t.guide;
  const tone = serviceTone(s, reviewHours);
  const old = tone === "review";
  const [first, ...others] = s.ports;
  const since = clockLabel(
    scannedAt - s.elapsedSeconds * 1000,
    scannedAt,
    t.locale,
  );
  const up = duration(s.elapsedSeconds, t);
  const port = (p: number, className: string, label?: string) =>
    isWebPort(p) ? (
      <button
        key={p}
        className={className}
        title={t.row.openTitle(p)}
        aria-label={t.row.openPort(p)}
        onClick={() => onOpen(p)}
      >
        {label ?? p}
        {className === "port" && <ExternalLink aria-hidden="true" size={11} />}
      </button>
    ) : (
      <span key={p} className={`${className} static`} title={t.row.nonWeb(p)}>
        {label ?? p}
      </span>
    );
  const { start, clipped } = blockStart(s.elapsedSeconds, hours);
  const short = 1 - start < SHORT;
  return (
    <div className={`service-row ${simple ? "simple" : "guide"}`} role="row">
      <div className="ident-cell" role="cell">
        {first === undefined ? (
          <span className={`ident ${tone}`}>—</span>
        ) : (
          port(first, `ident ${tone}`)
        )}
      </div>
      <div className="service-name" role="cell">
        <div className="name-line">
          <button className="text-button name-button" onClick={onDetails}>
            {s.name}
          </button>
          {simple && <span>{serviceDescription(s, t)}</span>}
        </div>
        {!simple && (
          <span className="service-meta">
            <span>{serviceDescription(s, t)}</span>
            <span>{g.since(since)}</span>
            <span className="access">
              <span className={`dot ${s.exposed ? "network" : "green"}`} />
              {s.exposed ? t.row.network : t.row.local}
            </span>
            {s.memoryBytes !== null && (
              <span className="resources" title={t.row.resources}>
                {cpu(s.cpuPercent, t)} · {memory(s.memoryBytes, t)}
              </span>
            )}
          </span>
        )}
        {others.length > 0 && (
          <span className="port-list">
            {others.map((p) => port(p, "port"))}
          </span>
        )}
        {!simple && (
          <code className="service-command" title={s.command}>
            {s.command}
          </code>
        )}
      </div>
      {simple ? (
        <div className={`age ${old ? "review" : ""}`} role="cell">
          <span className="age-meter" aria-hidden="true">
            <span
              style={{
                width: `${ageShare(s.elapsedSeconds, reviewHours) * 100}%`,
              }}
            />
          </span>
          <span className="age-value">
            {old && <span className="review-key" aria-hidden="true" />}
            {up}
            {old && <span className="sr-only"> · {g.past(reviewHours)}</span>}
          </span>
        </div>
      ) : (
        <div className="track" role="cell">
          <span className="sr-only">
            {g.since(since)} · {up}
            {old ? ` · ${g.past(reviewHours)}` : ""}
          </span>
          {ticks.map((x) => (
            <span
              key={x}
              className="tick"
              aria-hidden="true"
              style={{ left: `${x * 100}%` }}
            />
          ))}
          <span
            className="threshold-line"
            aria-hidden="true"
            style={{ left: `${thresholdAt(reviewHours, hours) * 100}%` }}
          />
          <span
            className={`block ${tone}`}
            aria-hidden="true"
            style={{ left: `${start * 100}%` }}
          >
            {!short && (
              <>
                {clipped && <i className="block-arrow" />}
                <span className="block-label">{clipped ? since : s.name}</span>
                <span className="mono">
                  {up}
                  {old ? ` · ${g.past(reviewHours)}` : ""}
                </span>
              </>
            )}
          </span>
          {short && (
            <span
              className="block-outside mono"
              aria-hidden="true"
              style={{ right: `calc(${(1 - start) * 100}% + 8px)` }}
            >
              {up}
            </span>
          )}
          <span className="now-line" aria-hidden="true" />
        </div>
      )}
      <div className="row-actions" role="cell">
        <button
          className="stop-button"
          disabled={!s.stoppable || disabled}
          title={s.reason ?? t.row.stopTitle}
          onClick={onStop}
        >
          <Square aria-hidden="true" size={11} />
          {busy ? t.row.stopping : s.stoppable ? t.row.stop : t.row.protected}
        </button>
      </div>
    </div>
  );
}
