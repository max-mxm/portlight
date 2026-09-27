use crate::{
    docker,
    model::{Service, Snapshot},
    process::{self, output},
};
use std::{
    collections::{BTreeMap, BTreeSet},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Default)]
pub struct Listener {
    pub pid: u32,
    pub name: String,
    pub ports: BTreeSet<u16>,
    pub addresses: BTreeSet<String>,
}

pub fn parse_lsof(text: &str) -> BTreeMap<u32, Listener> {
    let mut result = BTreeMap::new();
    let mut pid = 0;
    for line in text.lines() {
        if let Some(value) = line.strip_prefix('p') {
            pid = value.parse().unwrap_or(0);
        } else if let Some(name) = line.strip_prefix('c') {
            result
                .entry(pid)
                .or_insert_with(|| Listener {
                    pid,
                    ..Default::default()
                })
                .name = name.into();
        } else if let Some(value) = line.strip_prefix('n') {
            if let Some((address, port)) = value.rsplit_once(':') {
                if let Ok(port) = port.parse::<u16>() {
                    let item = result.entry(pid).or_insert_with(|| Listener {
                        pid,
                        ..Default::default()
                    });
                    item.ports.insert(port);
                    item.addresses.insert(address.into());
                }
            }
        }
    }
    result.retain(|pid, s| *pid > 0 && !s.ports.is_empty());
    result
}

fn listeners() -> Result<(BTreeMap<u32, Listener>, Vec<String>), String> {
    let text = output(
        "/usr/sbin/lsof",
        &["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"],
        Duration::from_secs(8),
    )?;
    let mut result = parse_lsof(&text);
    let mut warnings = Vec::new();
    // netstat sees launchd-owned sockets hidden from non-root lsof.
    match output(
        "/usr/sbin/netstat",
        &["-anv", "-p", "tcp"],
        Duration::from_secs(4),
    ) {
        Ok(text) => {
            for line in text.lines().filter(|l| l.contains("LISTEN")) {
                let cols: Vec<&str> = line.split_whitespace().collect();
                if cols.len() < 10 {
                    continue;
                }
                let Some(owner) = cols.iter().skip(6).find(|c| {
                    c.rsplit_once(':')
                        .is_some_and(|(_, p)| p.parse::<u32>().is_ok())
                }) else {
                    continue;
                };
                let Some((name, pid)) = owner.rsplit_once(':') else {
                    continue;
                };
                let Ok(pid) = pid.parse::<u32>() else {
                    continue;
                };
                let Some((address, port)) = cols[3].rsplit_once('.') else {
                    continue;
                };
                let Ok(port) = port.parse::<u16>() else {
                    continue;
                };
                let item = result.entry(pid).or_insert_with(|| Listener {
                    pid,
                    name: name.into(),
                    ..Default::default()
                });
                item.ports.insert(port);
                item.addresses.insert(address.into());
            }
        }
        Err(_) => warnings.push(
            "Certains ports système peuvent ne pas être visibles sans droits administrateur."
                .into(),
        ),
    }
    Ok((result, warnings))
}

fn project(cwd: &str, name: &str) -> String {
    if let Some((_, relative)) = cwd.split_once("/GitHub/") {
        return relative.split('/').next().unwrap_or(name).to_owned();
    }
    if cwd.is_empty()
        || cwd == "/"
        || cwd.starts_with("/System/")
        || cwd.starts_with("/Applications/")
    {
        return name.to_owned();
    }
    std::path::Path::new(cwd)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| name.into())
}

pub fn snapshot() -> Result<Snapshot, String> {
    let (listeners, mut warnings) = listeners()?;
    let (mut services, docker_available) = match docker::list() {
        Ok(items) => (items, true),
        Err(error) => {
            if docker::binary().is_some() {
                warnings.push(format!("Docker indisponible : {error}"));
            }
            (vec![], false)
        }
    };
    let docker_ports: BTreeSet<u16> = services
        .iter()
        .flat_map(|s| s.ports.iter().copied())
        .collect();
    let own_uid = unsafe { libc::geteuid() };
    for (_, listener) in listeners {
        let Ok(meta) = process::metadata(listener.pid) else {
            continue;
        };
        let cwd = process::cwd(listener.pid);
        let is_docker = listener.name.starts_with("com.docker");
        let ports: Vec<u16> = listener
            .ports
            .into_iter()
            .filter(|p| !is_docker || !docker_ports.contains(p))
            .collect();
        if ports.is_empty() {
            continue;
        }
        let native_path = meta.command.starts_with("/System/")
            || meta.command.starts_with("/usr/libexec/")
            || meta.command.starts_with("/usr/sbin/");
        let development = [
            "node", "bun", "deno", "python", "ruby", "php", "java", "redis", "postgres", "nginx",
            "caddy", "uvicorn", "cargo",
        ]
        .iter()
        .any(|n| listener.name.to_ascii_lowercase().starts_with(n))
            && !native_path;
        let protected =
            is_docker || !development || meta.uid != own_uid || listener.pid == std::process::id();
        let kind = if development {
            "process"
        } else if native_path || meta.uid != own_uid {
            "system"
        } else {
            "tool"
        };
        let name = if meta.command.starts_with("next-server") {
            "Next.js".into()
        } else if meta.command.contains("vite") {
            "Vite".into()
        } else {
            listener.name.clone()
        };
        let exposed = listener
            .addresses
            .iter()
            .any(|a| a == "*" || a == "0.0.0.0" || a == "::" || a == "[::]");
        services.push(Service {
            id: format!("process:{}:{}", listener.pid, meta.identity),
            pid: listener.pid,
            project: project(&cwd, &name),
            name,
            kind: kind.into(),
            ports,
            addresses: listener.addresses.into_iter().collect(),
            exposed,
            command: meta.command,
            cwd,
            elapsed_seconds: meta.elapsed,
            stoppable: !protected,
            reason: if protected {
                Some(
                    if is_docker {
                        "Le moteur Docker est protégé. Arrêtez le conteneur concerné."
                    } else {
                        "Outil ou service système protégé : fermez-le depuis son application."
                    }
                    .into(),
                )
            } else {
                None
            },
            stop_command: format!("kill -TERM {}", listener.pid),
            identity: meta.identity,
            container_id: None,
        });
    }
    services.sort_by(|a, b| {
        a.project
            .to_lowercase()
            .cmp(&b.project.to_lowercase())
            .then(a.ports.first().cmp(&b.ports.first()))
    });
    Ok(Snapshot {
        services,
        scanned_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        warnings,
        docker_available,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ipv6_and_duplicate_sockets() {
        let items = parse_lsof("p42\ncnode\nf1\nn[::1]:3000\nf2\nn127.0.0.1:3000\nf3\nn*:4178\n");
        let item = &items[&42];
        assert_eq!(
            item.ports.iter().copied().collect::<Vec<_>>(),
            vec![3000, 4178]
        );
        assert!(item.addresses.contains("[::1]"));
    }
    #[test]
    fn github_worktree_project() {
        assert_eq!(
            project(
                "/Users/a/Documents/GitHub/portfolio/.claude/worktrees/demo",
                "node"
            ),
            "portfolio"
        );
    }
}
