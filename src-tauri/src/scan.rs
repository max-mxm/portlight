use crate::{
    docker, lineage,
    model::{Service, Snapshot},
    process::{self, output},
    project,
    settings::{self, Settings},
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

/// Adds the sockets of `netstat -anv -p tcp` to the lsof inventory.
pub fn parse_netstat(text: &str, result: &mut BTreeMap<u32, Listener>) {
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
        Ok(text) => parse_netstat(&text, &mut result),
        Err(_) => warnings.push(
            "Certains ports système peuvent ne pas être visibles sans droits administrateur."
                .into(),
        ),
    }
    Ok((result, warnings))
}

const DEVELOPMENT: &[&str] = &[
    "node", "bun", "deno", "python", "ruby", "php", "java", "redis", "postgres", "nginx", "caddy",
    "uvicorn", "cargo",
];

/// Build daemons listen on a port but are not development servers:
/// (main class, tool). The class must be a whole argument, not a classpath.
const DAEMONS: &[(&str, &str)] = &[
    (
        "org.gradle.launcher.daemon.bootstrap.GradleDaemon",
        "Gradle",
    ),
    ("org.jetbrains.kotlin.daemon.KotlinCompileDaemon", "Kotlin"),
    ("scala.meta.metals.Main", "Metals"),
];

pub fn daemon(command: &str) -> Option<&'static str> {
    command.split_whitespace().find_map(|token| {
        DAEMONS
            .iter()
            .find(|(class, _)| token == *class)
            .map(|(_, tool)| *tool)
    })
}

pub struct Classification {
    pub kind: &'static str,
    pub stoppable: bool,
    pub reason: Option<&'static str>,
}

/// Only development processes owned by the user can be stopped. The Docker
/// engine, macOS binaries and Portlight itself are always protected.
pub fn classify(
    name: &str,
    command: &str,
    uid: u32,
    own_uid: u32,
    is_self: bool,
    extra: &[String],
) -> Classification {
    let is_docker = name.starts_with("com.docker") || name.starts_with("Docker");
    let native_path = command.starts_with("/System/")
        || command.starts_with("/usr/libexec/")
        || command.starts_with("/usr/sbin/");
    let lower = name.to_ascii_lowercase();
    let daemon = daemon(command);
    let development = !is_docker
        && !native_path
        && daemon.is_none()
        && (DEVELOPMENT.iter().any(|n| lower.starts_with(n))
            || extra.iter().any(|n| lower.starts_with(n.as_str())));
    let protected = !development || uid != own_uid || is_self;
    Classification {
        kind: if development {
            "process"
        } else if native_path || uid != own_uid {
            "system"
        } else {
            "tool"
        },
        stoppable: !protected,
        reason: protected.then_some(match daemon {
            _ if is_docker => "Le moteur Docker est protégé. Arrêtez le conteneur concerné.",
            Some("Gradle") => {
                "Démon Gradle protégé : lancez ./gradlew --stop depuis le projet pour l’arrêter."
            }
            Some(_) => "Démon d’outil de build protégé : arrêtez-le depuis son outil.",
            None => "Outil ou service système protégé : fermez-le depuis son application.",
        }),
    }
}

/// `~/.gradle/daemon/9.3.1` belongs to "gradle", not to a "9.3.1" project.
fn hidden_tool(cwd: &str, home: &str) -> Option<String> {
    let relative = cwd
        .strip_prefix(home.trim_end_matches('/'))?
        .strip_prefix('/')?;
    let first = relative.split('/').next()?;
    first
        .strip_prefix('.')
        .filter(|tool| !tool.is_empty())
        .map(str::to_owned)
}

