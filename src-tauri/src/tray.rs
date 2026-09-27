use crate::{i18n::l, model::Snapshot, tr};
use std::collections::BTreeSet;
use tauri::{
    menu::{Menu, MenuBuilder, MenuEvent},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Wry,
};

const TRAY: &str = "portlight";
const MAX_ITEMS: usize = 15;
pub const CONFIRM_STOP: &str = "portlight://confirm-stop";

fn dev_ports(snapshot: &Snapshot) -> BTreeSet<u16> {
    snapshot
        .services
        .iter()
        .filter(|s| s.kind == "process" || s.kind == "docker")
        .flat_map(|s| s.ports.iter().copied())
        .collect()
}

fn menu(app: &AppHandle, snapshot: Option<&Snapshot>) -> tauri::Result<Menu<Wry>> {
    let mut builder = MenuBuilder::new(app);
    match snapshot {
        None => builder = builder.text("status", l("Scanning…", "Relevé en cours…")),
        Some(snapshot) => {
            let ports = dev_ports(snapshot);
            let services: Vec<_> = snapshot
                .services
                .iter()
                .filter(|s| s.stoppable && (s.kind == "process" || s.kind == "docker"))
                .collect();
            builder = builder.text(
                "status",
                match ports.len() {
                    0 => l(
                        "No development port in use",
                        "Aucun port de développement occupé",
                    )
                    .to_string(),
                    1 => l(
                        "1 development port in use",
                        "1 port de développement occupé",
                    )
                    .to_string(),
                    n => tr!(
                        "{n} development ports in use",
                        "{n} ports de développement occupés"
                    ),
                },
            );
            if !services.is_empty() {
                builder = builder.separator();
            }
            for service in services.iter().take(MAX_ITEMS) {
                let ports: Vec<String> = service.ports.iter().map(|p| format!(":{p}")).collect();
                let (name, ports, project) = (&service.name, ports.join(" "), &service.project);
                builder = builder.text(
                    format!("stop:{}", service.id),
                    tr!(
                        "Stop {name} {ports} — {project}",
                        "Arrêter {name} {ports} — {project}"
                    ),
                );
            }
            if services.len() > MAX_ITEMS {
                let more = services.len() - MAX_ITEMS;
                builder = builder.text(
                    "more",
                    tr!(
                        "{more} more services in Portlight…",
                        "{more} autres services dans Portlight…"
                    ),
                );
            }
        }
    }
    let menu = builder
        .separator()
        .text("open", l("Open Portlight", "Ouvrir Portlight"))
        .text("refresh", l("Refresh", "Actualiser"))
        .separator()
        .text("quit", l("Quit Portlight", "Quitter Portlight"))
        .build()?;
    if let Some(status) = menu.get("status").and_then(|i| i.as_menuitem().cloned()) {
        status.set_enabled(false)?;
    }
    Ok(menu)
}

pub fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn on_menu(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "open" | "more" => show_window(app),
        "refresh" => crate::refresh_in_background(app.clone()),
        "quit" => app.exit(0),
        id => {
            if let Some(service) = id.strip_prefix("stop:") {
                // The stop is always confirmed in the window.
                show_window(app);
                let _ = app.emit(CONFIRM_STOP, service.to_owned());
            }
        }
    }
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::with_id(TRAY)
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .tooltip("Portlight")
        .menu(&menu(app, None)?)
        .show_menu_on_left_click(true)
        .on_menu_event(on_menu)
        .build(app)?;
    Ok(())
}

pub fn update(app: &AppHandle, snapshot: &Snapshot) {
    let Some(tray) = app.tray_by_id(TRAY) else {
        return;
    };
    let ports = dev_ports(snapshot);
    if let Ok(menu) = menu(app, Some(snapshot)) {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = tray.set_title(Some(if ports.is_empty() {
        String::new()
    } else {
        ports.len().to_string()
    }));
    let count = ports.len();
    let _ = tray.set_tooltip(Some(tr!(
        "Portlight — {count} development ports",
        "Portlight — {count} ports de développement"
    )));
}
