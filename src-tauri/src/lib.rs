mod actions;
mod docker;
mod lineage;
mod model;
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
use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const SNAPSHOT_EVENT: &str = "portlight://snapshot";
/// Keeps the menu bar count current while the window is hidden.
const TRAY_REFRESH: Duration = Duration::from_secs(30);

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
        .map_err(|_| "Inventaire indisponible")? = Some(snapshot.clone());
    tray::update(app, snapshot);
    Ok(())
}

fn find(state: &Inventory, id: &str) -> Result<Service, String> {
    state
        .snapshot
        .lock()
        .map_err(|_| "Inventaire indisponible")?
        .as_ref()
        .and_then(|s| s.services.iter().find(|s| s.id == id))
        .cloned()
        .ok_or_else(|| "Service inconnu. Actualisez la liste.".into())
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
            .map_err(|_| "État indisponible")?
            .contains(&key)
    {
        return Err("Essayez d’abord un arrêt normal.".into());
    }
    let service = find(&state, &id)?;
    if state
        .stopping
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Un arrêt est déjà en cours. Patientez un instant.".into());
    }
    let result = tauri::async_runtime::spawn_blocking(move || actions::stop(service, force, scope))
        .await
        .map_err(|e| e.to_string())
        .and_then(|result| result);
    state.stopping.store(false, Ordering::SeqCst);
    if let Ok(result) = &result {
        let mut resistant = state.resistant.lock().map_err(|_| "État indisponible")?;
        if result.stopped {
            resistant.remove(&key);
        } else {
            resistant.insert(key);
        }
    }
    result
}

#[tauri::command]
async fn open_port(
    id: String,
    port: u16,
    state: tauri::State<'_, Inventory>,
) -> Result<(), String> {
    if !find(&state, &id)?.ports.contains(&port) {
        return Err("Port absent de l’inventaire".into());
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
        .invoke_handler(tauri::generate_handler![
            scan_services,
            stop_service,
            open_port,
            open_folder,
            list_editors,
            get_settings,
            save_settings,
            get_autostart,
            set_autostart
        ])
        .setup(|app| {
            tray::create(app.handle())?;
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
        .expect("Impossible de lancer Portlight")
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