fn project(cwd: &str, name: &str, roots: &[String]) -> String {
    if let Some(project) = project::name(cwd, roots) {
        return project;
    }
    if let Some(tool) = std::env::var("HOME")
        .ok()
        .and_then(|home| hidden_tool(cwd, &home))
    {
        return tool;
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
    snapshot_with(&settings::load())
}

pub fn snapshot_with(settings: &Settings) -> Result<Snapshot, String> {
    let (listeners, mut warnings) = listeners()?;
    let table = process::table()?;
    let (mut services, docker_available) = match docker::list(&settings.project_roots) {
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
    let own_pid = std::process::id();
    let listening: BTreeMap<u32, Vec<u16>> = listeners
        .values()
        .map(|l| (l.pid, l.ports.iter().copied().collect()))
        .collect();
    for (_, listener) in listeners {
        let Some(meta) = table.get(&listener.pid) else {
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
        let class = classify(
            &listener.name,
            &meta.command,
            meta.uid,
            own_uid,
            listener.pid == own_pid,
            &settings.dev_binaries,
        );
        let daemon = daemon(&meta.command);
        let name = if let Some(tool) = daemon {
            format!("Démon {tool}")
        } else if meta.command.starts_with("next-server") {
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
            project: match daemon {
                Some(tool) => tool.to_owned(),
                None => project(&cwd, &name, &settings.project_roots),
            },
            name,
            kind: class.kind.into(),
            ports,
            addresses: listener.addresses.into_iter().collect(),
            exposed,
            command: meta.command.clone(),
            cwd,
            elapsed_seconds: meta.elapsed,
            stoppable: class.stoppable,
            reason: class.reason.map(str::to_owned),
            stop_command: format!("kill -TERM {}", listener.pid),
            cpu_percent: Some(meta.cpu),
            memory_bytes: Some(meta.rss_kb * 1024),
            parents: lineage::parents(&table, listener.pid, &listening),
            launch_group: if class.stoppable {
                lineage::launch_group(&table, listener.pid, own_uid, own_pid, &listening)
            } else {
                vec![]
            },
            compose_project: None,
            compose_containers: vec![],
            identity: meta.identity.clone(),
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
                "node",
                &[]
            ),
            "portfolio"
        );
        assert_eq!(project("/", "rapportd", &[]), "rapportd");
        assert_eq!(project("/Users/a/sites/blog", "ruby", &[]), "blog");
    }
    #[test]
    fn build_daemons_are_protected_tools() {
        let gradle = "/Library/Java/JavaVirtualMachines/corretto-21.jdk/Contents/Home/bin/java \
            --add-opens=java.base/java.lang=ALL-UNNAMED -Xmx512m \
            -cp /Users/a/.gradle/wrapper/dists/gradle-9.3.1/lib/gradle-daemon-main-9.3.1.jar \
            org.gradle.launcher.daemon.bootstrap.GradleDaemon 9.3.1";
        assert_eq!(daemon(gradle), Some("Gradle"));
        let class = classify("java", gradle, 501, 501, false, &[]);
        assert_eq!((class.kind, class.stoppable), ("tool", false));
        assert!(class.reason.unwrap().contains("./gradlew --stop"));
        let kotlin = "java -cp /x/kotlin-daemon.jar org.jetbrains.kotlin.daemon.KotlinCompileDaemon --daemon-runFilesPath /x";
        assert!(!classify("java", kotlin, 501, 501, false, &[]).stoppable);
        // A Spring app started by Gradle keeps its gradle jars on the classpath.
        let app = "java -cp /Users/a/.gradle/caches/gradle-daemon-main.jar com.example.Application";
        assert_eq!(daemon(app), None);
        assert!(classify("java", app, 501, 501, false, &[]).stoppable);
    }
    #[test]
    fn hidden_home_folders_name_their_tool() {
        assert_eq!(
            hidden_tool("/Users/a/.gradle/daemon/9.3.1", "/Users/a").as_deref(),
            Some("gradle")
        );
        assert_eq!(hidden_tool("/Users/a/sites/blog", "/Users/a"), None);
        assert_eq!(hidden_tool("/Users/ab/.x", "/Users/a"), None);
        assert_eq!(hidden_tool("/Users/a", "/Users/a"), None);
    }
    #[test]
    fn netstat_adds_launchd_sockets() {
        let text = "Proto Recv-Q Send-Q  Local Address          Foreign Address        (state)          rxbytes      txbytes  rhiwat  shiwat          process:pid    state  options\n\
tcp4       0      0  127.0.0.1.6402         *.*                    LISTEN                 0            0  131072  131072          netsimd:94783  00000 00000006 00000000028d0f85 00000001 00000800      2      0 000000\n\
tcp6       0      0  ::1.54833              *.*                    LISTEN                 0            0  131072  131072          netsimd:94783  00100 00000006 00000000028d0f83 00000001 00000800      1      0 000000\n\
tcp4       0      0  *.8021                 *.*                    LISTEN                 0            0  131072  131072       launchd:1  00100 00000006 00000000028d0f80 00000001 00000800      1      0 000000\n\
tcp4       0      0  127.0.0.1.50000        127.0.0.1.3000         ESTABLISHED            0            0  131072  131072          node:42  00100 00000006 00000000028d0f80 00000001 00000800      1      0 000000\n";
        let mut result = BTreeMap::new();
        parse_netstat(text, &mut result);
        assert_eq!(result.len(), 2);
        let netsim = &result[&94783];
        assert_eq!(netsim.name, "netsimd");
        assert_eq!(
            netsim.ports.iter().copied().collect::<Vec<_>>(),
            vec![6402, 54833]
        );
        assert!(netsim.addresses.contains("::1"));
        assert!(result[&1].addresses.contains("*"));
        assert!(
            !result.contains_key(&42),
            "Seuls les sockets en écoute comptent"
        );
    }
    #[test]
    fn classification_protects_engine_and_system() {
        let dev = classify("node", "node server.js", 501, 501, false, &[]);
        assert!(dev.stoppable);
        assert_eq!(dev.kind, "process");
        let docker = classify(
            "com.docker.backend",
            "/Applications/Docker.app/x",
            501,
            501,
            false,
            &["com".into()],
        );
        assert!(!docker.stoppable);
        assert!(docker.reason.unwrap().contains("Docker"));
        let other_user = classify("postgres", "postgres -D /x", 0, 501, false, &[]);
        assert_eq!((other_user.kind, other_user.stoppable), ("process", false));
        let native = classify("python3", "/usr/libexec/python3 x", 501, 501, false, &[]);
        assert_eq!((native.kind, native.stoppable), ("system", false));
        let itself = classify("node", "node", 501, 501, true, &[]);
        assert!(!itself.stoppable);
        let tool = classify(
            "idea",
            "/Applications/IntelliJ IDEA.app/x",
            501,
            501,
            false,
            &[],
        );
        assert_eq!((tool.kind, tool.stoppable), ("tool", false));
        let extra = classify(
            "mysqld",
            "/opt/homebrew/bin/mysqld",
            501,
            501,
            false,
            &["mysqld".into()],
        );
        assert!(extra.stoppable);
    }
}
