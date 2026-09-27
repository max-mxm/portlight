import { Terminal } from "lucide-react";
import type { Service } from "../types";
import { Modal } from "./Modal";
export function StopConfirmation({
  confirm,
  setConfirm,
  stop,
}: {
  confirm: { service: Service; force: boolean };
  setConfirm: (v: null) => void;
  stop: (s: Service, force: boolean) => Promise<void>;
}) {
  return (
    <Modal
      title={confirm.force ? "Forcer l’arrêt ?" : "Arrêter ce service ?"}
      onClose={() => setConfirm(null)}
    >
      <div className="confirm-content">
        <div className="confirm-service">
          <span className="service-icon">
            <Terminal aria-hidden="true" size={22} />
          </span>
          <div>
            <strong>{confirm.service.name}</strong>
            <span>
              {confirm.service.project} ·{" "}
              {confirm.service.ports.map((p) => `:${p}`).join(", ")}
            </span>
          </div>
        </div>
        <p>
          {confirm.force
            ? "Le processus n’a pas répondu à l’arrêt normal. L’arrêt forcé l’interrompt immédiatement."
            : confirm.service.kind === "docker"
              ? "Portlight arrêtera uniquement ce conteneur. Ses données et sa configuration seront conservées."
              : "Portlight demandera au processus de se fermer normalement, puis vérifiera ses ports."}
        </p>
        <div className="confirm-command">
          <code>
            {confirm.force
              ? `kill -KILL ${confirm.service.pid}`
              : confirm.service.stopCommand}
          </code>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setConfirm(null)}>
            Annuler
          </button>
          <button
            className="danger-button"
            onClick={() => void stop(confirm.service, confirm.force)}
          >
            {confirm.force ? "Forcer l’arrêt" : "Arrêter"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
