use crate::{
    docker,
    model::{ProcessSummary, Service, Snapshot, StopResult},
    process, project, scan,
};
use std::{
    collections::BTreeSet,
    path::Path,
    thread,
    time::{Duration, Instant},
};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Scope {
    /// The listening process or container only.
    Service,
    /// The launcher (npm, turbo, nodemon…) and its descendants.
    Group,
    /// Every running container of the Compose project.
    Compose,
}

impl Scope {
    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "service" => Ok(Self::Service),
            "group" => Ok(Self::Group),
            "compose" => Ok(Self::Compose),
            _ => Err("Type d’arrêt inconnu".into()),
        }
    }
}

fn used_ports(ports: &BTreeSet<u16>, snapshot: &Snapshot) -> Vec<u16> {
    ports
        .iter()
        .copied()
        .filter(|p| snapshot.services.iter().any(|s| s.ports.contains(p)))
        .collect()
}

pub fn stop(service: Service, force: bool, scope: Scope) -> Result<StopResult, String> {
    if !service.stoppable {
        return Err(service.reason.unwrap_or("Service protégé".into()));
    }
    // Validate against a new scan, never trust PID / container supplied by the frontend.
    let current = scan::snapshot()?;
    let Some(verified) = current.services.iter().find(|s| s.id == service.id) else {
        let remaining_ports = used_ports(&service.ports.iter().copied().collect(), &current);
        return Ok(StopResult {
            stopped: true,
            message: if remaining_ports.is_empty() {
                "Ce service ne tourne plus. Ses ports sont libérés."
            } else {
                "Ce service ne tourne plus, mais ses ports sont utilisés par un autre processus."
            }
            .into(),
            remaining_ports,
        });
    };
    if !verified.stoppable {
        return Err("Ce service ne peut plus être arrêté.".into());
    }
    match scope {
        Scope::Service => stop_service(&service, force),
        Scope::Group => stop_group(&service, verified, force),
        Scope::Compose => stop_compose(&service, verified, &current, force),
    }
}

fn stop_service(service: &Service, force: bool) -> Result<StopResult, String> {
    if let Some(id) = &service.container_id {
        if force {
            return Err("L’arrêt forcé des conteneurs n’est pas proposé.".into());
        }
        let bin = docker::binary().ok_or("Docker indisponible")?;
        process::output(&bin, &["stop", "--time", "5", id], Duration::from_secs(12))?;
    } else {
        let member = ProcessSummary {
            pid: service.pid,
            name: service.name.clone(),
            command: service.command.clone(),
            ports: service.ports.clone(),
            identity: service.identity.clone(),
        };
        signal_all(&[member], force)?;
    }
    let after = scan::snapshot()?;
    let still_running = after.services.iter().any(|s| s.id == service.id);
    let remaining_ports = used_ports(&service.ports.iter().copied().collect(), &after);
    let message = if still_running {
        "Le processus résiste à l’arrêt normal. Vous pouvez forcer son arrêt."
    } else if !remaining_ports.is_empty() {
        "Service arrêté, mais un processus utilise encore certains de ses ports."
    } else {
        "Service arrêté. Ses ports sont libérés."
    };
    Ok(StopResult {
        stopped: !still_running,
        message: message.into(),
        remaining_ports,
    })
}

/// Signals owned processes whose identity (PID + start time) is unchanged,
/// then waits up to two seconds for them to exit. Returns the survivors.
fn signal_all(members: &[ProcessSummary], force: bool) -> Result<Vec<u32>, String> {
    let uid = unsafe { libc::geteuid() };
    // Revalidate every member right before the signal.
    let table = process::table()?;
    for member in members {
        let current = table.get(&member.pid);
        if current.is_none_or(|p| p.identity != member.identity || p.uid != uid) {
            return Err("L’identité du processus a changé. Actualisez la liste.".into());
        }
    }
    let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
    for member in members {
        // Only owned, previously inventoried development processes reach this call.
        if unsafe { libc::kill(member.pid as i32, signal) } != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(libc::ESRCH) {
                return Err(format!("Arrêt refusé : {error}"));
            }
        }
    }
    let alive = |table: &std::collections::HashMap<u32, process::ProcessEntry>| -> Vec<u32> {
        members
            .iter()
            .filter(|m| table.get(&m.pid).is_some_and(|p| p.identity == m.identity))
            .map(|m| m.pid)
            .collect()
    };
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        thread::sleep(Duration::from_millis(120));
        let survivors = process::table().map(|t| alive(&t))?;
        if survivors.is_empty() || Instant::now() >= deadline {
            return Ok(survivors);
        }
    }
}

