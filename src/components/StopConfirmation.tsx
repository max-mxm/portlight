import { Box, FolderX, Layers3, Terminal } from "lucide-react";
import type { StopRequest } from "../types";
import {
  groupContainers,
  groupProcesses,
  groupStopCommand,
  stopCommand,
} from "../services";
import { useT, type Messages } from "../i18n";
import { Modal } from "./Modal";

function title({ force, scope, group }: StopRequest, c: Messages["confirm"]) {
  if (group)
    return force ? c.forceProjectTitle(group.name) : c.projectTitle(group.name);
  if (scope === "compose") return c.composeTitle;
  if (scope === "group") return force ? c.forceGroupTitle : c.groupTitle;
  return force ? c.forceTitle : c.title;
}

function explanation(
  { service, force, scope }: StopRequest,
  c: Messages["confirm"],
) {
  if (force)
    return scope === "group" || scope === "project"
      ? c.forceGroupText
      : c.forceText;
  if (scope === "project") return c.projectText;
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
  const { service, force, scope, group } = confirm;
  const Icon = group
    ? FolderX
    : scope === "compose"
      ? Layers3
      : service.kind === "docker"
        ? Box
        : Terminal;
  const members = group?.members ?? [];
  const processes = groupProcesses(members);
  const containers = groupContainers(members);
  const ports = [
    ...new Set((group ? members : [service]).flatMap((s) => s.ports)),
  ]
    .sort((a, b) => a - b)
    .map((p) => `:${p}`)
    .join(", ");
  return (
    <Modal title={title(confirm, c)} onClose={() => setConfirm(null)}>
      <div className="confirm-content">
        <div className="confirm-service">
          <span className="service-icon">
            <Icon aria-hidden="true" size={22} />
          </span>
          <div>
            <strong>
              {group
                ? group.name
                : scope === "compose"
                  ? service.composeProject
                  : service.name}
            </strong>
            <span>
              {group ? c.projectSummary(members.length) : service.project} ·{" "}
              {ports}
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
        {processes.length > 0 && (
          <ul className="member-list" aria-label={c.processes}>
            {processes.map((p) => (
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
        {containers.length > 0 && (
          <ul className="member-list" aria-label={c.containers}>
            {containers.map((name) => (
              <li key={name}>
                <Box aria-hidden="true" size={13} />
                <strong>{name}</strong>
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
          <code>
            {group
              ? groupStopCommand(members, force)
              : stopCommand(service, scope, force)}
          </code>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setConfirm(null)}>
            {t.common.cancel}
          </button>
          <button className="danger-button" onClick={() => void stop(confirm)}>
            {force
              ? c.force
              : scope === "project"
                ? c.stopGroup
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
