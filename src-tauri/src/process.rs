use crate::i18n::l;
use crate::tr;
use std::{
    collections::HashMap,
    io::Read,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

pub struct Run {
    pub status: std::process::ExitStatus,
    pub stdout: String,
    pub stderr: String,
}

// No shell interpolation. Timeouts also cover an unresponsive Docker daemon.
pub fn run(program: &str, args: &[&str], timeout: Duration) -> Result<Run, String> {
    let mut child = Command::new(program)
        .args(args)
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            tr!(
                "Unable to start {program}: {e}",
                "Impossible de lancer {program} : {e}"
            )
        })?;
    let mut stdout = child.stdout.take().ok_or(l(
        "Standard output unavailable",
        "Sortie standard indisponible",
    ))?;
    let mut stderr = child.stderr.take().ok_or(l(
        "Error output unavailable",
        "Sortie d’erreur indisponible",
    ))?;
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
                break Err(tr!(
                    "{program} did not respond in time",
                    "{program} ne répond pas dans le délai prévu"
                ));
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
        .map_err(|_| l("Reading interrupted", "Lecture interrompue"))?
        .map_err(|e| e.to_string())?;
    let errors = err
        .join()
        .map_err(|_| l("Reading interrupted", "Lecture interrompue"))?
        .map_err(|e| e.to_string())?;
    Ok(Run {
        status: status?,
        stdout: String::from_utf8_lossy(&bytes).into_owned(),
        stderr: String::from_utf8_lossy(&errors).trim().to_owned(),
    })
}

pub fn output(program: &str, args: &[&str], timeout: Duration) -> Result<String, String> {
    let run = run(program, args, timeout)?;
    // lsof exits 1 when there are no matching sockets.
    if !run.status.success()
        && !(program.ends_with("lsof") && run.status.code() == Some(1) && run.stderr.is_empty())
    {
        return Err(format!("{program} : {}", run.stderr));
    }
    Ok(run.stdout)
}

#[derive(Clone, Debug, PartialEq)]
pub struct ProcessEntry {
    pub pid: u32,
    pub ppid: u32,
    pub uid: u32,
    pub cpu: f32,
    pub rss_kb: u64,
    /// CPU time consumed since the start, in milliseconds (10 ms precision).
    pub cpu_time_ms: u64,
    /// Exited but not yet reaped by its parent: it holds no socket anymore.
    pub zombie: bool,
    pub identity: String,
    pub elapsed: u64,
    pub command: String,
}

const COLUMNS: &str = "pid=,ppid=,uid=,%cpu=,rss=,time=,stat=,lstart=,etime=,command=";

/// Parses `ps -o pid=,ppid=,uid=,%cpu=,rss=,time=,stat=,lstart=,etime=,command=` (LC_ALL=C).
pub fn parse_table(text: &str) -> Vec<ProcessEntry> {
    text.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 13 {
                return None;
            }
            Some(ProcessEntry {
                pid: parts[0].parse().ok()?,
                ppid: parts[1].parse().ok()?,
                uid: parts[2].parse().ok()?,
                cpu: parts[3].replace(',', ".").parse().unwrap_or(0.0),
                rss_kb: parts[4].parse().unwrap_or(0),
                cpu_time_ms: parse_cpu_time(parts[5]),
                zombie: parts[6].starts_with('Z'),
                // lstart: "Sat Sep 27 10:00:00 2026", one-second precision.
                identity: parts[7..12].join(" "),
                elapsed: parse_elapsed(parts[12]),
                command: parts[13..].join(" "),
            })
        })
        .collect()
}

/// Every process of the machine in a single ps call.
pub fn table() -> Result<HashMap<u32, ProcessEntry>, String> {
    let text = output("/bin/ps", &["-A", "-o", COLUMNS], Duration::from_secs(4))?;
    Ok(parse_table(&text).into_iter().map(|p| (p.pid, p)).collect())
}

/// "299:35.07" (minutes may exceed 60) or "1-02:03:04.50" → milliseconds.
pub fn parse_cpu_time(value: &str) -> u64 {
    let (days, clock) = value
        .split_once('-')
        .map(|(d, c)| (d.parse::<u64>().unwrap_or(0), c))
        .unwrap_or((0, value));
    let seconds = clock.split(':').fold(0.0, |total, part| {
        total * 60.0 + part.replace(',', ".").parse::<f64>().unwrap_or(0.0)
    });
    days * 86_400_000 + (seconds * 1000.0).round() as u64
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

/// Parses `lsof -a -d cwd -p … -Fpn`.
pub fn parse_cwds(text: &str) -> HashMap<u32, String> {
    let mut result = HashMap::new();
    let mut pid = None;
    for line in text.lines() {
        if let Some(value) = line.strip_prefix('p') {
            pid = value.parse().ok();
        } else if let (Some(pid), Some(path)) = (pid, line.strip_prefix('n')) {
            result.entry(pid).or_insert_with(|| path.to_owned());
        }
    }
    result
}

/// Working folders of several processes in one lsof call. A process that
/// has exited meanwhile is simply missing from the result.
pub fn cwds(pids: &[u32]) -> HashMap<u32, String> {
    if pids.is_empty() {
        return HashMap::new();
    }
    let list = pids
        .iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(",");
    run(
        "/usr/sbin/lsof",
        &["-a", "-p", &list, "-d", "cwd", "-Fpn"],
        Duration::from_secs(4),
    )
    .map(|run| parse_cwds(&run.stdout))
    .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cpu_time_formats() {
        assert_eq!(parse_cpu_time("299:35.07"), 17_975_070);
        assert_eq!(parse_cpu_time("0:00.01"), 10);
        assert_eq!(parse_cpu_time("1-02:03:04.50"), 93_784_500);
    }
    #[test]
    fn elapsed_formats() {
        assert_eq!(parse_elapsed("01-17:57:08"), 151028);
        assert_eq!(parse_elapsed("09:50"), 590);
        assert_eq!(parse_elapsed("02:00:00"), 7200);
    }
    #[test]
    fn working_folders() {
        let cwds = parse_cwds("p42\nfcwd\nn/Users/a/GitHub/app\np7\nfcwd\nn/\np9\n");
        assert_eq!(cwds[&42], "/Users/a/GitHub/app");
        assert_eq!(cwds[&7], "/");
        assert!(!cwds.contains_key(&9));
    }
    #[test]
    fn process_table() {
        let rows = parse_table(
            "    1     0     0  28.1   7904  15:37.11 Ss   Sun Sep 13 00:04:49 2026     14-20:19:10 /sbin/launchd\n\
             4242  4200   501   0,5 183200   0:01.50 S+   Sat Sep 27 09:12:03 2026        01:02:03 node  /x/next  dev\n\
             4243  4242   501   0.0      0   0:00.00 Z    Sat Sep 27 09:12:04 2026        01:02:02 (node)\n\
             bad line\n",
        );
        assert_eq!(rows.len(), 3);
        assert!(!rows[1].zombie);
        assert!(rows[2].zombie);
        assert_eq!(rows[0].elapsed, 14 * 86400 + 20 * 3600 + 19 * 60 + 10);
        let node = &rows[1];
        assert_eq!((node.pid, node.ppid, node.uid), (4242, 4200, 501));
        assert_eq!(node.cpu, 0.5);
        assert_eq!(node.rss_kb, 183200);
        assert_eq!(node.cpu_time_ms, 1500);
        assert_eq!(rows[0].cpu_time_ms, 937_110);
        assert_eq!(node.identity, "Sat Sep 27 09:12:03 2026");
        assert_eq!(node.command, "node /x/next dev");
    }
}
