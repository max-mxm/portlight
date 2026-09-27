mod actions;
mod docker;
mod model;
mod process;
mod scan;
use model::{Snapshot, StopResult};
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

#[derive(Default)]
struct Inventory {
    snapshot: Mutex<Option<Snapshot>>,
    resistant: Mutex<HashSet<String>>,
    stopping: AtomicBool,
}

#[tauri::command]
async fn scan_services(state: tauri::State<'_, Inventory>) -> Result<Snapshot, String> {
    let snapshot = tauri::async_runtime::spawn_blocking(scan::snapshot)
        .await
        .map_err(|e| e.to_string())??;
    *state
        .snapshot
        .lock()
        .map_err(|_| "Inventaire indisponible")? = Some(snapshot.clone());
    Ok(snapshot)
}

#[tauri::command]
async fn stop_service(
    id: String,
    force: bool,
    state: tauri::State<'_, Inventory>,
) -> Result<StopResult, String> {
    if force
        && !state
            .resistant
            .lock()
            .map_err(|_| "État indisponible")?
            .contains(&id)
    {
        return Err("Essayez d’abord un arrêt normal.".into());
    }
    let service = state
        .snapshot
        .lock()
        .map_err(|_| "Inventaire indisponible")?
        .as_ref()
        .and_then(|s| s.services.iter().find(|s| s.id == id))
        .cloned()
        .ok_or("Service inconnu. Actualisez la liste.")?;
    if state
        .stopping
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Un arrêt est déjà en cours. Patientez un instant.".into());
    }
    let result = tauri::async_runtime::spawn_blocking(move || actions::stop(service, force))
        .await
        .map_err(|e| e.to_string())
        .and_then(|result| result);
    state.stopping.store(false, Ordering::SeqCst);
    if let Ok(result) = &result {
        let mut resistant = state.resistant.lock().map_err(|_| "État indisponible")?;
        if result.stopped {
            resistant.remove(&id);
        } else {
            resistant.insert(id);
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
    let allowed = state
        .snapshot
        .lock()
        .map_err(|_| "Inventaire indisponible")?
        .as_ref()
        .is_some_and(|s| {
            s.services
                .iter()
                .any(|s| s.id == id && s.ports.contains(&port))
        });
    if !allowed {
        return Err("Port absent de l’inventaire".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        process::output(
            "/usr/bin/open",
            &[&format!("http://localhost:{port}")],
            std::time::Duration::from_secs(3),
        )
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(Inventory::default())
        .invoke_handler(tauri::generate_handler![
            scan_services,
            stop_service,
            open_port
        ])
        .run(tauri::generate_context!())
        .expect("Impossible de lancer Portlight");
}

pub fn print_snapshot() -> Result<(), String> {
    println!(
        "{}",
        serde_json::to_string_pretty(&scan::snapshot()?).map_err(|e| e.to_string())?
    );
    Ok(())
}
