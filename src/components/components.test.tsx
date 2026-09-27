// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { fixture } from "../test/fixture";
import { CommandPalette } from "./CommandPalette";
import { ServiceDetails } from "./ServiceDetails";
import { ServiceRow } from "./ServiceRow";
import { StopConfirmation } from "./StopConfirmation";

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
        name: "Arrêter le lanceur et ses processus ?",
      }),
    ).toBeTruthy();
    const members = screen.getByRole("list", { name: "Processus arrêtés" });
    expect(members.textContent).toContain("node pnpm");
    expect(members.textContent).toContain(":3000");
    expect(screen.getByText("kill -TERM 40 42")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Arrêter 2 processus" }),
    );
    expect(stop).toHaveBeenCalledWith({
      service,
      force: false,
      scope: "group",
    });
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
    fireEvent.keyDown(screen.getByLabelText("Chercher une action"), {
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
    expect(screen.getByText(/Le port :4000 est libre/)).toBeTruthy();
    cleanupAndRender(":8021");
    expect(
      screen.getByText(/utilisé par launchd, un service protégé/),
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
        name: "Ouvrir le port 3000 dans le navigateur",
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(3000);
    expect(screen.queryByRole("button", { name: /5432/ })).toBeNull();
    expect(screen.getByTitle("Port 5432 : service sans page web")).toBeTruthy();
    expect(screen.getByText("0,4 % · 180 Mo")).toBeTruthy();
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
      screen.getByRole("button", { name: "Arrêter ce service" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Forcer l’arrêt du groupe" }),
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
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir dans Cursor" }));
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
      screen.getByRole("button", { name: "Arrêter les 3 conteneurs" }),
    );
    expect(setConfirm.mock.calls[0][0].scope).toBe("compose");
  });
});
