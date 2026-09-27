import { ArrowRight, Box, Clock3, Radio, Terminal } from "lucide-react";
import type { Service, Snapshot, View } from "../types";
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
  return (
    <>
      <section className="stats" aria-label="Résumé de l’environnement">
        <button className="stat" onClick={() => navigate("all")}>
          <span className="stat-label">
            Ports utilisés
            <Radio aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot ? ports.size : "—"}
            <span className="stat-note">en développement</span>
          </div>
        </button>
        <button className="stat" onClick={() => navigate("process")}>
          <span className="stat-label">
            Serveurs actifs
            <Terminal aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot
              ? services.filter((s) => s.kind === "process").length
              : "—"}
            <span className="stat-note">processus locaux</span>
          </div>
        </button>
        <button className="stat" onClick={() => navigate("docker")}>
          <span className="stat-label">
            Conteneurs Docker
            <Box aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot
              ? services.filter((s) => s.kind === "docker").length
              : "—"}
            <span className="stat-note">avec ports publiés</span>
          </div>
        </button>
        <button
          className={`stat ${oldServices.length ? "attention" : ""}`}
          onClick={() => navigate("old")}
        >
          <span className="stat-label">
            À vérifier
            <Clock3 aria-hidden="true" size={17} />
          </span>
          <div className="stat-value">
            {snapshot ? oldServices.length : "—"}
            <span className="stat-note">
              actifs depuis + de {reviewHours} h
            </span>
          </div>
        </button>
      </section>
      {view === "all" && oldServices.length > 0 && (
        <button className="review-banner" onClick={() => navigate("old")}>
          <div className="review-icon">
            <Clock3 aria-hidden="true" size={20} />
          </div>
          <div>
            <strong>
              {oldServices.length === 1
                ? "Un serveur tourne"
                : `${oldServices.length} serveurs tournent`}{" "}
              depuis plus de {reviewHours} heures.
            </strong>
            <span>
              Un terminal fermé ne signifie pas toujours un serveur arrêté.
            </span>
          </div>
          <span className="review-action">
            Vérifier
            <ArrowRight aria-hidden="true" size={16} />
          </span>
        </button>
      )}
    </>
  );
}
