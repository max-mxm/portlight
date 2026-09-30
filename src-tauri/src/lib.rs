use crate::i18n::l;
mod actions;
mod docker;
mod i18n;
mod lineage;
mod model;
mod monitor;
mod process;
mod project;
mod scan;
mod settings;
mod tray;
use actions::Scope;
use model::{Service, Snapshot, StopResult};
use settings::Settings;
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{window::Color, AppHandle, Emitter, Manager, RunEvent, Theme, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const SNAPSHOT_EVENT: &str = "portlight://snapshot";
/// Keeps the menu bar count current while the window is hidden.
const TRAY_REFRESH: Duration = Duration::from_secs(30);

/// Previous counters and last sample of the Processes view.
#[derive(Default)]
struct Activity {
    counters: Mutex<Option<monitor::Counters>>,
    last: Mutex<Option<monitor::ActivitySnapshot>>,
}

#[derive(Default)]
struct Inventory {
    snapshot: Mutex<Option<Snapshot>>,
    resistant: Mutex<HashSet<String>>,
    stopping: AtomicBool,
}

fn store(app: &AppHandle, snapshot: &Snapshot) -> Result<(), String> {
    *app.state::<Inventory>()
        .snapshot
        .lock()
        .map_err(|_| l("Inventory unavailable", "Inventaire indisponible"))? =
        Some(snapshot.clone());
    tray::update(app, snapshot);
    Ok(())
}

fn find(state: &Inventory, id: &str) -> Result<Service, String> {
    state
        .snapshot
        .lock()
        .map_err(|_| l("Inventory unavailable", "Inventaire indisponible"))?
        .as_ref()
        .and_then(|s| s.services.iter().find(|s| s.id == id))
        .cloned()
        .ok_or_else(|| {
            l(
                "Unknown service. Refresh the list.",
                "Service inconnu. Actualisez la liste.",
            )
            .into()
        })
}

/// Scans outside the UI thread, then updates the tray and the window.
pub fn refresh_in_background(app: AppHandle) {
    std::thread::spawn(move || {
        if let Ok(snapshot) = scan::snapshot() {
            if store(&app, &snapshot).is_ok() {
                let _ = app.emit(SNAPSHOT_EVENT, &snapshot);
            }
        }
    });
}

fn start_tray_refresh(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(TRAY_REFRESH);
        let state = app.state::<Inventory>();
        if state.stopping.load(Ordering::SeqCst) {
            continue;
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        // The visible window already refreshes every 10 seconds.
        let fresh = state.snapshot.lock().ok().and_then(|s| {
            s.as_ref()
                .map(|s| now.saturating_sub(s.scanned_at) < 25_000)
        });
        if fresh != Some(true) {
            refresh_in_background(app.clone());
        }
    });
}

