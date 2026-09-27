import { ArrowRight, Box, Clock3, Radio, Terminal } from "lucide-react";
import type { Service, Snapshot, View } from "../types";
import { useT } from "../i18n";
interface Props {
  snapshot: Snapshot | null;
  ports: Set<number>;
  services: Service[];
  oldServices: Service[];
  view: View;
  navigate: (view: View) => void;
  reviewHours: number;
}
export function Overview({
  snapshot,
  ports,
  services,
  oldServices,
  view,
  navigate,
  reviewHours,
}: Props) {
  const t = useT();
  const o = t.overview;
  return (
    <>
      <section className="stats" aria-label={o.summary}>
        <button className="stat" onClick={() => navigate("all")}>
          <span className="stat-label">
            {o.portsUsed}
            <Radio aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot ? ports.size : "—"}
            <span className="stat-note">{o.inDevelopment}</span>
          </div>
        </button>
        <button className="stat" onClick={() => navigate("process")}>
          <span className="stat-label">
            {o.activeServers}
            <Terminal aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot
              ? services.filter((s) => s.kind === "process").length
              : "—"}
            <span className="stat-note">{o.localProcesses}</span>
          </div>
        </button>
        <button className="stat" onClick={() => navigate("docker")}>
          <span className="stat-label">
            {o.containers}
            <Box aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot
              ? services.filter((s) => s.kind === "docker").length
              : "—"}
            <span className="stat-note">{o.withPorts}</span>
          </div>
        </button>
        <button
          className={`stat ${oldServices.length ? "attention" : ""}`}
          onClick={() => navigate("old")}
        >
          <span className="stat-label">
            {o.toReview}
            <Clock3 aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot ? oldServices.length : "—"}
            <span className="stat-note">{o.runningFor(reviewHours)}</span>
          </div>
        </button>
      </section>
      {view === "all" && oldServices.length > 0 && (
        <button className="review-banner" onClick={() => navigate("old")}>
          <div className="review-icon">
            <Clock3 aria-hidden="true" size={20} />
          </div>
          <div>
            <strong>{o.banner(oldServices.length, reviewHours)}</strong>
            <span>{o.bannerText}</span>
          </div>
          <span className="review-action">
            {o.review}
            <ArrowRight aria-hidden="true" size={16} />
          </span>
        </button>
      )}
    </>
  );
}
