# Portlight

[![CI](https://github.com/max-mxm/portlight/actions/workflows/ci.yml/badge.svg)](https://github.com/max-mxm/portlight/actions/workflows/ci.yml)
![macOS 12+](https://img.shields.io/badge/macOS-12%2B-181B34)
![Version 0.1.0](https://img.shields.io/badge/version-0.1.0-6161FF)
[![MIT License](https://img.shields.io/badge/license-MIT-00CA72)](LICENSE)

![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-CE422B?style=flat-square&logo=rust&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite 7](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)

A macOS app to find forgotten servers, identify occupied ports, and stop the right process or container.

**Tauri 2 · Rust · React · TypeScript · Vite**. No HTTP server in production, no account, and no cloud service. An English interface with French available, light and dark themes, bundled Space Grotesk and JetBrains Mono fonts, a square brutalist layout, and a palette inspired by Monday.

## Preview

![Portlight — overview of local ports and services](docs/images/portlight-overview.jpg)

The Portlight interface in English and light theme, rendered from a real inventory of the machine; the counters reflect it at the time of capture. The macOS window frame is not included. One view brings together ports, servers, containers, and long-running processes to review; search and actions are accessible from the keyboard.

## Getting started

Requirements: **macOS 12+**, **Node.js 22+**, **stable Rust**, and **Xcode Command Line Tools** (`xcode-select --install`). Docker is optional: its engine must be running to display containers. Portlight finds the Docker CLI of Docker Desktop (including a user install in `~/.docker/bin`), Homebrew or Colima, OrbStack and Rancher Desktop, and never lists their engine processes as stoppable. This version has been validated locally on Apple Silicon; other architectures still need verification.

```sh
git clone https://github.com/max-mxm/portlight.git
cd portlight
npm ci
npm run app:dev
```

`npm run dev` starts only the web interface, which cannot inspect or stop processes on its own. The Vite development server uses port `1420` on localhost. The compiled app does not open this port.

## Building the app

```sh
npm run app:build
open src-tauri/target/release/bundle/macos/Portlight.app
```

This local build is not signed with a Developer ID certificate or notarized. Public distribution will require Apple code signing and notarization.

To get a JSON snapshot without opening the window:

```sh
src-tauri/target/release/portlight --scan-json
```

## Usage

- Search by port, name, PID, command, or project. Filter by project in the sidebar.
- Group servers by git repository, wherever it is cloned: a worktree is grouped with its main repository.
- Review development processes that have been running for at least 8 hours in the “To review” view. This threshold does not prove that a server is unused.
- Request a normal stop (`SIGTERM`), check whether ports are released, and use a force stop if the process resists the normal stop.
- When `npm`, `pnpm`, `turbo`, `nodemon`… restarts the server, stop its launcher and the processes it started in one confirmed action. The details dialog shows the parent chain of every process.
- Stop the relevant Docker container with `docker stop --time 5`, or every container of its Compose project, without stopping the Docker engine.
- Check recent CPU and resident memory of each development process. Containers are described from their image (PostgreSQL, Redis, Mailpit, MinIO…).
- Open a web port in the browser (database, SMTP or ADB ports are not proposed), open the project folder in Finder or in your editor, or copy the stop command.
- Keep the last 50 actions in local history, pause automatic refresh, and follow the macOS theme or force light or dark.
- Use Portlight in English (default) or French, from the sidebar or the settings. The language also applies to the menu bar and to messages from the backend.
- Menu bar: the number of occupied development ports and a stop shortcut per service, always confirmed in the window. Closing the window keeps Portlight in the menu bar; quit it from the menu.
- Recognize development servers by program name (Node, Python, Ruby, PHP, Java, .NET, Elixir, databases…) and binaries built inside a repository (`cargo run`, `go run`, air).
- Settings: “To review” delay, project folders, extra development programs, preferred editor, and optional launch at login.
- Processes view, a visual `top`: CPU, memory, memory pressure and swap of the Mac, then every process grouped by application (Chrome and its helpers on one line), sorted by CPU, memory, name or uptime. Quit applications the way `⌘Q` does, stop other processes, and select several items to see what they would free before confirming.
- `⌘K`: quick actions, type `:3000` to free port 3000. `⌘F`: search. `⌘R`: refresh.

## How it works

1. Rust collects listening TCP ports with `lsof` and `netstat`, then reads the whole process table with a single `ps` call (metadata, parents, CPU, memory) and every working folder with a single `lsof` call. When Docker is available, published ports are associated with their containers, images and Compose projects through one `docker ps` and one `docker inspect`. A scan runs six system commands, whatever the number of services.
2. The interface receives an inventory through Tauri IPC commands. It groups services by project and lets you search for a port or process.
3. Stopping a service, its launcher group or its Compose project requires confirmation. The backend revalidates the target itself (PID and start time from the process table, container ID and start time from `docker inspect`, launcher identity, list of Compose containers) before sending `SIGTERM` or stopping containers, without scanning the whole machine again.
4. Portlight checks whether the ports have been released. If a process resists the normal stop, a force-stop action becomes available.

Rust sends the signals; commands supplied by the interface are never interpreted by a shell. The theme and history stay in the app’s local storage. There is no telemetry, account, or remote backend. The compiled frontend and fonts are bundled with the app.

## Architecture

- `src-tauri/src/scan.rs`: TCP inventory through lsof and netstat, and classification.
- `src-tauri/src/lineage.rs`: parent chain and launcher groups that can be stopped safely.
- `src-tauri/src/project.rs`: project names from configured folders, git root of a service.
- `src-tauri/src/docker.rs`: containers, published ports, Compose metadata, and uptime.
- `src-tauri/src/actions.rs`: target revalidation, signals, Compose stops, folder opening, and checks after stopping.
- `src-tauri/src/process.rs`: command execution without a shell, timeouts, and the process table.
- `src-tauri/src/settings.rs`: validated settings in `~/Library/Application Support/dev.portlight.desktop`.
- `src-tauri/src/tray.rs`: menu bar item.
- `src-tauri/src/monitor.rs`: live CPU and memory of the Mac and of each process, grouped by application.
- `src-tauri/src/lib.rs`: typed IPC commands; system work runs outside the UI thread.
- `src-tauri/src/i18n.rs` and `src/i18n/`: English and French texts; the French dictionary must match the English one, checked by TypeScript.
- `src/hooks/`: inventory, history, shortcuts, theme, and settings state.
- `src/`: interface, search, groups, dialogs, and history.
- `docs/design-decisions.md`: adaptation of the UI UX Pro Max design system to the macOS app.

## Current limitations

This first version lists **listening TCP ports**, not all UDP sockets or outgoing connections. Some system metadata may be unavailable without administrator privileges. macOS services, IDEs, emulators, and other users’ processes are protected. Stopping services from the interface is limited to recognized development processes owned by the current user and Docker containers. The Processes view can quit or stop any process of the current user, except macOS services, container engines and Portlight itself.

In the Processes view, CPU is measured between two samples, like `top`, but shown as a share of the whole Mac (all cores = 100 %, where `top` counts 100 % per core), so the processes add up to the CPU gauge. Every process is measured the same way, from its CPU time between two samples (nanosecond precision for the current user’s processes, 10 ms from `ps` for the others). The gauge comes from the machine-wide counters and is split into programs and kernel time; what no process accounts for (`kernel_task`, interrupts, memory compression, processes that came and went between samples) is shown as an “unattributed” line, so the lines add up exactly to the gauge. `top` leaves the same gap between its total and its processes. Memory is the footprint shown by Activity Monitor. macOS only exposes it for the current user’s processes: other processes show their resident memory (marked with `≈`). `top` reads it because it runs as root; Portlight does not ask for these privileges. The view samples every 2 seconds, only while it is visible.

Process identity checks use the PID and start time reported by `ps` (with one-second precision), with another check before sending a signal. This reduces the risk of PID reuse but does not provide the atomic guarantee of a process handle. A supervisor may restart a process; Portlight reports when a port remains occupied after a stop.

Portlight installs no background service. The inventory refreshes every 10 seconds while the window is visible; when the window is hidden, Portlight stays in the menu bar and refreshes every 30 seconds until you quit it. Launch at login is off by default and uses a LaunchAgent when enabled. History records only actions performed in Portlight, rather than continuously monitoring the system.

A launcher group is offered only when the launcher was started from a shell or reparented to launchd, and when every member belongs to the current user, is not a macOS binary and is not Portlight or one of its parents. A launcher started directly by an IDE or an agent is never included. CPU and memory are not collected for containers.

## Checks

```sh
npm run build
npm test
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

The Rust integration tests start their own Node servers on ephemeral ports. They check stale process identity, resistance to SIGTERM, forced termination with SIGKILL, port release, and the stop of a launcher group started from a test shell. They do not stop any pre-existing service. Component tests run with Testing Library in jsdom.

## Contributing

Conventions and validation steps are described in [CONTRIBUTING.md](CONTRIBUTING.md). Visual decisions are documented in [docs/design-decisions.md](docs/design-decisions.md). CI runs frontend and Rust checks on macOS for pushes to `main` and pull requests. These supporting documents are currently written in French.

## License

Portlight’s code is distributed under the [MIT License](LICENSE), © 2026 Maxime MxM. Dependencies retain their respective licenses; bundled font licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The palette is inspired by Monday. Portlight is an independent project with no affiliation with Monday.
