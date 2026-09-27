import { Box, Layers3, Terminal } from "lucide-react";
import type { StopRequest } from "../types";
import { stopCommand } from "../services";
import { Modal } from "./Modal";

function title({ force, scope }: StopRequest) {
  if (scope === "compose") return "Arrêter le projet Compose ?";
  if (scope === "group")
    return force
      ? "Forcer l’arrêt du lanceur ?"
      : "Arrêter le lanceur et ses processus ?";
  return force ? "Forcer l’arrêt ?" : "Arrêter ce service ?";
}

function explanation({ service, force, scope }: StopRequest) {
  if (force)
    return scope === "group"
      ? "Certains processus n’ont pas répondu à l’arrêt normal. L’arrêt forcé les interrompt immédiatement."
      : "Le processus n’a pas répondu à l’arrêt normal. L’arrêt forcé l’interrompt immédiatement.";
  if (scope === "group")
    return "Portlight demandera à ces processus de se fermer normalement, puis vérifiera leurs ports. Le lanceur ne pourra plus relancer le serveur.";
  if (scope === "compose")
    return "Portlight arrêtera uniquement les conteneurs de ce projet, sans toucher au moteur Docker. Leurs données et leur configuration seront conservées.";
  return service.kind === "docker"
    ? "Portlight arrêtera uniquement ce conteneur. Ses données et sa configuration seront conservées."
    : "Portlight demandera au processus de se fermer normalement, puis vérifiera ses ports.";
}

export function StopConfirmation({
  confirm,
  setConfirm,
  stop,
}: {
  confirm: StopRequest;
  setConfirm: (v: null) => void;
  stop: (request: StopRequest) => Promise<void>;
}) {
  const { service, force, scope } = confirm;
  const Icon =
    scope === "compose" ? Layers3 : service.kind === "docker" ? Box : Terminal;
  return (
    <Modal title={title(confirm)} onClose={() => setConfirm(null)}>
      <div className="confirm-content">
        <div className="confirm-service">
          <span className="service-icon">
            <Icon aria-hidden="true" size={22} />
          </span>
          <div>
            <strong>
              {scope === "compose" ? service.composeProject : service.name}
            </strong>
            <span>
              {service.project} · {service.ports.map((p) => `:${p}`).join(", ")}
            </span>
          </div>
        </div>
        <p>{explanation(confirm)}</p>
        {scope === "group" && (
          <ul className="member-list" aria-label="Processus arrêtés">
            {service.launchGroup.map((p) => (
              <li key={p.pid}>
                <span className="mono">{p.pid}</span>
                <strong>{p.name}</strong>
                {p.ports.length > 0 && (
                  <span className="mono">
                    {p.ports.map((port) => `:${port}`).join(" ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {scope === "compose" && (
          <ul className="member-list" aria-label="Conteneurs arrêtés">
            {service.composeContainers.map((name) => (
              <li key={name}>
                <strong>{name}</strong>
              </li>
            ))}
          </ul>
        )}
        <div className="confirm-command">
          <code>{stopCommand(service, scope, force)}</code>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setConfirm(null)}>
            Annuler
          </button>
          <button className="danger-button" onClick={() => void stop(confirm)}>
            {force
              ? "Forcer l’arrêt"
              : scope === "service"
                ? "Arrêter"
                : `Arrêter ${scope === "group" ? service.launchGroup.length : service.composeContainers.length} ${scope === "group" ? "processus" : "conteneurs"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
