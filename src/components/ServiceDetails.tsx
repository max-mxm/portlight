import { useState } from "react";
import { Check, Code2, Copy, FolderOpen, ShieldCheck } from "lucide-react";
import type { Service, StopRequest, StopScope } from "../types";
import { cpu, duration, memory, resistantKey } from "../services";
import { Modal } from "./Modal";
import { useT } from "../i18n";
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
  const t = useT();
  const d = t.details;
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
              ? d.docker
              : details.kind === "process"
                ? d.process
                : d.protected}
          </span>
          <span>{details.project}</span>
        </div>
        <dl>
          <dt>{d.ports}</dt>
          <dd>{details.ports.join(", ")}</dd>
          <dt>{d.pid}</dt>
          <dd>{details.pid || d.managedByDocker}</dd>
          {details.image && (
            <>
              <dt>{d.image}</dt>
              <dd className="mono">{details.image}</dd>
            </>
          )}
          <dt>{d.uptime}</dt>
          <dd>{duration(details.elapsedSeconds, t)}</dd>
          {details.memoryBytes !== null && (
            <>
              <dt>{d.resources}</dt>
              <dd className="mono">
                {d.resourcesValue(
                  cpu(details.cpuPercent, t),
                  memory(details.memoryBytes, t),
                )}
              </dd>
            </>
          )}
          <dt>{d.addresses}</dt>
          <dd className="mono">{details.addresses.join(", ")}</dd>
          <dt>{d.folder}</dt>
          <dd className="mono">{details.cwd || d.unavailable}</dd>
          <dt>{d.command}</dt>
          <dd>
            <pre>{details.command}</pre>
          </dd>
          {details.parents.length > 0 && (
            <>
              <dt>{d.launchedBy}</dt>
              <dd>
                <ol className="lineage" aria-label={d.parents}>
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
              {d.openFinder}
            </button>
            {editor && (
              <button
                className="secondary-button"
                onClick={() => void openFolder(details, editor)}
              >
                <Code2 aria-hidden="true" size={16} />
                {d.openEditor(editor)}
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
          <section className="scope-box" aria-label={d.launcher}>
            <div>
              <strong>{d.restarted}</strong>
              <p>
                {d.restartedText(
                  details.launchGroup[0].name,
                  details.launchGroup.map((p) => p.name).join(", "),
                )}
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={busy !== null}
              onClick={() => request("group")}
            >
              {forced("group")
                ? d.forceGroup
                : d.stopGroup(details.launchGroup.length)}
            </button>
          </section>
        )}
        {details.stoppable && compose && (
          <section className="scope-box" aria-label={d.composeLabel}>
            <div>
              <strong>{d.composeTitle(compose)}</strong>
              <p>{details.composeContainers.join(", ")}</p>
            </div>
            <button
              className="secondary-button"
              disabled={busy !== null}
              onClick={() => request("compose")}
            >
              {d.stopCompose(details.composeContainers.length)}
            </button>
          </section>
        )}
        {details.stoppable && (
          <div className="command-box">
            <span>{d.stopCommand}</span>
            <code>{details.stopCommand}</code>
            <button
              className="icon-button"
              aria-label={copyState === "copied" ? d.copied : d.copy}
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
                {copyState === "copied" ? d.copiedText : d.copyFailed}
              </span>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setDetails(null)}>
            {t.common.close}
          </button>
          {details.stoppable && (
            <button
              className="danger-button"
              disabled={busy !== null}
              onClick={() => request("service")}
            >
              {forced("service") ? d.force : d.stop}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
