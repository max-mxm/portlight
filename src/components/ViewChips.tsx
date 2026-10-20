import type { Service, View } from "../types";
import { useT } from "../i18n";

/** The service views as filter chips, with their counts. */
export function ViewChips({
  view,
  devServices,
  oldServices,
  navigate,
  reviewHours,
}: {
  view: View;
  devServices: Service[];
  oldServices: Service[];
  navigate: (view: View) => void;
  reviewHours: number;
}) {
  const t = useT();
  const o = t.overview;
  const chips: [View, string, number][] = [
    ["all", o.all, devServices.length],
    [
      "process",
      o.servers,
      devServices.filter((s) => s.kind === "process").length,
    ],
    [
      "docker",
      o.containers,
      devServices.filter((s) => s.kind === "docker").length,
    ],
    ["old", o.toReview, oldServices.length],
  ];
  return (
    <div className="view-chips" role="group" aria-label={o.summary}>
      {chips.map(([id, label, count]) => (
        <button
          key={id}
          className={`chip ${id === "old" ? "review" : ""}`}
          aria-pressed={view === id}
          title={id === "old" ? o.reviewHelp(reviewHours) : undefined}
          onClick={() => navigate(id)}
        >
          {id === "old" && <span className="chip-key" aria-hidden="true" />}
          {label} <span className="chip-count">{count}</span>
        </button>
      ))}
    </div>
  );
}
