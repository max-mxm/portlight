import { describe, expect, it } from "vitest";
import { duration, isOld, visibleServices } from "./services";
import type { Service } from "./types";
const fixture = (patch: Partial<Service> = {}): Service => ({
  id: "1",
  pid: 42,
  name: "node",
  project: "storefront",
  kind: "process",
  ports: [3000],
  addresses: ["*"],
  exposed: true,
  command: "next-server",
  cwd: "/GitHub/storefront/apps/web",
  elapsedSeconds: 36000,
  stoppable: true,
  reason: null,
  stopCommand: "kill -TERM 42",
  ...patch,
});
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
  it("filtre les projets indépendamment de la recherche", () => {
    expect(visibleServices([fixture()], "all", "NEXT", "storefront")).toHaveLength(
      1,
    );
    expect(visibleServices([fixture()], "all", "", "portfolio")).toHaveLength(
      0,
    );
  });
  it("formate les durées sans arrondi trompeur", () => {
    expect(duration(151028)).toBe("1 j 17 h");
    expect(duration(36060)).toBe("10 h 01");
  });
});
