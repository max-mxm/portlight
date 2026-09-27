use std::{
    collections::HashMap,
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

#[derive(Clone, Debug, PartialEq)]
pub struct ProcessEntry {
    pub pid: u32,
    pub ppid: u32,
    pub uid: u32,
    pub cpu: f32,
    pub rss_kb: u64,
    pub identity: String,
    pub elapsed: u64,
    pub command: String,
}

const COLUMNS: &str = "pid=,ppid=,uid=,%cpu=,rss=,lstart=,etime=,command=";

/// Parses `ps -o pid=,ppid=,uid=,%cpu=,rss=,lstart=,etime=,command=` (LC_ALL=C).
pub fn parse_table(text: &str) -> Vec<ProcessEntry> {
    text.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 11 {
                return None;
            }
            Some(ProcessEntry {
                pid: parts[0].parse().ok()?,
                ppid: parts[1].parse().ok()?,
                uid: parts[2].parse().ok()?,
                cpu: parts[3].replace(',', ".").parse().unwrap_or(0.0),
                rss_kb: parts[4].parse().unwrap_or(0),
                // lstart: "Sat Sep 27 10:00:00 2026", one-second precision.
                identity: parts[5..10].join(" "),
                elapsed: parse_elapsed(parts[10]),
                command: parts[11..].join(" "),
            })
        })
        .collect()
}

/// Every process of the machine in a single ps call.
pub fn table() -> Result<HashMap<u32, ProcessEntry>, String> {
    let text = output("/bin/ps", &["-A", "-o", COLUMNS], Duration::from_secs(4))?;
    Ok(parse_table(&text).into_iter().map(|p| (p.pid, p)).collect())
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
    #[test]
    fn process_table() {
        let rows = parse_table(
            "    1     0     0  28.1   7904 Sun Sep 13 00:04:49 2026     14-20:19:10 /sbin/launchd\n\
             4242  4200   501   0,5 183200 Sat Sep 27 09:12:03 2026        01:02:03 node  /x/next  dev\n\
             bad line\n",
        );
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].elapsed, 14 * 86400 + 20 * 3600 + 19 * 60 + 10);
        let node = &rows[1];
        assert_eq!((node.pid, node.ppid, node.uid), (4242, 4200, 501));
        assert_eq!(node.cpu, 0.5);
        assert_eq!(node.rss_kb, 183200);
        assert_eq!(node.identity, "Sat Sep 27 09:12:03 2026");
        assert_eq!(node.command, "node /x/next dev");
    }
}
