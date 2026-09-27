use crate::{model::Service, process::output, project};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, BTreeSet},
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
    compose: String,
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

const COMPOSE_LABEL: &str = "com.docker.compose.project";

/// Running containers as (id, name, compose project).
fn rows(bin: &str, filter: Option<&str>) -> Result<Vec<Row>, String> {
    let label = filter.map(|project| format!("label={COMPOSE_LABEL}={project}"));
    let mut args = vec![
        "ps",
        "--no-trunc",
        "--format",
        "{\"id\":\"{{.ID}}\",\"name\":\"{{.Names}}\",\"ports\":\"{{.Ports}}\",\"compose\":\"{{.Label \"com.docker.compose.project\"}}\"}",
    ];
    if let Some(label) = &label {
        args.extend(["--filter", label]);
    }
    let text = output(bin, &args, Duration::from_secs(4))?;
    text.lines()
        .filter(|s| !s.is_empty())
        .map(|line| {
            serde_json::from_str(line).map_err(|e| format!("Réponse Docker invalide : {e}"))
        })
        .collect()
}

/// Every running container of a Compose project, ports or not: (id, name).
pub fn compose_containers(project: &str) -> Result<Vec<(String, String)>, String> {
    let bin = binary().ok_or("Docker indisponible")?;
    let mut items: Vec<(String, String)> = rows(&bin, Some(project))?
        .into_iter()
        .filter(|row| row.compose == project)
        .map(|row| (row.id, row.name))
        .collect();
    items.sort_by(|a, b| a.1.cmp(&b.1));
    Ok(items)
}

pub fn list(roots: &[String]) -> Result<Vec<Service>, String> {
    let bin = binary().ok_or("Docker n’est pas installé")?;
    let rows = rows(&bin, None)?;
    let mut compose: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for row in rows.iter().filter(|r| !r.compose.is_empty()) {
        compose
            .entry(row.compose.clone())
            .or_default()
            .push(row.name.clone());
    }
    compose.values_mut().for_each(|names| names.sort());
    let mut services = Vec::new();
    for row in rows {
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
            project: project::name(&detail.directory, roots).unwrap_or_else(|| {
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
            cpu_percent: None,
            memory_bytes: None,
            parents: vec![],
            launch_group: vec![],
            compose_containers: compose.get(&row.compose).cloned().unwrap_or_default(),
            compose_project: (!row.compose.is_empty()).then(|| row.compose.clone()),
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
