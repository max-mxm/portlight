# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

macOS desktop app only (Tauri 2, WKWebView). The interface is web technology with its own design language, not AppKit; it still integrates the macOS title bar, menu bar, ⌘ shortcuts and the system light/dark appearance. Window minimum 800 × 600, default 1220 × 820.

## Users

Primary user: the author, a developer on an Apple silicon Mac who stacks local dev servers, monorepos (pnpm, turbo, worktrees) and Docker/Compose projects. Portlight is a personal tool published as open source (MIT); other developers are welcome, but they are not a design target. Design for one expert who knows `lsof`, `kill` and `docker stop`, and wants them faster and safer.

## Product Purpose

Find what holds a port or loads the Mac, and stop the right thing without fear.

Two moments carry the product, in this order:

1. **A port is taken, free it fast.** `EADDRINUSE :3000`: identify who holds the port and stop it cleanly in seconds, often from ⌘K (`:3000` frees port 3000).
2. **Watch the Mac.** The Processes view: understand why the Mac is hot or slow, which application consumes, and quit what weighs.

Secondary: periodic cleanup of forgotten servers (To review) and lingering containers; a menu bar glance at occupied ports.

Success: the right target is stopped on the first try, the port is verified free, and nothing the user did not choose is touched.

## Positioning

Portlight understands the development context and the machine together, where `lsof` and Activity Monitor show bare PIDs:

- Ports, processes and containers grouped by git project (worktrees included), with launcher chains (`npm`, `pnpm`, `turbo`, `nodemon`…) and Compose projects.
- Safe stops: the backend revalidates the target itself (PID and start time, container ID, launcher, Compose members), stops normally before forcing, then checks that the ports are released.
- A visual `top` as an equal pillar, not an add-on: CPU as a share of the whole Mac so that rows add up to the gauge, an explicit unattributed kernel line, memory pressure, swap and SMC sensors (temperature, fans, GPU, power). It aims to replace Activity Monitor and Stats for daily use.

## Operating Context

- Used beside a terminal, an editor and a browser while developing; the window is opened in reaction to an error or a slow Mac, then closed. Keyboard first: ⌘K quick actions, ⌘F search, ⌘R refresh.
- Menu bar icon with the count of occupied development ports and a stop shortcut per service, always confirmed in the window.
- Refresh every 10 s while the window is visible, every 30 s from the menu bar; Processes sampled every 2 s only while visible. No background service; launch at login is optional.

## Capabilities and Constraints

- Views: Overview, Servers, Docker, To review, System & tools, Processes, History (last 50 actions), Settings.
- Only listening TCP ports (no UDP, no outgoing connections). No administrator rights, so some system metadata may be missing. No CPU or memory for containers. Sensors come from undocumented SMC keys; a value the Mac does not expose stays empty, never estimated.
- Stops are limited to development processes of the current user and Docker containers; the Processes view can quit any process of the current user (applications like ⌘Q). macOS services, IDEs, emulators, container engines (never `com.docker.backend`) and Portlight itself are always protected.
- Every stop is confirmed and lists exactly the targets (PID, name, ports, containers) and the equivalent command.
- No HTTP server in production, no account, no telemetry, no cloud. Settings and history stay on the Mac. System commands run with structured arguments, never through a shell.
- The frontend sends an inventory identity; the backend resolves and revalidates the target. Collection, Docker, actions, IPC and UI stay separate.
- English by default, French available; every text lives in `src/i18n/messages.ts` and `src-tauri/src/i18n.rs`. Numbers, units and dates follow the language.
- Terminology: “To review” (servers running past a configurable threshold, 24 h by default), “Stop” / “Force stop”, “Quit” for applications, “Protected”, “unattributed” kernel CPU.
- Not signed with a Developer ID nor notarized; installation on other Macs is not validated.

## Brand Commitments

- Name **Portlight**, tagline “Local, under control.” App icon: a lighthouse on a violet square with an offset pink shadow, on the sidebar navy (`src-tauri/icon.svg`), with a monochrome menu bar template (`src-tauri/tray.svg`).
- **Square corners everywhere** (boxes, controls, meters, icons): binding, restated by the user on 2026-10-20.
- Voice: short, factual, reassuring about safety; controls name their action.
- **Monday palette** (violet #6161FF, mint #00CA72, yellow #FFCC00, pink #FB275D) as the base: binding, confirmed by the user on 2026-10-20. Fonts were left free; the programme guide chose Archivo and JetBrains Mono.
- **Two views**: the programme guide by default and a simplified view (setting and top-bar toggle), requested by the user on 2026-10-20.

## Evidence on Hand

- Real screenshot: `docs/images/portlight-overview.jpg`.
- Validation log on a real machine: `docs/validation.md`.
- Real inventory snapshots in `work/scan.json` and `work/verified-snapshot.json` (gitignored, machine-specific: use for realistic shapes, never publish).
- Test fixtures: `src/test/fixture.ts`, `src/test/activity.ts`.
- No users, testimonials, benchmarks or distribution claims exist. Do not invent them.

## Product Principles

1. **The right target, or nothing.** Safety beats speed: show exactly what will stop, revalidate, verify the port is free. Never widen a scope silently.
2. **Seconds from error to free port.** The port number is the entry point; keyboard paths come before pointer paths.
3. **Measured, never estimated.** Every figure is a real measurement with its unit and scale; approximations are marked (`≈`), missing values say so.
4. **The machine and the project, in one view.** Group by what the developer thinks in (projects, applications), not by what the OS stores.
5. **Local and quiet.** No network, no account, no background work beyond what the user sees.

## Accessibility & Inclusion

- WCAG AA contrast for text in light and dark, visible focus, full keyboard operation, focus trapping in dialogs, reduced motion respected.
- Color never carries meaning alone: words or icons accompany it.
- Open items from the 2026-10-20 audit: the focus ring falls under 3:1 on saturated surfaces; protection reasons and gauge help exist only as tooltips in the Processes view.
