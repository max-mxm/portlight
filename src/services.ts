import type { Service, StopScope, View } from "./types";
export const DEFAULT_REVIEW_HOURS = 8;
export function isOld(s: Service, reviewHours = DEFAULT_REVIEW_HOURS) {
  return s.kind === "process" && s.elapsedSeconds >= reviewHours * 3600;
}
export function visibleServices(
  services: Service[],
  view: View,
  query: string,
  project: string,
  reviewHours = DEFAULT_REVIEW_HOURS,
) {
  const term = query.toLocaleLowerCase().trim();
  return services.filter((s) => {
    const matchView =
      view === "all"
        ? s.kind !== "system" && s.kind !== "tool"
        : view === "old"
          ? isOld(s, reviewHours)
          : view === "system"
            ? s.kind === "system" || s.kind === "tool"
            : s.kind === view;
    return (
      matchView &&
      (!project || s.project === project) &&
      `${s.name} ${s.project} ${s.ports.join(" ")} ${s.pid} ${s.cwd} ${s.command}`
        .toLocaleLowerCase()
        .includes(term)
    );
  });
}
/** ":3000" or "3000" alone designates a port. */
export function portQuery(query: string): number | null {
  const match = /^:?(\d{1,5})$/.exec(query.trim());
  if (!match) return null;
  const port = Number(match[1]);
  return port > 0 && port <= 65535 ? port : null;
}
/** Palette results: exact port match for a port query, text search otherwise. */
export function paletteMatches(services: Service[], query: string) {
  const port = portQuery(query);
  const term = query.toLowerCase().trim();
  return services.filter((s) =>
    port !== null
      ? s.ports.includes(port)
      : `${s.name} ${s.project} ${s.ports.join(" ")}`
          .toLowerCase()
          .includes(term),
  );
}
/** Well-known ports that do not serve a web page. */
const NON_WEB_PORTS = new Set([
  22, 25, 53, 110, 143, 465, 587, 993, 995, 1025, 1433, 1521, 2375, 2376, 3306,
  4222, 5037, 5222, 5432, 5433, 5554, 5555, 5672, 6379, 6380, 9042, 9092, 11211,
  26257, 27017, 27018, 50051,
]);
export function isWebPort(port: number) {
  return !NON_WEB_PORTS.has(port);
}
export function duration(seconds: number) {
  if (!seconds) return "—";
  if (seconds < 60) return "< 1 min";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0")}`;
  return `${Math.floor(seconds / 86400)} j ${Math.floor((seconds % 86400) / 3600)} h`;
}
export function memory(bytes: number | null) {
  if (bytes === null) return "—";
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return "< 1 Mo";
  if (mb < 1024) return `${Math.round(mb)} Mo`;
  return `${(mb / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Go`;
}
export function cpu(percent: number | null) {
  if (percent === null) return "—";
  return `${percent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}
export function resistantKey(scope: StopScope, id: string) {
  return `${scope}:${id}`;
}
/** Equivalent command shown before a stop, never executed by a shell. */
export function stopCommand(s: Service, scope: StopScope, force: boolean) {
  if (scope === "compose")
    return `docker stop ${s.composeContainers.join(" ")}`;
  const signal = force ? "-KILL" : "-TERM";
  if (scope === "group")
    return `kill ${signal} ${s.launchGroup.map((p) => p.pid).join(" ")}`;
  return force ? `kill -KILL ${s.pid}` : s.stopCommand;
}
export function serviceDescription(s: Service) {
  if (s.kind === "docker")
    return s.ports.includes(5432) || s.name.includes("pg-storage")
      ? "Base de données PostgreSQL"
      : s.name.includes("mailpit")
        ? "Boîte mail de développement"
        : s.name.includes("minio")
          ? "Stockage compatible S3"
          : s.name.includes("powersync")
            ? "Synchronisation PowerSync"
            : "Conteneur Docker";
  return s.name === "Next.js"
    ? "Application web · Next.js"
    : s.name === "Vite"
      ? "Application web · Vite"
      : s.kind === "tool"
        ? "Service interne d’un outil"
        : s.kind === "system"
          ? "Service macOS"
          : "Serveur de développement";
}
