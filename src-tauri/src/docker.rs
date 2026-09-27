use crate::{model::Service, process::output};
use serde::Deserialize;
use std::{
    collections::BTreeSet,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub fn binary() -> Option<String> {
    [
        "/usr/local/bin/docker",
        "/opt/homebrew/bin/docker",
        "/Applications/Docker.app/Contents/Resources/bin/docker",
    ]
    .iter()
    .find(|p| Path::new(p).exists())
    .map(|p| p.to_string())
}

#[derive(Deserialize)]
struct Row {
    id: String,
    name: String,
    ports: String,
}
#[derive(Deserialize)]
struct Details {
    started: String,
    directory: String,
    project: String,
}

pub fn port_bindings(value: &str) -> Vec<(u16, String)> {
    value
        .split(',')
        .flat_map(|item| {
            let Some((host, target)) = item.trim().split_once("->") else {
                return vec![];
            };
            if !target.ends_with("/tcp") {
                return vec![];
            }
            let Some((address, port)) = host.rsplit_once(':') else {
                return vec![];
            };
            let (start, end) = port.split_once('-').unwrap_or((port, port));
            let (Ok(start), Ok(end)) = (start.parse::<u16>(), end.parse::<u16>()) else {
                return vec![];
            };
            if end < start || end - start > 1024 {
                return vec![];
            }
            (start..=end)
                .map(|p| (p, address.to_owned()))
                .collect::<Vec<_>>()
        })
        .collect()
}

pub fn list() -> Result<Vec<Service>, String> {
    let bin = binary().ok_or("Docker n’est pas installé")?;
    let text = output(
        &bin,
        &[
            "ps",
            "--no-trunc",
            "--format",
            "{\"id\":\"{{.ID}}\",\"name\":\"{{.Names}}\",\"ports\":\"{{.Ports}}\"}",
        ],
        Duration::from_secs(4),
    )?;
    let mut services = Vec::new();
    for line in text.lines().filter(|s| !s.is_empty()) {
        let row: Row =
            serde_json::from_str(line).map_err(|e| format!("Réponse Docker invalide : {e}"))?;
        let bindings = port_bindings(&row.ports);
        if bindings.is_empty() {
            continue;
        }
        let detail = output(&bin, &["inspect", "--format", "{\"started\":{{json .State.StartedAt}},\"directory\":{{json (index .Config.Labels \"com.docker.compose.project.working_dir\")}},\"project\":{{json (index .Config.Labels \"com.docker.compose.project\")}}}", &row.id], Duration::from_secs(3))?;
        // Missing labels are encoded as empty strings by Docker's template engine.
        let detail: Details = serde_json::from_str(&detail)
            .map_err(|e| format!("Métadonnées Docker invalides : {e}"))?;
        let ports: Vec<u16> = bindings
            .iter()
            .map(|(p, _)| *p)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        let addresses: Vec<String> = bindings
            .iter()
            .map(|(_, a)| a.clone())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        let exposed = addresses
            .iter()
            .any(|a| a == "0.0.0.0" || a == "[::]" || a == "::");
        services.push(Service {
            id: format!("docker:{}:{}", row.id, detail.started),
            pid: 0,
            name: row.name.clone(),
            project: detail
                .directory
                .split_once("/GitHub/")
                .and_then(|(_, relative)| relative.split('/').next())
                .filter(|p| !p.is_empty())
                .map(str::to_owned)
                .unwrap_or_else(|| {
                    if detail.project.is_empty() {
                        "Docker".into()
                    } else {
                        detail.project
                    }
                }),
            kind: "docker".into(),
            ports,
            addresses,
            exposed,
            command: format!("docker container {}", row.name),
            cwd: detail.directory,
            elapsed_seconds: chrono::DateTime::parse_from_rfc3339(&detail.started)
                .ok()
                .map(|dt| {
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                        .saturating_sub(dt.timestamp().max(0) as u64)
                })
                .unwrap_or(0),
            stoppable: true,
            reason: None,
            stop_command: format!("docker stop {}", row.name),
            identity: detail.started,
            container_id: Some(row.id),
        });
    }
    Ok(services)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ranges_and_udp() {
        assert_eq!(
            port_bindings("0.0.0.0:9000-9001->9000-9001/tcp, 0.0.0.0:5353->5353/udp"),
            vec![(9000, "0.0.0.0".into()), (9001, "0.0.0.0".into())]
        );
    }
    #[test]
    fn host_ports_only() {
        assert_eq!(
            port_bindings("0.0.0.0:9000->9000/tcp, [::]:9001->9001/tcp, 5432/tcp"),
            vec![(9000, "0.0.0.0".into()), (9001, "[::]".into())]
        );
    }
}