fn stop_group(service: &Service, verified: &Service, force: bool) -> Result<StopResult, String> {
    let (Some(shown), Some(current)) =
        (service.launch_group.first(), verified.launch_group.first())
    else {
        return Err("Ce service n’a pas de lanceur qui peut être arrêté sans risque.".into());
    };
    if shown.pid != current.pid || shown.identity != current.identity {
        return Err("Le lanceur de ce service a changé. Actualisez la liste.".into());
    }
    let survivors = signal_all(&verified.launch_group, force)?;
    let ports: BTreeSet<u16> = verified
        .launch_group
        .iter()
        .flat_map(|m| m.ports.iter().copied())
        .chain(service.ports.iter().copied())
        .collect();
    let after = scan::snapshot()?;
    let remaining_ports = used_ports(&ports, &after);
    let message = if !survivors.is_empty() {
        "Certains processus résistent à l’arrêt normal. Vous pouvez forcer leur arrêt."
    } else if !remaining_ports.is_empty() {
        "Processus arrêtés, mais certains ports sont encore utilisés."
    } else {
        "Le lanceur et ses processus sont arrêtés. Les ports sont libérés."
    };
    Ok(StopResult {
        stopped: survivors.is_empty(),
        message: message.into(),
        remaining_ports,
    })
}

fn stop_compose(
    service: &Service,
    verified: &Service,
    current: &Snapshot,
    force: bool,
) -> Result<StopResult, String> {
    if force {
        return Err("L’arrêt forcé des conteneurs n’est pas proposé.".into());
    }
    let Some(project) = verified.compose_project.as_deref() else {
        return Err("Ce conteneur n’appartient pas à un projet Compose.".into());
    };
    if service.compose_project.as_deref() != Some(project) {
        return Err("Le projet Compose a changé. Actualisez la liste.".into());
    }
    let containers = docker::compose_containers(project)?;
    let names: Vec<&str> = containers.iter().map(|(_, n)| n.as_str()).collect();
    if names != service.compose_containers {
        return Err("Les conteneurs du projet ont changé. Actualisez la liste.".into());
    }
    let bin = docker::binary().ok_or("Docker indisponible")?;
    let mut args = vec!["stop", "--time", "5"];
    args.extend(containers.iter().map(|(id, _)| id.as_str()));
    process::output(&bin, &args, Duration::from_secs(30))?;
    let ports: BTreeSet<u16> = current
        .services
        .iter()
        .filter(|s| s.compose_project.as_deref() == Some(project))
        .flat_map(|s| s.ports.iter().copied())
        .collect();
    let after = scan::snapshot()?;
    let still_running = !docker::compose_containers(project)?.is_empty();
    let remaining_ports = used_ports(&ports, &after);
    Ok(StopResult {
        stopped: !still_running,
        message: if still_running {
            "Certains conteneurs du projet tournent encore."
        } else if !remaining_ports.is_empty() {
            "Projet Compose arrêté, mais certains ports sont encore utilisés."
        } else {
            "Projet Compose arrêté. Ses ports sont libérés."
        }
        .into(),
        remaining_ports,
    })
}

/// Editors proposed by "Ouvrir dans l’éditeur": (name, bundle).
pub const EDITORS: &[(&str, &str)] = &[
    ("Visual Studio Code", "Visual Studio Code.app"),
    ("Cursor", "Cursor.app"),
    ("Zed", "Zed.app"),
    ("Windsurf", "Windsurf.app"),
    ("WebStorm", "WebStorm.app"),
    ("IntelliJ IDEA", "IntelliJ IDEA.app"),
    ("IntelliJ IDEA CE", "IntelliJ IDEA CE.app"),
    ("PyCharm", "PyCharm.app"),
    ("RustRover", "RustRover.app"),
    ("Sublime Text", "Sublime Text.app"),
    ("Nova", "Nova.app"),
    ("Xcode", "Xcode.app"),
];

fn editor_path(bundle: &str) -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    [
        format!("/Applications/{bundle}"),
        format!("{home}/Applications/{bundle}"),
    ]
    .into_iter()
    .find(|p| Path::new(p).is_dir())
}

pub fn editors() -> Vec<String> {
    EDITORS
        .iter()
        .filter(|(_, bundle)| editor_path(bundle).is_some())
        .map(|(name, _)| name.to_string())
        .collect()
}

