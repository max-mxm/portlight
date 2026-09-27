import type { Service, View } from "./types";
export function isOld(s: Service) {
  return s.kind === "process" && s.elapsedSeconds >= 8 * 3600;
}
export function visibleServices(
  services: Service[],
  view: View,
  query: string,
  project: string,
) {
  const term = query.toLocaleLowerCase().trim();
  return services.filter((s) => {
    const matchView =
      view === "all"
        ? s.kind !== "system" && s.kind !== "tool"
        : view === "old"
          ? isOld(s)
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