#[tauri::command]
async fn scan_services(app: AppHandle) -> Result<Snapshot, String> {
    let snapshot = tauri::async_runtime::spawn_blocking(scan::snapshot)
        .await
        .map_err(|e| e.to_string())??;
    store(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
async fn stop_service(
    id: String,
    force: bool,
    scope: String,
    state: tauri::State<'_, Inventory>,
) -> Result<StopResult, String> {
    let scope = Scope::parse(&scope)?;
    let key = format!("{scope:?}:{id}");
    if force
        && !state
            .resistant
            .lock()
            .map_err(|_| l("State unavailable", "État indisponible"))?
            .contains(&key)
    {
        return Err(l(
            "Try a normal stop first.",
            "Essayez d’abord un arrêt normal.",
        )
        .into());
    }
    let service = find(&state, &id)?;
    let inventory = state
        .snapshot
        .lock()
        .map_err(|_| l("Inventory unavailable", "Inventaire indisponible"))?
        .as_ref()
        .map(|s| s.services.clone())
        .unwrap_or_default();
    if state
        .stopping
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(l(
            "A stop is already in progress. Please wait a moment.",
            "Un arrêt est déjà en cours. Patientez un instant.",
        )
        .into());
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        actions::stop(service, &inventory, force, scope)
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|result| result);
    state.stopping.store(false, Ordering::SeqCst);
    if let Ok(result) = &result {
        let mut resistant = state
            .resistant
            .lock()
            .map_err(|_| l("State unavailable", "État indisponible"))?;
        if result.stopped {
            resistant.remove(&key);
        } else {
            resistant.insert(key);
        }
    }
    result
}

/// Stops the services of a project group shown in the window.
#[tauri::command]
async fn stop_services(
    ids: Vec<String>,
    force: bool,
    state: tauri::State<'_, Inventory>,
) -> Result<StopResult, String> {
    let services = ids
        .iter()
        .map(|id| find(&state, id))
        .collect::<Result<Vec<_>, _>>()?;
    if services.is_empty() {
        return Err(l("No service to stop", "Aucun service à arrêter").into());
    }
    let key = |id: &str| format!("Group:{id}");
    // Processes only: containers are never forced.
    let processes: Vec<String> = services
        .iter()
        .filter(|s| s.container_id.is_none())
        .map(|s| key(&s.id))
        .collect();
    if force {
        let resistant = state
            .resistant
            .lock()
            .map_err(|_| l("State unavailable", "État indisponible"))?;
        if processes.is_empty() || processes.iter().any(|k| !resistant.contains(k)) {
            return Err(l(
                "Try a normal stop first.",
                "Essayez d’abord un arrêt normal.",
            )
            .into());
        }
    }
    let inventory = state
        .snapshot
        .lock()
        .map_err(|_| l("Inventory unavailable", "Inventaire indisponible"))?
        .as_ref()
        .map(|s| s.services.clone())
        .unwrap_or_default();
    if state
        .stopping
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(l(
            "A stop is already in progress. Please wait a moment.",
            "Un arrêt est déjà en cours. Patientez un instant.",
        )
        .into());
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        actions::stop_many(&services, &inventory, force)
    })
    .await
    .map_err(|e| e.to_string())
    .and_then(|result| result);
    state.stopping.store(false, Ordering::SeqCst);
    let stop = result?;
    let mut resistant = state
        .resistant
        .lock()
        .map_err(|_| l("State unavailable", "État indisponible"))?;
    for k in &processes {
        resistant.remove(k);
    }
    resistant.extend(stop.resisting.iter().map(|id| key(id)));
    Ok(stop.result)
}

/// Samples CPU and memory, per process and for the whole Mac.
#[tauri::command]
async fn sample_activity(
    state: tauri::State<'_, Activity>,
) -> Result<monitor::ActivitySnapshot, String> {
    let previous = state
        .counters
        .lock()
        .map_err(|_| l("State unavailable", "État indisponible"))?
        .take();
    let (snapshot, counters) =
        tauri::async_runtime::spawn_blocking(move || monitor::sample(previous))
            .await
            .map_err(|e| e.to_string())??;
    *state
        .counters
        .lock()
        .map_err(|_| l("State unavailable", "État indisponible"))? = Some(counters);
    *state
        .last
        .lock()
        .map_err(|_| l("State unavailable", "État indisponible"))? = Some(snapshot.clone());
    Ok(snapshot)
}

