use crate::i18n::l;
use crate::tr;
use crate::{
    model::Service,
    process::{output, run},
    project,
};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

/// Docker CLI locations for Docker Desktop (system or user install),
/// Homebrew/Colima, OrbStack and Rancher Desktop, in order of preference.
fn candidates(home: &str) -> Vec<String> {
    let mut paths = vec![
        "/usr/local/bin/docker".to_string(),
        "/opt/homebrew/bin/docker".into(),
    ];
    if !home.is_empty() {
        for relative in [
            ".docker/bin/docker",
            ".orbstack/bin/docker",
            ".rd/bin/docker",
        ] {
            paths.push(format!("{}/{relative}", home.trim_end_matches('/')));
        }
    }
    paths.push("/Applications/Docker.app/Contents/Resources/bin/docker".into());
    paths.push("/Applications/OrbStack.app/Contents/MacOS/xbin/docker".into());
    paths
}

pub fn binary() -> Option<String> {
    // exists() follows symlinks: a link left by an uninstalled engine is skipped.
    candidates(&std::env::var("HOME").unwrap_or_default())
        .into_iter()
        .find(|p| Path::new(p).exists())
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
    id: String,
    started: String,
    #[serde(deserialize_with = "null_as_empty")]
    directory: String,
    #[serde(deserialize_with = "null_as_empty")]
    project: String,
    image: String,
    running: bool,
}

/// `index` on a missing label yields `null` in Docker's JSON template output.
fn null_as_empty<'de, D: serde::Deserializer<'de>>(d: D) -> Result<String, D::Error> {
    Ok(Option::<String>::deserialize(d)?.unwrap_or_default())
}

const INSPECT_FORMAT: &str = "{\"id\":{{json .Id}},\"started\":{{json .State.StartedAt}},\"directory\":{{json (index .Config.Labels \"com.docker.compose.project.working_dir\")}},\"project\":{{json (index .Config.Labels \"com.docker.compose.project\")}},\"image\":{{json .Config.Image}},\"running\":{{json .State.Running}}}";

/// Metadata of several containers in one `docker inspect` call. A container
/// removed since `docker ps` is missing from the result.
fn inspect(bin: &str, ids: &[&str]) -> Result<HashMap<String, Details>, String> {
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let mut args = vec!["inspect", "--format", INSPECT_FORMAT];
    args.extend(ids);
    let run = run(bin, &args, Duration::from_secs(6))?;
    let details = parse_inspect(&run.stdout)?;
    // "No such object": removed containers are simply absent.
    if details.is_empty() && !run.status.success() && !run.stderr.contains("No such") {
        return Err(format!("docker inspect : {}", run.stderr));
    }
    Ok(details)
}

/// Whether the inventoried container (same ID and start time) still runs.
pub fn running(id: &str, started: &str) -> Result<bool, String> {
    let bin = binary().ok_or(l("Docker unavailable", "Docker indisponible"))?;
    Ok(inspect(&bin, &[id])?
        .get(id)
        .is_some_and(|d| d.running && d.started == started))
}

fn parse_inspect(text: &str) -> Result<HashMap<String, Details>, String> {
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            serde_json::from_str::<Details>(line)
                .map(|d| (d.id.clone(), d))
                .map_err(|e| {
                    tr!(
                        "Invalid Docker metadata: {e}",
                        "Métadonnées Docker invalides : {e}"
                    )
                })
        })
        .collect()
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
            serde_json::from_str(line).map_err(|e| {
                tr!(
                    "Invalid Docker response: {e}",
                    "Réponse Docker invalide : {e}"
                )
            })
        })
        .collect()
}

/// Every running container of a Compose project, ports or not: (id, name).
pub fn compose_containers(project: &str) -> Result<Vec<(String, String)>, String> {
    let bin = binary().ok_or(l("Docker unavailable", "Docker indisponible"))?;
    let mut items: Vec<(String, String)> = rows(&bin, Some(project))?
        .into_iter()
        .filter(|row| row.compose == project)
        .map(|row| (row.id, row.name))
        .collect();
    items.sort_by(|a, b| a.1.cmp(&b.1));
    Ok(items)
}

pub fn list(roots: &[String]) -> Result<Vec<Service>, String> {
    let bin = binary().ok_or(l("Docker is not installed", "Docker n’est pas installé"))?;
    let rows = rows(&bin, None)?;
    let mut compose: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for row in rows.iter().filter(|r| !r.compose.is_empty()) {
        compose
            .entry(row.compose.clone())
            .or_default()
            .push(row.name.clone());
    }
    compose.values_mut().for_each(|names| names.sort());
    let published: Vec<(Row, Vec<(u16, String)>)> = rows
        .into_iter()
        .map(|row| {
            let bindings = port_bindings(&row.ports);
            (row, bindings)
        })
        .filter(|(_, bindings)| !bindings.is_empty())
        .collect();
    let ids: Vec<&str> = published.iter().map(|(row, _)| row.id.as_str()).collect();
    let mut details = inspect(&bin, &ids)?;
    let mut services = Vec::new();
    for (row, bindings) in published {
        let Some(detail) = details.remove(&row.id) else {
            continue;
        };
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
            image: (!detail.image.is_empty()).then_some(detail.image),
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
    fn docker_cli_locations() {
        let paths = candidates("/Users/a/");
        assert_eq!(paths[0], "/usr/local/bin/docker");
        assert!(paths.contains(&"/Users/a/.docker/bin/docker".to_string()));
        assert!(paths.contains(&"/Users/a/.orbstack/bin/docker".to_string()));
        assert!(paths.contains(&"/Users/a/.rd/bin/docker".to_string()));
        assert!(!candidates("").iter().any(|p| p.starts_with("/.")));
    }
    #[test]
    fn batched_inspect() {
        let details = parse_inspect(concat!(
            r#"{"id":"abc","started":"2026-09-27T08:00:00Z","directory":"/Users/a/GitHub/app","project":"app","image":"postgres:16-alpine","running":true}"#,
            "\n",
            r#"{"id":"def","started":"2026-09-27T08:00:01Z","directory":"","project":"","image":"axllent/mailpit","running":false}"#,
            "\n\n",
        ))
        .unwrap();
        assert_eq!(details.len(), 2);
        assert_eq!(details["abc"].image, "postgres:16-alpine");
        assert!(details["def"].project.is_empty());
        assert!(details["abc"].running && !details["def"].running);
        assert!(parse_inspect("not json").is_err());
    }
    #[test]
    fn missing_labels_are_null() {
        // Containers started without Compose (e.g. the Supabase CLI) lack the labels.
        let details = parse_inspect(
            r#"{"id":"abc","started":"2026-09-30T21:47:12Z","directory":null,"project":null,"image":"supabase/studio","running":true}"#,
        )
        .unwrap();
        assert!(details["abc"].directory.is_empty() && details["abc"].project.is_empty());
    }
    #[test]
    fn host_ports_only() {
        assert_eq!(
            port_bindings("0.0.0.0:9000->9000/tcp, [::]:9001->9001/tcp, 5432/tcp"),
            vec![(9000, "0.0.0.0".into()), (9001, "[::]".into())]
        );
    }
}
