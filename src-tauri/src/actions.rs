use crate::i18n::l;
use crate::tr;
use crate::{
    docker, lineage,
    model::{ProcessSummary, Service, StopResult},
    process, project, scan,
};
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
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
            _ => Err(l("Unknown stop type", "Type d’arrêt inconnu").into()),
        }
    }
}

fn used_ports(ports: &BTreeSet<u16>, listening: &BTreeSet<u16>) -> Vec<u16> {
    ports.intersection(listening).copied().collect()
}

fn alive(table: &HashMap<u32, process::ProcessEntry>, pid: u32, identity: &str) -> bool {
    table
        .get(&pid)
        .is_some_and(|p| p.identity == identity && !p.zombie)
}

fn summary(service: &Service) -> ProcessSummary {
    ProcessSummary {
        pid: service.pid,
        name: service.name.clone(),
        command: service.command.clone(),
        ports: service.ports.clone(),
        identity: service.identity.clone(),
    }
}

/// Stops an inventoried service. `inventory` is the snapshot the service
/// comes from; the target itself is revalidated (PID and start time, or
/// container ID and start time) without scanning the whole machine again.
pub fn stop(
    service: Service,
    inventory: &[Service],
    force: bool,
    scope: Scope,
) -> Result<StopResult, String> {
    if !service.stoppable {
        return Err(service
            .reason
            .unwrap_or(l("Protected service", "Service protégé").into()));
    }
    let running = match &service.container_id {
        Some(id) => docker::running(id, &service.identity)?,
        None => alive(&process::table()?, service.pid, &service.identity),
    };
    if !running {
        let ports = service.ports.iter().copied().collect();
        let remaining_ports = used_ports(&ports, &scan::listening_ports()?);
        return Ok(StopResult {
            stopped: true,
            message: if remaining_ports.is_empty() {
                l("This service is no longer running. Its ports are free.", "Ce service ne tourne plus. Ses ports sont libérés.")
            } else {
                l("This service is no longer running, but another process uses its ports.", "Ce service ne tourne plus, mais ses ports sont utilisés par un autre processus.")
            }
            .into(),
            remaining_ports,
        });
    }
    match scope {
        Scope::Service => stop_service(&service, force),
        Scope::Group => stop_group(&service, force),
        Scope::Compose => stop_compose(&service, inventory, force),
    }
}

fn stop_service(service: &Service, force: bool) -> Result<StopResult, String> {
    let still_running = if let Some(id) = &service.container_id {
        if force {
            return Err(l(
                "Force stop is not available for containers.",
                "L’arrêt forcé des conteneurs n’est pas proposé.",
            )
            .into());
        }
        let bin = docker::binary().ok_or(l("Docker unavailable", "Docker indisponible"))?;
        process::output(&bin, &["stop", "--time", "5", id], Duration::from_secs(12))?;
        docker::running(id, &service.identity)?
    } else {
        !signal_all(&[summary(service)], force)?.is_empty()
    };
    let ports = service.ports.iter().copied().collect();
    let remaining_ports = used_ports(&ports, &scan::listening_ports()?);
    let message = if still_running {
        l(
            "The process resists the normal stop. You can force it to stop.",
            "Le processus résiste à l’arrêt normal. Vous pouvez forcer son arrêt.",
        )
    } else if !remaining_ports.is_empty() {
        l(
            "Service stopped, but a process still uses some of its ports.",
            "Service arrêté, mais un processus utilise encore certains de ses ports.",
        )
    } else {
        l(
            "Service stopped. Its ports are free.",
            "Service arrêté. Ses ports sont libérés.",
        )
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
        let owned = table.get(&member.pid).is_some_and(|p| p.uid == uid);
        if !owned || !alive(&table, member.pid, &member.identity) {
            return Err(l(
                "The process identity has changed. Refresh the list.",
                "L’identité du processus a changé. Actualisez la liste.",
            )
            .into());
        }
    }
    let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
    for member in members {
        // Only owned, previously inventoried development processes reach this call.
        if unsafe { libc::kill(member.pid as i32, signal) } != 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(libc::ESRCH) {
                return Err(tr!("Stop refused: {error}", "Arrêt refusé : {error}"));
            }
        }
    }
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        thread::sleep(Duration::from_millis(120));
        let table = process::table()?;
        let survivors: Vec<u32> = members
            .iter()
            .filter(|m| alive(&table, m.pid, &m.identity))
            .map(|m| m.pid)
            .collect();
        if survivors.is_empty() || Instant::now() >= deadline {
            return Ok(survivors);
        }
    }
}