/// Quits applications and stops processes chosen in the Processes view.
#[tauri::command]
async fn stop_activity(
    ids: Vec<String>,
    force: bool,
    activity: tauri::State<'_, Activity>,
    state: tauri::State<'_, Inventory>,
) -> Result<StopResult, String> {
    if ids.is_empty() {
        return Err(l("No process to stop", "Aucun processus à arrêter").into());
    }
    let key = |id: &str| format!("Activity:{id}");
    let targets = {
        let last = activity
            .last
            .lock()
            .map_err(|_| l("State unavailable", "État indisponible"))?;
        let snapshot = last.as_ref().ok_or(l(
            "No sample yet. Refresh the list.",
            "Aucun relevé pour l’instant. Actualisez la liste.",
        ))?;
        ids.iter()
            .map(|id| monitor::resolve(snapshot, id).map(|t| (id.clone(), t)))
            .collect::<Result<Vec<_>, _>>()?
    };
    if force {
        let resistant = state
            .resistant
            .lock()
            .map_err(|_| l("State unavailable", "État indisponible"))?;
        if ids.iter().any(|id| !resistant.contains(&key(id))) {
            return Err(l(
                "Try a normal stop first.",
                "Essayez d’abord un arrêt normal.",
            )
            .into());
        }
    }
    if state
        .stopping
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(l(
            "A stop is already in progress. Please wait a moment.",
            "Un arrêt est déjà en cours. Patientez un instant.",
        )
        .into());
    }
    let result =
        tauri::async_runtime::spawn_blocking(move || actions::stop_activity(targets, force))
            .await
            .map_err(|e| e.to_string())
            .and_then(|result| result);
    state.stopping.store(false, Ordering::SeqCst);
    let stop = result?;
    let mut resistant = state
        .resistant
        .lock()
        .map_err(|_| l("State unavailable", "État indisponible"))?;
    for id in &ids {
        resistant.remove(&key(id));
    }
    resistant.extend(stop.resisting.iter().map(|id| key(id)));
    Ok(stop.result)
}

#[tauri::command]
async fn open_port(
    id: String,
    port: u16,
    state: tauri::State<'_, Inventory>,
) -> Result<(), String> {
    if !find(&state, &id)?.ports.contains(&port) {
        return Err(l("Port not in the inventory", "Port absent de l’inventaire").into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        process::output(
            "/usr/bin/open",
            &[&format!("http://localhost:{port}")],
            Duration::from_secs(3),
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(())
}

#[tauri::command]
async fn open_folder(
    id: String,
    editor: Option<String>,
    state: tauri::State<'_, Inventory>,
) -> Result<String, String> {
    let service = find(&state, &id)?;
    tauri::async_runtime::spawn_blocking(move || actions::open_folder(&service, editor.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn list_editors() -> Vec<String> {
    actions::editors()
}

#[tauri::command]
fn get_settings() -> Settings {
    settings::load()
}

#[tauri::command]
fn save_settings(settings: Settings) -> Result<Settings, String> {
    settings::save(settings)
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    if enabled {
        launcher.enable()
    } else {
        launcher.disable()
    }
    .map_err(|e| e.to_string())?;
    launcher.is_enabled().map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .manage(Inventory::default())
        .manage(Activity::default())
        .invoke_handler(tauri::generate_handler![
            scan_services,
            stop_service,
            stop_services,
            sample_activity,
            stop_activity,
            open_port,
            open_folder,
            list_editors,
            get_settings,
            save_settings,
            get_autostart,
            set_autostart
        ])
        .setup(|app| {
            // Applies the saved language before the menu bar is built.
            settings::load();
            tray::create(app.handle())?;
            // Matches macOS until the page applies the chosen theme (--bg in styles.css).
            if let Some(window) = app.get_webview_window("main") {
                let dark = window.theme().is_ok_and(|t| t == Theme::Dark);
                let _ = window.set_background_color(Some(if dark {
                    Color(0x12, 0x13, 0x23, 0xff)
                } else {
                    Color(0xf6, 0xf5, 0xf0, 0xff)
                }));
            }
            // Launched at login: stay in the menu bar until asked.
            if !std::env::args().any(|arg| arg == "--hidden") {
                tray::show_window(app.handle());
            }
            refresh_in_background(app.handle().clone());
            start_tray_refresh(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps Portlight available in the menu bar.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("Unable to start Portlight")
        .run(|app, event| {
            if let RunEvent::Reopen { .. } = event {
                tray::show_window(app);
            }
        });
}

pub fn print_snapshot() -> Result<(), String> {
    println!(
        "{}",
        serde_json::to_string_pretty(&scan::snapshot()?).map_err(|e| e.to_string())?
    );
    Ok(())
}
