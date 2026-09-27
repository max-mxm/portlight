import type { Messages } from "./i18n";
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
export function duration(seconds: number, t: Messages) {
  const u = t.units;
  if (!seconds) return u.none;
  if (seconds < 60) return u.underMinute;
  if (seconds < 3600) return u.minutes(Math.floor(seconds / 60));
  if (seconds < 86400)
    return u.hours(
      Math.floor(seconds / 3600),
      Math.floor((seconds % 3600) / 60)
        .toString()
        .padStart(2, "0"),
    );
  return u.days(
    Math.floor(seconds / 86400),
    Math.floor((seconds % 86400) / 3600),
  );
}
export function memory(bytes: number | null, t: Messages) {
  if (bytes === null) return t.units.none;
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return t.units.underMegabyte;
  if (mb < 1024) return t.units.megabytes(Math.round(mb));
  return t.units.gigabytes(
    (mb / 1024).toLocaleString(t.locale, { maximumFractionDigits: 1 }),
  );
}
export function cpu(percent: number | null, t: Messages) {
  if (percent === null) return t.units.none;
  return t.units.percent(
    percent.toLocaleString(t.locale, { maximumFractionDigits: 1 }),
  );
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
/** "ghcr.io/org/postgres:16@sha256:…" → "postgres". */
export function imageName(image: string | null) {
  if (!image) return null;
  const withoutDigest = image.split("@")[0];
  const repository = withoutDigest.slice(withoutDigest.lastIndexOf("/") + 1);
  return repository.split(":")[0].toLowerCase() || null;
}
type ImageKind = keyof Messages["describe"]["images"];
/** Common development images, matched on the repository name. */
const IMAGES: [string, ImageKind][] = [
  ["pgadmin", "pgadmin"],
  ["adminer", "adminer"],
  ["postgres", "postgres"],
  ["postgis", "postgres"],
  ["timescale", "postgres"],
  ["mysql", "mysql"],
  ["mariadb", "mariadb"],
  ["mongo", "mongo"],
  ["clickhouse", "clickhouse"],
  ["redis", "redis"],
  ["valkey", "valkey"],
  ["memcached", "memcached"],
  ["mailpit", "mail"],
  ["mailhog", "mail"],
  ["maildev", "mail"],
  ["minio", "minio"],
  ["localstack", "localstack"],
  ["rabbitmq", "rabbitmq"],
  ["kafka", "kafka"],
  ["redpanda", "redpanda"],
  ["nats", "nats"],
  ["elasticsearch", "search"],
  ["opensearch", "search"],
  ["meilisearch", "search"],
  ["typesense", "search"],
  ["keycloak", "keycloak"],
  ["powersync", "powersync"],
  ["grafana", "grafana"],
  ["prometheus", "prometheus"],
  ["jaeger", "jaeger"],
  ["nginx", "web"],
  ["caddy", "web"],
  ["traefik", "proxy"],
];
export function serviceDescription(s: Service, t: Messages) {
  const d = t.describe;
  if (s.kind === "docker") {
    const name = imageName(s.image);
    if (!name) return d.container;
    const kind = IMAGES.find(([pattern]) => name.includes(pattern))?.[1];
    return kind ? d.images[kind] : d.containerOf(name);
  }
  return s.name === "Next.js"
    ? d.nextjs
    : s.name === "Vite"
      ? d.vite
      : s.kind === "tool"
        ? d.tool
        : s.kind === "system"
          ? d.system
          : d.server;
}