fn stop_group(service: &Service, force: bool) -> Result<StopResult, String> {
    let Some(shown) = service.launch_group.first() else {
        return Err(l(
            "This service has no launcher that can be stopped safely.",
            "Ce service n’a pas de lanceur qui peut être arrêté sans risque.",
        )
        .into());
    };
    // Recompute the group from the current process table.
    let table = process::table()?;
    let uid = unsafe { libc::geteuid() };
    let group = lineage::launch_group(
        &table,
        service.pid,
        uid,
        std::process::id(),
        &BTreeMap::new(),
    );
    if group
        .first()
        .is_none_or(|root| root.pid != shown.pid || root.identity != shown.identity)
    {
        return Err(l(
            "The launcher of this service has changed. Refresh the list.",
            "Le lanceur de ce service a changé. Actualisez la liste.",
        )
        .into());
    }
    let survivors = signal_all(&group, force)?;
    let ports: BTreeSet<u16> = service
        .launch_group
        .iter()
        .flat_map(|m| m.ports.iter().copied())
        .chain(service.ports.iter().copied())
        .collect();
    let remaining_ports = used_ports(&ports, &scan::listening_ports()?);
    let message = if !survivors.is_empty() {
        l(
            "Some processes resist the normal stop. You can force them to stop.",
            "Certains processus résistent à l’arrêt normal. Vous pouvez forcer leur arrêt.",
        )
    } else if !remaining_ports.is_empty() {
        l(
            "Processes stopped, but some ports are still in use.",
            "Processus arrêtés, mais certains ports sont encore utilisés.",
        )
    } else {
        l(
            "The launcher and its processes are stopped. The ports are free.",
            "Le lanceur et ses processus sont arrêtés. Les ports sont libérés.",
        )
    };
    Ok(StopResult {
        stopped: survivors.is_empty(),
        message: message.into(),
        remaining_ports,
    })
}

fn stop_compose(
    service: &Service,
    inventory: &[Service],
    force: bool,
) -> Result<StopResult, String> {
    if force {
        return Err(l(
            "Force stop is not available for containers.",
            "L’arrêt forcé des conteneurs n’est pas proposé.",
        )
        .into());
    }
    let Some(project) = service.compose_project.as_deref() else {
        return Err(l(
            "This container does not belong to a Compose project.",
            "Ce conteneur n’appartient pas à un projet Compose.",
        )
        .into());
    };
    let containers = docker::compose_containers(project)?;
    let names: Vec<&str> = containers.iter().map(|(_, n)| n.as_str()).collect();
    if names != service.compose_containers {
        return Err(l(
            "The project’s containers have changed. Refresh the list.",
            "Les conteneurs du projet ont changé. Actualisez la liste.",
        )
        .into());
    }
    let bin = docker::binary().ok_or(l("Docker unavailable", "Docker indisponible"))?;
    let mut args = vec!["stop", "--time", "5"];
    args.extend(containers.iter().map(|(id, _)| id.as_str()));
    process::output(&bin, &args, Duration::from_secs(30))?;
    let ports: BTreeSet<u16> = inventory
        .iter()
        .filter(|s| s.compose_project.as_deref() == Some(project))
        .chain(std::iter::once(service))
        .flat_map(|s| s.ports.iter().copied())
        .collect();
    let still_running = !docker::compose_containers(project)?.is_empty();
    let remaining_ports = used_ports(&ports, &scan::listening_ports()?);
    Ok(StopResult {
        stopped: !still_running,
        message: if still_running {
            l(
                "Some containers of the project are still running.",
                "Certains conteneurs du projet tournent encore.",
            )
        } else if !remaining_ports.is_empty() {
            l(
                "Compose project stopped, but some ports are still in use.",
                "Projet Compose arrêté, mais certains ports sont encore utilisés.",
            )
        } else {
            l(
                "Compose project stopped. Its ports are free.",
                "Projet Compose arrêté. Ses ports sont libérés.",
            )
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
        return Err(l(
            "Project folder unavailable",
            "Dossier du projet non disponible",
        )
        .into());
    }
    let folder = project::root(&service.cwd)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| service.cwd.clone());
    if !Path::new(&folder).is_dir() {
        return Err(l("This folder no longer exists", "Ce dossier n’existe plus").into());
    }
    let app = match editor {
        Some(name) => {
            let (_, bundle) = EDITORS
                .iter()
                .find(|(n, _)| *n == name)
                .ok_or(l("Unknown editor", "Éditeur inconnu"))?;
            Some(editor_path(bundle).ok_or(l(
                "This editor is not installed",
                "Cet éditeur n’est pas installé",
            ))?)
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
        // Same PID, other start time: a reused PID must never receive a signal.
        let mut stale = service.clone();
        stale.identity = "Mon Jan  1 00:00:00 2001".into();
        let result = stop(stale, &[], false, Scope::Service).unwrap();
        assert!(result.stopped);
        assert!(
            fixture.0.try_wait().unwrap().is_none(),
            "Une identité périmée ne doit envoyer aucun signal"
        );
        let result = stop(service.clone(), &[], false, Scope::Service).unwrap();
        assert!(!result.stopped);
        assert!(result.remaining_ports.contains(&port));
        let result = stop(service, &[], true, Scope::Service).unwrap();
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
        let result = stop(service, &[], false, Scope::Group).unwrap();
        assert!(result.stopped, "{}", result.message);
        assert!(result.remaining_ports.is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }
}
