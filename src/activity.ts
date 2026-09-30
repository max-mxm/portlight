import type { ActivitySnapshot, AppGroup, ProcessInfo } from "./types";

/** A line of the Processes view: an application or a process on its own. */
export type ActivityRow =
  | { kind: "app"; id: string; app: AppGroup }
  | { kind: "process"; id: string; process: ProcessInfo };
export type ActivitySort = "cpu" | "memory" | "name" | "uptime";

export const rowValues = (row: ActivityRow) =>
  row.kind === "app" ? row.app : row.process;

function matches(row: ActivityRow, term: string) {
  if (!term) return true;
  const text = (p: ProcessInfo) =>
    `${p.name} ${p.pid} ${p.command}`.toLocaleLowerCase();
  return row.kind === "app"
    ? row.app.name.toLocaleLowerCase().includes(term) ||
        row.app.processes.some((p) => text(p).includes(term))
    : text(row.process).includes(term);
}

/** Rows shown for a filter and a search, sorted, heaviest first. */
export function activityRows(
  snapshot: ActivitySnapshot,
  mine: boolean,
  query: string,
  sort: ActivitySort,
): ActivityRow[] {
  const term = query.toLocaleLowerCase().trim();
  const rows: ActivityRow[] = [
    ...snapshot.apps.map((app) => ({ kind: "app" as const, id: app.id, app })),
    ...snapshot.processes.map((process) => ({
      kind: "process" as const,
      id: process.id,
      process,
    })),
  ];
  const name = (row: ActivityRow) => rowValues(row).name;
  return rows
    .filter((row) => (!mine || rowValues(row).own) && matches(row, term))
    .sort((a, b) => {
      const x = rowValues(a);
      const y = rowValues(b);
      if (sort === "name") return name(a).localeCompare(name(b));
      const key =
        sort === "cpu"
          ? y.cpuPercent - x.cpuPercent
          : sort === "memory"
            ? y.memoryBytes - x.memoryBytes
            : y.elapsedSeconds - x.elapsedSeconds;
      return key || name(a).localeCompare(name(b));
    });
}

/** Keeps the previous order: rows no longer jump under the pointer. New
 *  rows go last, rows that have exited disappear. */
export function holdOrder(ids: string[], previous: string[]) {
  const present = new Set(ids);
  const kept = previous.filter((id) => present.has(id));
  const known = new Set(kept);
  return [...kept, ...ids.filter((id) => !known.has(id))];
}

/** Memory and CPU that a selection would free. */
export function selectionTotals(rows: ActivityRow[], selected: Set<string>) {
  const chosen = rows.filter((row) => selected.has(row.id)).map(rowValues);
  return {
    count: chosen.length,
    memoryBytes: chosen.reduce((sum, v) => sum + v.memoryBytes, 0),
    cpuPercent: chosen.reduce((sum, v) => sum + v.cpuPercent, 0),
  };
}

/** Every line of a snapshot, app members included, by identifier. */
export function allRows(snapshot: ActivitySnapshot): ActivityRow[] {
  return [
    ...snapshot.apps.map((app) => ({ kind: "app" as const, id: app.id, app })),
    ...[
      ...snapshot.processes,
      ...snapshot.apps.flatMap((a) => a.processes),
    ].map((process) => ({ kind: "process" as const, id: process.id, process })),
  ];
}
