// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { activity } from "../test/activity";
import { fireEvent, render, screen } from "@testing-library/react";
import { fixture } from "../test/fixture";
import { CommandPalette } from "./CommandPalette";
import { ServiceDetails } from "./ServiceDetails";
import { ServiceRow } from "./ServiceRow";
import { ServicesPanel } from "./ServicesPanel";
import { ProcessesPanel } from "./ProcessesPanel";
import { StopConfirmation } from "./StopConfirmation";
import { I18nProvider } from "../i18n";
import * as api from "../api";

// Sensors changed by a test, applied to the next snapshots.
const live = vi.hoisted(() => ({
  sensors: {} as Partial<import("../types").Sensors>,
}));
vi.mock("../hooks/useActivity", () => ({
  useActivity: () => {
    const snapshot = activity();
    Object.assign(snapshot.system.sensors, live.sensors);
    return { snapshot, error: "", refresh: vi.fn() };
  },
}));
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  stopActivity: vi.fn().mockResolvedValue({
    stopped: true,
    message: "Done.",
    remainingPorts: [],
  }),
}));

const group = [
  { pid: 40, name: "node pnpm", command: "node /x/pnpm dev", ports: [] },
  { pid: 42, name: "next-server", command: "next-server", ports: [3000] },
];

describe("Confirmation d’arrêt", () => {
  it("liste les processus du groupe et la commande équivalente", () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const service = fixture({ launchGroup: group });
    render(
      <StopConfirmation
        confirm={{ service, force: false, scope: "group" }}
        setConfirm={vi.fn()}
        stop={stop}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "Stop the launcher and its processes?",
      }),
    ).toBeTruthy();
    const members = screen.getByRole("list", { name: "Stopped processes" });
    expect(members.textContent).toContain("node pnpm");
    expect(members.textContent).toContain(":3000");
    expect(screen.getByText("kill -TERM 40 42")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop 2 processes" }));
    expect(stop).toHaveBeenCalledWith({
      service,
      force: false,
      scope: "group",
    });
  });
});

