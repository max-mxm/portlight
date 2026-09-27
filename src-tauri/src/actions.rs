use crate::{
    docker,
    model::{Service, StopResult},
    process, scan,
};
use std::{
    thread,
    time::{Duration, Instant},
};

pub fn stop(service: Service, force: bool) -> Result<StopResult, String> {
    if !service.stoppable {
        return Err(service.reason.unwrap_or("Service protégé".into()));
    }
    // Validate against a new scan, never trust PID / container supplied by the frontend.
    let current = scan::snapshot()?;
    let Some(verified) = current.services.iter().find(|s| s.id == service.id) else {
        let remaining_ports: Vec<u16> = service
            .ports
            .iter()
            .copied()
            .filter(|p| current.services.iter().any(|s| s.ports.contains(p)))
            .collect();
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
    if let Some(id) = &service.container_id {
        if force {
            return Err("L’arrêt forcé des conteneurs n’est pas proposé.".into());
        }
        let bin = docker::binary().ok_or("Docker indisponible")?;
        process::output(&bin, &["stop", "--time", "5", id], Duration::from_secs(12))?;
    } else {
        let meta = process::metadata(service.pid)?;
        if meta.identity != service.identity || meta.uid != unsafe { libc::geteuid() } {
            return Err("L’identité du processus a changé. Actualisez la liste.".into());
        }
        let signal = if force { libc::SIGKILL } else { libc::SIGTERM };
        // Only an owned, previously inventoried development process reaches this call.
        if unsafe { libc::kill(service.pid as i32, signal) } != 0 {
            return Err(format!(
                "Arrêt refusé : {}",
                std::io::Error::last_os_error()
            ));
        }
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if process::metadata(service.pid)
                .map(|m| m.identity != service.identity)
                .unwrap_or(true)
            {
                break;
            }
            thread::sleep(Duration::from_millis(120));
        }
    }
    let after = scan::snapshot()?;
    let still_running = after.services.iter().any(|s| s.id == service.id);
    let remaining_ports: Vec<u16> = service
        .ports
        .iter()
        .copied()
        .filter(|p| after.services.iter().any(|s| s.ports.contains(p)))
        .collect();
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
        let result = stop(stale, false).unwrap();
        assert!(result.stopped);
        assert!(
            fixture.0.try_wait().unwrap().is_none(),
            "Une identité périmée ne doit envoyer aucun signal"
        );
        let result = stop(service.clone(), false).unwrap();
        assert!(!result.stopped);
        assert!(result.remaining_ports.contains(&port));
        let result = stop(service, true).unwrap();
        assert!(result.stopped);
        assert!(result.remaining_ports.is_empty());
        let _ = fixture.0.wait();
    }
}