/// Opens the repository (or working folder) of an inventoried service in
/// Finder or in a known editor. `open` receives structured arguments.
pub fn open_folder(service: &Service, editor: Option<&str>) -> Result<String, String> {
    if service.cwd.is_empty() || service.cwd == "/" {
        return Err("Dossier du projet non disponible".into());
    }
    let folder = project::root(&service.cwd)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| service.cwd.clone());
    if !Path::new(&folder).is_dir() {
        return Err("Ce dossier n’existe plus".into());
    }
    let app = match editor {
        Some(name) => {
            let (_, bundle) = EDITORS
                .iter()
                .find(|(n, _)| *n == name)
                .ok_or("Éditeur inconnu")?;
            Some(editor_path(bundle).ok_or("Cet éditeur n’est pas installé")?)
        }
        None => None,
    };
    let mut args = Vec::new();
    if let Some(app) = &app {
        args.extend(["-a", app.as_str()]);
    }
    args.push(folder.as_str());
    process::output("/usr/bin/open", &args, Duration::from_secs(5))?;
    Ok(folder)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufRead, BufReader},
        process::{Command, Stdio},
    };

    struct Fixture(std::process::Child);
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }

    #[test]
    fn stop_only_owned_fixture_and_verify_ports() {
        let child=Command::new("node").args(["-e","process.on('SIGTERM',()=>{});const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port));"])
            .stdout(Stdio::piped()).spawn().expect("Node.js doit être installé pour ce test macOS");
        let mut fixture = Fixture(child);
        let mut line = String::new();
        BufReader::new(fixture.0.stdout.take().unwrap())
            .read_line(&mut line)
            .unwrap();
        let port = line.trim().parse::<u16>().unwrap();
        let service = scan::snapshot()
            .unwrap()
            .services
            .into_iter()
            .find(|s| s.pid == fixture.0.id())
            .expect("Le serveur temporaire doit être détecté");
        assert!(service.ports.contains(&port));
        assert!(service.stoppable);
        let mut stale = service.clone();
        stale.id.push_str("-stale");
        let result = stop(stale, false, Scope::Service).unwrap();
        assert!(result.stopped);
        assert!(
            fixture.0.try_wait().unwrap().is_none(),
            "Une identité périmée ne doit envoyer aucun signal"
        );
        let result = stop(service.clone(), false, Scope::Service).unwrap();
        assert!(!result.stopped);
        assert!(result.remaining_ports.contains(&port));
        let result = stop(service, true, Scope::Service).unwrap();
        assert!(result.stopped);
        assert!(result.remaining_ports.is_empty());
        let _ = fixture.0.wait();
    }

    /// Kills the whole fixture process group, even when the test fails.
    struct Group(std::process::Child);
    impl Drop for Group {
        fn drop(&mut self) {
            unsafe { libc::killpg(self.0.id() as i32, libc::SIGKILL) };
            let _ = self.0.wait();
        }
    }

    #[test]
    fn stop_launcher_group_created_by_the_test() {
        use std::os::unix::process::CommandExt;
        let dir = std::env::temp_dir().join(format!("portlight-group-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        // Named like a supervisor so that Portlight recognizes the launcher.
        let launcher = dir.join("nodemon.js");
        std::fs::write(
            &launcher,
            "require('child_process').spawn(process.execPath,['-e',\"const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>console.log(s.address().port))\"],{stdio:'inherit'});",
        )
        .unwrap();
        // `; true` keeps the shell as the launcher's parent, like a terminal.
        let script = format!("node '{}'; true", launcher.display());
        let child = Command::new("/bin/sh")
            .args(["-c", &script])
            .process_group(0)
            .stdout(Stdio::piped())
            .spawn()
            .expect("Node.js doit être installé pour ce test macOS");
        let mut fixture = Group(child);
        let mut line = String::new();
        BufReader::new(fixture.0.stdout.take().unwrap())
            .read_line(&mut line)
            .unwrap();
        let port = line.trim().parse::<u16>().unwrap();
        let service = scan::snapshot()
            .unwrap()
            .services
            .into_iter()
            .find(|s| s.kind == "process" && s.ports.contains(&port))
            .expect("Le serveur temporaire doit être détecté");
        let group = &service.launch_group;
        assert_eq!(group.len(), 2, "Lanceur et serveur : {group:?}");
        assert!(group[0].command.contains("nodemon.js"));
        assert_eq!(group[1].pid, service.pid);
        assert_eq!(group[1].ports, vec![port]);
        assert_eq!(
            service.parents[1].pid,
            fixture.0.id(),
            "Le shell du test est le grand-parent"
        );
        let result = stop(service, false, Scope::Group).unwrap();
        assert!(result.stopped, "{}", result.message);
        assert!(result.remaining_ports.is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }
}