describe("Groupe de projet", () => {
  const web = fixture({ id: "web", project: "shop", launchGroup: group });
  const db = fixture({
    id: "db",
    project: "shop",
    kind: "docker",
    name: "shop-db-1",
    ports: [5432],
    composeProject: "shop",
    composeContainers: ["shop-cache-1", "shop-db-1"],
  });
  const renderPanel = (setConfirm = vi.fn(), resistant = new Set<string>()) =>
    render(
      <ServicesPanel
        project=""
        view="all"
        visible={[web, db]}
        query=""
        setQuery={vi.fn()}
        searchRef={{ current: null }}
        sort="project"
        setSort={vi.fn()}
        loading={false}
        snapshot={null}
        groups={[
          ["shop", [web, db]],
          ["blog", []],
        ]}
        busy={null}
        resistant={resistant}
        setDetails={vi.fn()}
        setConfirm={setConfirm}
        open={vi.fn()}
        reviewHours={8}
      />,
    );
  it("replie et déplie un groupe, puis tous les groupes", () => {
    localStorage.clear();
    renderPanel();
    const toggle = screen.getByRole("button", { name: /^shop\s*2 services$/ });
    expect(screen.getByText("shop-db-1")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("shop-db-1")).toBeNull();
    // One group still open: the toolbar offers to fold them all.
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse all groups" }),
    );
    expect(screen.queryByText("shop-db-1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand all groups" }));
    expect(screen.getByText("shop-db-1")).toBeTruthy();
    localStorage.clear();
  });
  it("arrête le groupe, puis force seulement les processus", () => {
    const setConfirm = vi.fn();
    renderPanel(setConfirm);
    fireEvent.click(screen.getAllByRole("button", { name: "Stop group" })[0]);
    expect(setConfirm).toHaveBeenCalledWith({
      service: web,
      force: false,
      scope: "project",
      group: { name: "shop", members: [web, db] },
    });
    const forced = vi.fn();
    renderPanel(forced, new Set(["project:shop"]));
    fireEvent.click(screen.getByRole("button", { name: "Force stop" }));
    expect(forced.mock.calls[0][0].group.members).toEqual([web]);
  });
  it("confirme avec la commande Docker groupée", () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const confirm = {
      service: web,
      force: false,
      scope: "project" as const,
      group: { name: "shop", members: [web, db] },
    };
    render(
      <StopConfirmation confirm={confirm} setConfirm={vi.fn()} stop={stop} />,
    );
    expect(
      screen.getByRole("heading", { name: "Stop the shop group?" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Stopped containers" }).textContent,
    ).toContain("shop-cache-1");
    expect(
      screen.getByText("kill -TERM 40 42 docker stop shop-cache-1 shop-db-1", {
        normalizer: (t) => t.replace(/\s+/g, " ").trim(),
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop the group" }));
    expect(stop).toHaveBeenCalledWith(confirm);
  });
});

describe("Palette", () => {
  const services = [
    fixture({ id: "web", ports: [3000] }),
    fixture({ id: "other", ports: [13000], name: "api" }),
    fixture({
      id: "sys",
      ports: [8021],
      name: "launchd",
      kind: "system",
      stoppable: false,
    }),
  ];
  const renderPalette = (query: string) => {
    const setConfirm = vi.fn();
    render(
      <CommandPalette
        setPalette={vi.fn()}
        paletteQuery={query}
        setPaletteQuery={vi.fn()}
        services={services}
        refresh={vi.fn()}
        setConfirm={setConfirm}
      />,
    );
    return setConfirm;
  };
  it("libère le port exact avec Entrée", () => {
    const setConfirm = renderPalette(":3000");
    expect(screen.queryByText(/13000/)).toBeNull();
    fireEvent.keyDown(screen.getByLabelText("Search an action"), {
      key: "Enter",
    });
    expect(setConfirm).toHaveBeenCalledWith({
      service: services[0],
      force: false,
      scope: "service",
    });
  });
  it("explique un port libre ou protégé", () => {
    renderPalette(":4000");
    expect(screen.getByText(/Port :4000 is free/)).toBeTruthy();
    cleanupAndRender(":8021");
    expect(
      screen.getByText(/is used by launchd, a protected service/),
    ).toBeTruthy();
  });
  function cleanupAndRender(query: string) {
    document.body.innerHTML = "";
    renderPalette(query);
  }
});

describe("Ligne de service", () => {
  it("n’ouvre dans le navigateur que les ports web", () => {
    const onOpen = vi.fn();
    render(
      <ServiceRow
        service={fixture({ ports: [3000, 5432] })}
        reviewHours={8}
        onDetails={vi.fn()}
        onStop={vi.fn()}
        onOpen={onOpen}
        busy={false}
        disabled={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open port 3000 in the browser",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(3000);
    expect(screen.queryByRole("button", { name: /5432/ })).toBeNull();
    expect(
      screen.getByTitle("Port 5432: service without a web page"),
    ).toBeTruthy();
    expect(screen.getByText("0.4% · 180 MB")).toBeTruthy();
  });
});

describe("Détails", () => {
  const props = {
    setDetails: vi.fn(),
    busy: null,
    copy: vi.fn(),
    editor: "Cursor",
    openFolder: vi.fn().mockResolvedValue(undefined),
  };
  it("propose l’arrêt forcé après une résistance, par portée", () => {
    const setConfirm = vi.fn();
    const details = fixture({ launchGroup: group });
    render(
      <ServiceDetails
        {...props}
        details={details}
        resistant={new Set(["group:1"])}
        setConfirm={setConfirm}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Stop this service" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Force stop the group" }),
    );
    expect(setConfirm).toHaveBeenCalledWith({
      service: details,
      force: true,
      scope: "group",
    });
  });
  it("ouvre le dossier dans l’éditeur réglé", () => {
    render(
      <ServiceDetails
        {...props}
        details={fixture()}
        resistant={new Set()}
        setConfirm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in Cursor" }));
    expect(props.openFolder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1" }),
      "Cursor",
    );
  });
  it("propose l’arrêt du projet Compose", () => {
    const setConfirm = vi.fn();
    render(
      <ServiceDetails
        {...props}
        details={fixture({
          kind: "docker",
          pid: 0,
          composeProject: "acme",
          composeContainers: ["db", "mailpit", "minio"],
        })}
        resistant={new Set()}
        setConfirm={setConfirm}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Stop the 3 containers" }),
    );
    expect(setConfirm.mock.calls[0][0].scope).toBe("compose");
  });
});

describe("Langue", () => {
  it("affiche l’interface en français quand elle est choisie", () => {
    render(
      <I18nProvider language="fr">
        <ServiceRow
          service={fixture({ ports: [3000] })}
          reviewHours={8}
          onDetails={vi.fn()}
          onStop={vi.fn()}
          onOpen={vi.fn()}
          busy={false}
          disabled={false}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /Arrêter/ })).toBeTruthy();
    expect(screen.getByText("0,4 % · 180 Mo")).toBeTruthy();
    expect(screen.getByText("Serveur de développement")).toBeTruthy();
  });
});

describe("Processus", () => {
  it("regroupe par application, sélectionne et confirme la fermeture", async () => {
    const record = vi.fn();
    render(
      <ProcessesPanel
        paused={false}
        services={[fixture({ pid: 20, project: "shop" })]}
        busy={null}
        setBusy={vi.fn()}
        setToast={vi.fn()}
        record={record}
      />,
    );
    const load = screen.getByRole("region", { name: "Load of this Mac" });
    expect(load.textContent).toContain("40 %");
    expect(load.textContent).toContain("30 % programs · 10 % kernel");
    // The unattributed CPU sits among the processes, sorted by CPU.
    const lines = screen
      .getAllByRole("row")
      .map((row) => row.querySelector("strong")?.textContent);
    expect(lines.indexOf("macOS kernel (unattributed)")).toBeGreaterThan(
      lines.indexOf("node"),
    );
    expect(screen.getByText("shop")).toBeTruthy();
    expect(screen.queryByText("launchd")).toBeNull();
    expect(screen.queryByText("Chrome Helper")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Show the processes of Chrome" }),
    );
    expect(screen.getByText("Chrome Helper")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Chrome" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select node (20)" }));
    expect(
      screen.getByRole("region", { name: "Selected items" }).textContent,
    ).toContain("2 selected");
    fireEvent.click(screen.getByRole("button", { name: "Quit the selection" }));
    expect(
      screen.getByRole("heading", { name: "Quit these 2 items?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quit" }));
    await vi.waitFor(() =>
      expect(api.stopActivity).toHaveBeenCalledWith(
        ["app:/Applications/Chrome.app", "pid:20"],
        false,
      ),
    );
    await vi.waitFor(() => expect(record).toHaveBeenCalled());
  });

  describe("capteurs", () => {
    const panel = (language: "en" | "fr" = "en") =>
      render(
        <I18nProvider language={language}>
          <ProcessesPanel
            paused={false}
            services={[]}
            busy={null}
            setBusy={vi.fn()}
            setToast={vi.fn()}
            record={vi.fn()}
          />
        </I18nProvider>,
      );
    const band = (name: string) =>
      screen.getByRole("region", { name }).textContent?.replace(/\u00a0/g, " ");
    afterEach(() => {
      live.sensors = {};
    });

    it("affiche température, ventilateur, GPU et puissance", () => {
      panel();
      const text = band("Sensors of this Mac");
      expect(text).toContain("65 °C");
      expect(text).toContain("CPU average · max 85 °C · normal");
      expect(text).toContain("2,484");
      expect(text).toContain("rpm · 37 % of max");
      expect(text).toContain("7 %used · 53 °C");
      expect(text).toContain("16.7 Wwhole Mac · on AC power");
    });

    it("signale le ralentissement thermique et un Mac sans ventilateur", () => {
      live.sensors = { thermalPressure: "heavy", fans: [], onBattery: true };
      panel("fr");
      const text = band("Capteurs de ce Mac");
      expect(text).toContain("moyenne processeur · max 85 °C · ralenti");
      expect(text).toContain("pas de ventilateur sur ce Mac");
      expect(text).toContain("16,7 WMac entier · sur batterie");
      expect(
        screen.getByTitle(/macOS réduit les performances/).className,
      ).toContain("pressure");
    });

    it("n’invente rien sur un Mac qui n’expose pas ses capteurs", () => {
      live.sensors = {
        cpuCelsius: null,
        cpuMaxCelsius: null,
        gpuCelsius: null,
        thermalPressure: null,
        fans: null,
        gpuPercent: null,
        powerWatts: null,
        onBattery: null,
      };
      panel();
      const text = band("Sensors of this Mac") ?? "";
      expect(text.match(/not exposed by this Mac/g)).toHaveLength(4);
      expect(text).not.toContain("no fan");
    });
  });
});
