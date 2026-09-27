import { useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";
import type { Service } from "../types";
import { duration } from "../services";
import { Modal } from "./Modal";
export function ServiceDetails({
  details,
  setDetails,
  resistant,
  busy,
  setConfirm,
  copy,
}: {
  details: Service;
  setDetails: (s: Service | null) => void;
  resistant: Set<string>;
  busy: string | null;
  setConfirm: (v: { service: Service; force: boolean }) => void;
  copy: (text: string) => Promise<boolean>;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  return (
    <Modal title={details.name} wide onClose={() => setDetails(null)}>
      <div className="details-content">
        <div className="detail-heading">
          <span className="type-tag">
            {details.kind === "docker"
              ? "Docker"
              : details.kind === "process"
                ? "Processus"
                : "Protégé"}
          </span>
          <span>{details.project}</span>
        </div>
        <dl>
          <dt>Ports en écoute</dt>
          <dd>{details.ports.join(", ")}</dd>
          <dt>PID</dt>
          <dd>{details.pid || "Géré par Docker"}</dd>
          <dt>Durée d’activité</dt>
          <dd>{duration(details.elapsedSeconds)}</dd>
          <dt>Adresses</dt>
          <dd className="mono">{details.addresses.join(", ")}</dd>
          <dt>Dossier du projet</dt>
          <dd className="mono">{details.cwd || "Non disponible"}</dd>
          <dt>Commande du processus</dt>
          <dd>
            <pre>{details.command}</pre>
          </dd>
        </dl>
        {details.reason && (
          <div className="notice warning-notice">
            <ShieldCheck aria-hidden="true" size={17} />
            <p>{details.reason}</p>
          </div>
        )}
        {details.stoppable && (
          <div className="command-box">
            <span>Commande d’arrêt</span>
            <code>{details.stopCommand}</code>
            <button
              className="icon-button"
              aria-label={
                copyState === "copied"
                  ? "Commande copiée"
                  : "Copier la commande d’arrêt"
              }
              onClick={async () =>
                setCopyState(
                  (await copy(details.stopCommand)) ? "copied" : "error",
                )
              }
            >
              {copyState === "copied" ? (
                <Check aria-hidden="true" size={16} />
              ) : (
                <Copy aria-hidden="true" size={16} />
              )}
            </button>
            {copyState !== "idle" && (
              <span className="copy-feedback" role="status">
                {copyState === "copied"
                  ? "Commande copiée dans le presse-papiers."
                  : "Copie indisponible. Sélectionnez la commande pour la copier."}
              </span>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setDetails(null)}>
            Fermer
          </button>
          {details.stoppable && (
            <button
              className="danger-button"
              disabled={busy !== null}
              onClick={() =>
                setConfirm({
                  service: details,
                  force: resistant.has(details.id),
                })
              }
            >
              {resistant.has(details.id)
                ? "Forcer l’arrêt"
                : "Arrêter ce service"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
