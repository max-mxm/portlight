import { describe, expect, it } from "vitest";
import {
  cpu,
  duration,
  isOld,
  isWebPort,
  memory,
  imageName,
  paletteMatches,
  portQuery,
  serviceDescription,
  stopCommand,
  visibleServices,
} from "./services";
import { fixture } from "./test/fixture";
import { en, fr } from "./i18n/messages";
describe("Recherche et périmètre des actions", () => {
  it("recherche un port et distingue les services protégés", () => {
    const list = [
      fixture(),
      fixture({ id: "2", kind: "system", ports: [8021], stoppable: false }),
    ];
    expect(visibleServices(list, "all", "3000", "")).toHaveLength(1);
    expect(visibleServices(list, "all", "8021", "")).toHaveLength(0);
    expect(visibleServices(list, "system", "8021", "")).toHaveLength(1);
  });
  it("ne qualifie pas un conteneur ancien de serveur oublié", () => {
    expect(isOld(fixture())).toBe(true);
    expect(isOld(fixture({ kind: "docker" }))).toBe(false);
    expect(isOld(fixture({ elapsedSeconds: 28799 }))).toBe(false);
  });
  it("applique le délai de vérification réglé", () => {
    const service = fixture({ elapsedSeconds: 3 * 3600 });
    expect(isOld(service, 2)).toBe(true);
    expect(isOld(service, 4)).toBe(false);
    expect(visibleServices([service], "old", "", "", 2)).toHaveLength(1);
    expect(visibleServices([service], "old", "", "")).toHaveLength(0);
  });
  it("filtre les projets indépendamment de la recherche", () => {
    expect(
      visibleServices([fixture()], "all", "NEXT", "storefront"),
    ).toHaveLength(1);
    expect(visibleServices([fixture()], "all", "", "portfolio")).toHaveLength(
      0,
    );
  });
  it("formate les durées sans arrondi trompeur", () => {
    expect(duration(151028, en)).toBe("1 d 17 h");
    expect(duration(36060, en)).toBe("10 h 01");
    expect(duration(151028, fr)).toBe("1 j 17 h");
  });
  it("formate les ressources", () => {
    expect(memory(null, en)).toBe("—");
    expect(memory(512 * 1024, en)).toBe("< 1 MB");
    expect(memory(180 * 1024 * 1024, en)).toBe("180 MB");
    expect(memory(1.5 * 1024 ** 3, en)).toBe("1.5 GB");
    expect(memory(1.5 * 1024 ** 3, fr)).toBe("1,5 Go");
    expect(cpu(12.25, en)).toBe("12.3%");
    expect(cpu(12.25, fr)).toBe("12,3 %");
    expect(cpu(null, en)).toBe("—");
  });
});

describe("Palette et ports", () => {
  const list = [
    fixture({ id: "a", ports: [3000] }),
    fixture({ id: "b", ports: [13000], name: "api" }),
    fixture({ id: "c", ports: [5432], kind: "docker", name: "db" }),
  ];
  it("reconnaît une recherche de port", () => {
    expect(portQuery(":3000")).toBe(3000);
    expect(portQuery(" 8080 ")).toBe(8080);
    expect(portQuery(":70000")).toBeNull();
    expect(portQuery("next")).toBeNull();
  });
  it("cible le port exact, pas un port qui le contient", () => {
    expect(paletteMatches(list, ":3000").map((s) => s.id)).toEqual(["a"]);
    expect(paletteMatches(list, "api").map((s) => s.id)).toEqual(["b"]);
    expect(paletteMatches(list, ":4000")).toHaveLength(0);
  });
  it("ne propose pas le navigateur pour les ports non web", () => {
    expect(isWebPort(3000)).toBe(true);
    expect(isWebPort(5432)).toBe(false);
    expect(isWebPort(6379)).toBe(false);
  });
});

describe("Description des conteneurs", () => {
  const container = (image: string | null, name = "app-1") =>
    serviceDescription(fixture({ kind: "docker", image, name }), en);
  it("se base sur l’image, pas sur le nom du conteneur", () => {
    expect(container("postgres:16-alpine")).toBe("PostgreSQL database");
    expect(container("bitnami/postgresql:17")).toBe("PostgreSQL database");
    expect(container("axllent/mailpit:latest")).toBe("Development mailbox");
    expect(container("journeyapps/powersync-service:latest")).toBe(
      "PowerSync sync",
    );
    expect(container("dpage/pgadmin4")).toBe("PostgreSQL administration");
    // Before, a name containing "pg-storage" was enough.
    expect(container("ghcr.io/acme/api:1.2", "pg-storage-1")).toBe(
      "Container · api",
    );
    expect(container(null)).toBe("Docker container");
  });
  it("se traduit en français", () => {
    expect(
      serviceDescription(fixture({ kind: "docker", image: "postgres:18" }), fr),
    ).toBe("Base de données PostgreSQL");
  });
  it("extrait le nom du dépôt de l’image", () => {
    expect(imageName("registry:5000/team/redis:7@sha256:abc")).toBe("redis");
    expect(imageName("")).toBeNull();
  });
});

describe("Commandes d’arrêt affichées", () => {
  const service = fixture({
    launchGroup: [
      { pid: 40, name: "pnpm", command: "pnpm dev", ports: [] },
      { pid: 42, name: "node", command: "next-server", ports: [3000] },
    ],
    composeContainers: ["app-db-1", "app-mail-1"],
  });
  it("décrit chaque portée", () => {
    expect(stopCommand(service, "service", false)).toBe("kill -TERM 42");
    expect(stopCommand(service, "service", true)).toBe("kill -KILL 42");
    expect(stopCommand(service, "group", false)).toBe("kill -TERM 40 42");
    expect(stopCommand(service, "group", true)).toBe("kill -KILL 40 42");
    expect(stopCommand(service, "compose", false)).toBe(
      "docker stop app-db-1 app-mail-1",
    );
  });
});
