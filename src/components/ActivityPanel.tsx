import { Check, History, TriangleAlert } from "lucide-react";
import type { Activity } from "../types";
import { useT } from "../i18n";
export function ActivityPanel({
  activity,
  onClear,
}: {
  activity: Activity[];
  onClear: () => void;
}) {
  const t = useT();
  return (
    <section className="history-panel">
      <div className="panel-toolbar">
        <h2>{t.history.title}</h2>
        <span className="count-badge">{activity.length}</span>
        {activity.length > 0 && (
          <button className="text-button" onClick={onClear}>
            {t.history.clear}
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
              {new Date(a.at).toLocaleString(t.locale, {
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
          <h3>{t.history.emptyTitle}</h3>
          <p>{t.history.emptyText}</p>
        </div>
      )}
    </section>
  );
}
