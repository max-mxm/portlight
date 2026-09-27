import { useState } from "react";
import { Check, Code2, Copy, FolderOpen, ShieldCheck } from "lucide-react";
import type { Service, StopRequest, StopScope } from "../types";
import { cpu, duration, memory, resistantKey } from "../services";
import { Modal } from "./Modal";
export function ServiceDetails({
  details,
  setDetails,
  resistant,
  busy,
  setConfirm,
  copy,
  editor,
  openFolder,
}: {
  details: Service;
  setDetails: (s: Service | null) => void;
  resistant: Set<string>;
  busy: string | null;
  setConfirm: (v: StopRequest) => void;
  copy: (text: string) => Promise<boolean>;
  editor: string | null;
  openFolder: (s: Service, editor: string | null) => Promise<void>;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const forced = (scope: StopScope) =>
    resistant.has(resistantKey(scope, details.id));
  const request = (scope: StopScope) =>
    setConfirm({ service: details, force: forced(scope), scope });
  const hasFolder = details.cwd !== "" && details.cwd !== "/";
  const compose =
    details.composeProject && details.composeContainers.length > 1
      ? details.composeProject
      : null;
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
          {details.image && (
            <>
              <dt>Image</dt>
              <dd className="mono">{details.image}</dd>
            </>
          )}
          <dt>Durée d’activité</dt>
          <dd>{duration(details.elapsedSeconds)}</dd>
          {details.memoryBytes !== null && (
            <>
              <dt>Ressources</dt>
              <dd className="mono">
                CPU {cpu(details.cpuPercent)} · Mémoire{" "}
                {memory(details.memoryBytes)}
              </dd>
            </>
          )}
          <dt>Adresses</dt>
          <dd className="mono">{details.addresses.join(", ")}</dd>
          <dt>Dossier du projet</dt>
          <dd className="mono">{details.cwd || "Non disponible"}</dd>
          <dt>Commande du processus</dt>
          <dd>
            <pre>{details.command}</pre>
          </dd>
          {details.parents.length > 0 && (
            <>
              <dt>Lancé par</dt>
              <dd>
                <ol className="lineage" aria-label="Processus parents">
                  {details.parents.map((p) => (
                    <li key={p.pid} title={p.command}>
                      <strong>{p.name}</strong>
                      <span className="mono">{p.pid}</span>
                    </li>
                  ))}
                </ol>
              </dd>
            </>
          )}
        </dl>
        {hasFolder && (
          <div className="folder-actions">
            <button
              className="secondary-button"
              onClick={() => void openFolder(details, null)}
            >
              <FolderOpen aria-hidden="true" size={16} />
              Ouvrir dans le Finder
            </button>
            {editor && (
              <button
                className="secondary-button"
                onClick={() => void openFolder(details, editor)}
              >
                <Code2 aria-hidden="true" size={16} />
                Ouvrir dans {editor}
              </button>
            )}
          </div>
        )}
        {details.reason && (
          <div className="notice warning-notice">
            <ShieldCheck aria-hidden="true" size={17} />
            <p>{details.reason}</p>
          </div>
        )}
        {details.stoppable && details.launchGroup.length > 0 && (
          <section className="scope-box" aria-label="Lanceur du service">
            <div>
              <strong>Relancé automatiquement ?</strong>
              <p>
                {details.launchGroup[0].name} a lancé ce serveur. Arrêtez
                l’ensemble pour éviter un redémarrage :{" "}
                {details.launchGroup.map((p) => p.name).join(", ")}.
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={busy !== null}
              onClick={() => request("group")}
            >
              {forced("group")
                ? "Forcer l’arrêt du groupe"
                : `Arrêter les ${details.launchGroup.length} processus`}
            </button>
          </section>
        )}
        {details.stoppable && compose && (
          <section className="scope-box" aria-label="Projet Compose">
            <div>
              <strong>Projet Compose {compose}</strong>
              <p>{details.composeContainers.join(", ")}</p>
            </div>
            <button
              className="secondary-button"
              disabled={busy !== null}
              onClick={() => request("compose")}
            >
              Arrêter les {details.composeContainers.length} conteneurs
            </button>
          </section>
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
              onClick={() => request("service")}
            >
              {forced("service") ? "Forcer l’arrêt" : "Arrêter ce service"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
