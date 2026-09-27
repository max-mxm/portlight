import { Box, Layers3, Terminal } from "lucide-react";
import type { StopRequest } from "../types";
import { stopCommand } from "../services";
import { useT, type Messages } from "../i18n";
import { Modal } from "./Modal";

function title({ force, scope }: StopRequest, c: Messages["confirm"]) {
  if (scope === "compose") return c.composeTitle;
  if (scope === "group") return force ? c.forceGroupTitle : c.groupTitle;
  return force ? c.forceTitle : c.title;
}

function explanation(
  { service, force, scope }: StopRequest,
  c: Messages["confirm"],
) {
  if (force) return scope === "group" ? c.forceGroupText : c.forceText;
  if (scope === "group") return c.groupText;
  if (scope === "compose") return c.composeText;
  return service.kind === "docker" ? c.containerText : c.processText;
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
  const t = useT();
  const c = t.confirm;
  const { service, force, scope } = confirm;
  const Icon =
    scope === "compose" ? Layers3 : service.kind === "docker" ? Box : Terminal;
  return (
    <Modal title={title(confirm, c)} onClose={() => setConfirm(null)}>
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
        <p>{explanation(confirm, c)}</p>
        {scope === "group" && (
          <ul className="member-list" aria-label={c.processes}>
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
          <ul className="member-list" aria-label={c.containers}>
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
            {t.common.cancel}
          </button>
          <button className="danger-button" onClick={() => void stop(confirm)}>
            {force
              ? c.force
              : scope === "service"
                ? c.stop
                : scope === "group"
                  ? c.stopProcesses(service.launchGroup.length)
                  : c.stopContainers(service.composeContainers.length)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
