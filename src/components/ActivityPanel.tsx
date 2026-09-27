import { Check, History, TriangleAlert } from "lucide-react";
import type { Activity } from "../types";
export function ActivityPanel({
  activity,
  onClear,
}: {
  activity: Activity[];
  onClear: () => void;
}) {
  return (
    <section className="history-panel">
      <div className="panel-toolbar">
        <h2>Journal des arrêts</h2>
        <span className="count-badge">{activity.length}</span>
        {activity.length > 0 && (
          <button className="text-button" onClick={onClear}>
            Effacer l’historique
          </button>
        )}
      </div>
      {activity.length ? (
        activity.map((a) => (
          <div className="history-row" key={a.id}>
            <span
              className={`history-icon ${a.success ? "success" : "pending"}`}
            >
              {a.success ? (
                <Check aria-hidden="true" size={18} />
              ) : (
                <TriangleAlert aria-hidden="true" size={18} />
              )}
            </span>
            <div>
              <strong>
                {a.name}{" "}
                <span className="mono">
                  {a.ports.map((p) => `:${p}`).join(" ")}
                </span>
              </strong>
              <p>{a.message}</p>
            </div>
            <time>
              {new Date(a.at).toLocaleString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <History aria-hidden="true" size={28} />
          <h3>Une page blanche, pour l’instant.</h3>
          <p>Les arrêts effectués dans Portlight apparaîtront ici.</p>
        </div>
      )}
    </section>
  );
}
