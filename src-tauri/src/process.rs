use std::{
    io::Read,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

// No shell interpolation. Timeouts also cover an unresponsive Docker daemon.
pub fn output(program: &str, args: &[&str], timeout: Duration) -> Result<String, String> {
    let mut child = Command::new(program)
        .args(args)
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Impossible de lancer {program} : {e}"))?;
    let mut stdout = child.stdout.take().ok_or("Sortie standard indisponible")?;
    let mut stderr = child.stderr.take().ok_or("Sortie d’erreur indisponible")?;
    let out = thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout.read_to_end(&mut bytes).map(|_| bytes)
    });
    let err = thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr.read_to_end(&mut bytes).map(|_| bytes)
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if started.elapsed() < timeout => thread::sleep(Duration::from_millis(25)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(format!("{program} ne répond pas dans le délai prévu"));
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(e.to_string());
            }
        }
    };
    let bytes = out
        .join()
        .map_err(|_| "Lecture interrompue")?
        .map_err(|e| e.to_string())?;
    let errors = err
        .join()
        .map_err(|_| "Lecture interrompue")?
        .map_err(|e| e.to_string())?;
    let status = status?;
    // lsof exits 1 when there are no matching sockets.
    if !status.success()
        && !(program.ends_with("lsof") && status.code() == Some(1) && errors.is_empty())
    {
        return Err(format!(
            "{program} : {}",
            String::from_utf8_lossy(&errors).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[derive(Debug)]
pub struct Metadata {
    pub uid: u32,
    pub identity: String,
    pub command: String,
    pub elapsed: u64,
}

pub fn metadata(pid: u32) -> Result<Metadata, String> {
    let text = output(
        "/bin/ps",
        &["-p", &pid.to_string(), "-o", "uid=,lstart=,etime=,command="],
        Duration::from_secs(3),
    )?;
    let parts: Vec<&str> = text.split_whitespace().collect();
    if parts.len() < 8 {
        return Err("Ce processus a déjà quitté".into());
    }
    Ok(Metadata {
        uid: parts[0].parse().map_err(|_| "Utilisateur inconnu")?,
        identity: parts[1..6].join(" "),
        elapsed: parse_elapsed(parts[6]),
        command: parts[7..].join(" "),
    })
}

pub fn parse_elapsed(value: &str) -> u64 {
    let (days, clock) = value
        .split_once('-')
        .map(|(d, c)| (d.parse::<u64>().unwrap_or(0), c))
        .unwrap_or((0, value));
    days * 86400
        + clock.split(':').fold(0, |total, part| {
            total * 60 + part.parse::<u64>().unwrap_or(0)
        })
}

pub fn cwd(pid: u32) -> String {
    output(
        "/usr/sbin/lsof",
        &["-a", "-p", &pid.to_string(), "-d", "cwd", "-Fn"],
        Duration::from_secs(3),
    )
    .ok()
    .and_then(|text| {
        text.lines()
            .find_map(|line| line.strip_prefix('n').map(str::to_owned))
    })
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn elapsed_formats() {
        assert_eq!(parse_elapsed("01-17:57:08"), 151028);
        assert_eq!(parse_elapsed("09:50"), 590);
        assert_eq!(parse_elapsed("02:00:00"), 7200);
    }
}
