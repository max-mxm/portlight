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

**Tauri 2 · Rust · React · TypeScript · Vite**. No HTTP server in production, no account, and no cloud service. A French-language interface with light and dark themes, bundled Space Grotesk and JetBrains Mono fonts, a square brutalist layout, and a palette inspired by Monday.

## Preview

![Portlight — overview of local ports and services](docs/images/portlight-overview.jpg)

An actual screenshot of the macOS app. The counters reflect the machine at the time of capture. One view brings together ports, servers, containers, and long-running processes to review; search and actions are accessible from the keyboard.

## Getting started

Requirements: **macOS 12+**, **Node.js 22+**, **stable Rust**, and **Xcode Command Line Tools** (`xcode-select --install`). Docker is optional: its engine must be running to display containers. This version has been validated locally on Apple Silicon; other architectures still need verification.

The repository is currently private. Cloning requires an authorized GitHub account and a configured SSH key.

```sh
git clone git@github.com:max-mxm/portlight.git
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
- Group servers by GitHub repository, including those started in a worktree.
- Review development processes that have been running for at least 8 hours in the “To review” view (shown as “À vérifier” in the French UI). This threshold does not prove that a server is unused.
- Request a normal stop (`SIGTERM`), check whether ports are released, and use a force stop if the process resists the normal stop.
- Stop the relevant Docker container with `docker stop --time 5`, without stopping the Docker engine.
- Open a port in the browser using HTTP, or copy its stop command from the details dialog.
- Keep the last 50 actions in local history, pause automatic refresh, and switch between light and dark themes.
- `⌘K`: quick actions. `⌘F`: search. `⌘R`: refresh.

## How it works

1. Rust collects listening TCP ports with `lsof` and `netstat`, then enriches process metadata with `ps`. When Docker is available, published ports are associated with their containers.
2. The interface receives an inventory through Tauri IPC commands. It groups services by project and lets you search for a port or process.
3. Stopping a service requires confirmation. The backend scans again and revalidates the target before sending `SIGTERM` or stopping the relevant Docker container.
4. Portlight checks whether the ports have been released. If a process resists the normal stop, a force-stop action becomes available.

Rust sends the signals; commands supplied by the interface are never interpreted by a shell. The theme and history stay in the app’s local storage. There is no telemetry, account, or remote backend. The compiled frontend and fonts are bundled with the app.

## Architecture

- `src-tauri/src/scan.rs`: TCP inventory through lsof and netstat, classification, and project detection.
- `src-tauri/src/docker.rs`: containers, published ports, Compose metadata, and uptime.
- `src-tauri/src/actions.rs`: target revalidation, signals, and checks after stopping.
- `src-tauri/src/process.rs`: command execution without a shell, timeouts, and process metadata.
- `src-tauri/src/lib.rs`: typed IPC commands; system work runs outside the UI thread.
- `src/`: interface, search, groups, shortcuts, dialogs, and history.
- `docs/design-decisions.md`: adaptation of the UI UX Pro Max design system to the macOS app.

## Current limitations

This first version lists **listening TCP ports**, not all UDP sockets or outgoing connections. Some system metadata may be unavailable without administrator privileges. macOS services, IDEs, emulators, and other users’ processes are protected. Stopping services from the interface is limited to recognized development processes owned by the current user and Docker containers.

Process identity checks use the PID and start time reported by `ps` (with one-second precision), with another check before sending a signal. This reduces the risk of PID reuse but does not provide the atomic guarantee of a process handle. A supervisor may restart a process; Portlight reports when a port remains occupied after a stop.

This version has no background service or automatic launch at login. The inventory refreshes every 10 seconds while the window is visible. History records only actions performed in Portlight, rather than continuously monitoring the system.

## Checks

```sh
npm run build
npm test
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

The Rust integration test starts its own Node server on an ephemeral port. It checks stale process identity, resistance to SIGTERM, forced termination with SIGKILL, and port release. It does not stop any pre-existing service.

## Contributing

Conventions and validation steps are described in [CONTRIBUTING.md](CONTRIBUTING.md). Visual decisions are documented in [docs/design-decisions.md](docs/design-decisions.md). CI runs frontend and Rust checks on macOS for pushes to `main` and pull requests. These supporting documents are currently written in French.

## License

Portlight’s code is distributed under the [MIT License](LICENSE), © 2026 Maxime MxM. The repository’s private visibility does not change the code’s license. Dependencies retain their respective licenses; bundled font licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The palette is inspired by Monday. Portlight is an independent project with no affiliation with Monday.
