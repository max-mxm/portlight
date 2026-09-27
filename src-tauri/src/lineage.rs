use crate::{model::ProcessSummary, process::ProcessEntry};
use std::collections::{BTreeMap, HashMap, HashSet};

/// Tools that start and often restart a development server.
const RUNNERS: &[&str] = &[
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "bun",
    "bunx",
    "deno",
    "turbo",
    "nx",
    "concurrently",
    "dotenv",
    "dotenvx",
    "cross-env",
    "env-cmd",
    "nodemon",
    "tsx",
    "ts-node",
    "vite",
    "next",
    "nuxt",
    "astro",
    "cargo",
    "cargo-watch",
    "watchexec",
    "air",
    "go",
    "make",
    "foreman",
    "overmind",
    "honcho",
    "uv",
    "uvx",
    "poetry",
    "pipenv",
    "bundle",
    "rails",
    "mix",
    "manage.py",
    "npm-cli",
    "npx-cli",
    "pnpm.cjs",
];
/// Interpreters count as launchers only when the script they run is a runner.
const INTERPRETERS: &[&str] = &["node", "python", "ruby"];
const SHELLS: &[&str] = &["sh", "bash", "zsh", "fish", "dash", "ksh", "tcsh", "csh"];
const MAX_GROUP: usize = 32;
const MAX_PARENTS: usize = 6;

fn basename(token: &str) -> String {
    let name = token.rsplit('/').next().unwrap_or(token);
    name.trim_start_matches('-').to_ascii_lowercase()
}

pub fn program(command: &str) -> String {
    // ps does not quote paths: "…/Application Support/…/claude.app/Contents/MacOS/claude".
    if let Some((_, binary)) = command.split_once(".app/Contents/MacOS/") {
        return binary
            .split_whitespace()
            .next()
            .map(basename)
            .unwrap_or_default();
    }
    command
        .split_whitespace()
        .next()
        .map(basename)
        .unwrap_or_default()
}

/// "node pnpm" rather than "node" for scripts run by an interpreter.
fn display_name(command: &str) -> String {
    let first = program(command);
    if !INTERPRETERS.iter().any(|i| first.starts_with(i)) {
        return first;
    }
    match command
        .split_whitespace()
        .skip(1)
        .find(|t| !t.starts_with('-'))
    {
        Some(script) => format!("{first} {}", basename(script)),
        None => first,
    }
}

fn script_name(token: &str) -> String {
    let name = basename(token);
    for ext in [".js", ".mjs"] {
        if let Some(stem) = name.strip_suffix(ext) {
            return stem.to_owned();
        }
    }
    name
}

pub fn is_runner(command: &str) -> bool {
    let mut tokens = command.split_whitespace();
    let Some(first) = tokens.next().map(basename) else {
        return false;
    };
    if RUNNERS.contains(&first.as_str()) {
        return true;
    }
    if !INTERPRETERS.iter().any(|i| first.starts_with(i)) {
        return false;
    }
    tokens
        .find(|t| !t.starts_with('-'))
        .map(script_name)
        .is_some_and(|script| RUNNERS.contains(&script.as_str()))
}

pub fn is_shell(command: &str) -> bool {
    SHELLS.contains(&program(command).as_str())
}

fn native(command: &str) -> bool {
    ["/System/", "/usr/libexec/", "/usr/sbin/", "/sbin/"]
        .iter()
        .any(|prefix| command.starts_with(prefix))
}

fn summary(entry: &ProcessEntry, ports: &BTreeMap<u32, Vec<u16>>) -> ProcessSummary {
    ProcessSummary {
        pid: entry.pid,
        name: display_name(&entry.command),
        command: entry.command.clone(),
        ports: ports.get(&entry.pid).cloned().unwrap_or_default(),
        identity: entry.identity.clone(),
    }
}

fn ancestors(table: &HashMap<u32, ProcessEntry>, pid: u32) -> Vec<&ProcessEntry> {
    let mut chain = Vec::new();
    let mut seen = HashSet::from([pid]);
    let mut current = table.get(&pid).map(|p| p.ppid);
    while let Some(ppid) = current {
        if ppid <= 1 || !seen.insert(ppid) {
            break;
        }
        let Some(parent) = table.get(&ppid) else {
            break;
        };
        chain.push(parent);
        current = Some(parent.ppid);
    }
    chain
}

pub fn parents(
    table: &HashMap<u32, ProcessEntry>,
    pid: u32,
    ports: &BTreeMap<u32, Vec<u16>>,
) -> Vec<ProcessSummary> {
    ancestors(table, pid)
        .into_iter()
        .take(MAX_PARENTS)
        .map(|p| summary(p, ports))
        .collect()
}

/// The launcher of `pid` and all its descendants, when every member can safely
/// receive a signal: owned by `uid`, not a macOS binary, not Portlight or one
/// of its ancestors, and a launcher started from a shell or reparented to
/// launchd (never an IDE, an agent or a terminal application).
pub fn launch_group(
    table: &HashMap<u32, ProcessEntry>,
    pid: u32,
    uid: u32,
    own_pid: u32,
    ports: &BTreeMap<u32, Vec<u16>>,
) -> Vec<ProcessSummary> {
    let mut root = None;
    for parent in ancestors(table, pid) {
        if !is_runner(&parent.command) {
            break;
        }
        root = Some(parent);
    }
    let Some(root) = root else {
        return vec![];
    };
    let launched_from_shell = root.ppid == 1
        || table
            .get(&root.ppid)
            .is_some_and(|parent| is_shell(&parent.command));
    if !launched_from_shell {
        return vec![];
    }
    let mut children: HashMap<u32, Vec<&ProcessEntry>> = HashMap::new();
    for entry in table.values() {
        children.entry(entry.ppid).or_default().push(entry);
    }
    let mut members = vec![root];
    let mut index = 0;
    while index < members.len() {
        let mut next = children
            .get(&members[index].pid)
            .cloned()
            .unwrap_or_default();
        next.sort_by_key(|p| p.pid);
        members.extend(next);
        if members.len() > MAX_GROUP {
            return vec![];
        }
        index += 1;
    }
    let protected: HashSet<u32> = std::iter::once(own_pid)
        .chain(ancestors(table, own_pid).into_iter().map(|p| p.pid))
        .collect();
    if members
        .iter()
        .any(|m| m.uid != uid || native(&m.command) || protected.contains(&m.pid))
    {
        return vec![];
    }
    members.into_iter().map(|m| summary(m, ports)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(pid: u32, ppid: u32, command: &str) -> ProcessEntry {
        ProcessEntry {
            pid,
            ppid,
            uid: 501,
            cpu: 0.0,
            rss_kb: 0,
            identity: format!("start-{pid}"),
            elapsed: 60,
            command: command.into(),
        }
    }
    fn table(items: Vec<ProcessEntry>) -> HashMap<u32, ProcessEntry> {
        items.into_iter().map(|p| (p.pid, p)).collect()
    }
    fn pids(group: &[ProcessSummary]) -> Vec<u32> {
        group.iter().map(|p| p.pid).collect()
    }

    #[test]
    fn recognizes_launchers() {
        assert!(is_runner("npm run dev"));
        assert!(is_runner("/opt/homebrew/bin/pnpm dev"));
        assert!(is_runner("node /x/node_modules/.bin/nodemon server.js"));
        assert!(is_runner(
            "node --inspect /x/node_modules/npm/bin/npm-cli.js run dev"
        ));
        assert!(is_runner("python3.12 manage.py runserver"));
        assert!(!is_runner(
            "node /usr/local/lib/node_modules/@google/gemini-cli/dist/index.js"
        ));
        assert!(!is_runner("/Applications/Cursor.app/Contents/MacOS/Cursor"));
        assert!(is_shell("-zsh"));
        assert_eq!(
            program("/Users/a/Library/Application Support/Claude/claude.app/Contents/MacOS/claude --verbose"),
            "claude"
        );
        assert!(is_shell("/bin/sh -c npm run dev"));
    }

    #[test]
    fn group_from_terminal() {
        let t = table(vec![
            entry(
                10,
                1,
                "/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal",
            ),
            entry(20, 10, "-zsh"),
            entry(30, 20, "npm run dev"),
            entry(40, 30, "sh -c next dev"),
            entry(50, 40, "node /x/.bin/next dev"),
            entry(60, 50, "next-server (v15)"),
            entry(70, 20, "vim notes.md"),
        ]);
        let ports = BTreeMap::from([(60, vec![3000])]);
        let group = launch_group(&t, 60, 501, 999, &ports);
        // `sh -c` is a shell: the walk stops there, npm stays outside.
        assert_eq!(pids(&group), vec![50, 60]);
        assert_eq!(group[1].ports, vec![3000]);
        let parents = parents(&t, 60, &ports);
        assert_eq!(pids(&parents), vec![50, 40, 30, 20, 10]);
    }

    #[test]
    fn group_includes_siblings_of_a_supervisor() {
        let t = table(vec![
            entry(20, 1, "-zsh"),
            entry(30, 20, "turbo run dev"),
            entry(31, 30, "node web.js"),
            entry(32, 30, "node api.js"),
        ]);
        let group = launch_group(&t, 31, 501, 999, &BTreeMap::new());
        assert_eq!(pids(&group), vec![30, 31, 32]);
        // Reparented to launchd after the terminal closed.
        let t = table(vec![
            entry(30, 1, "npm start"),
            entry(31, 30, "node index.js"),
        ]);
        assert_eq!(
            pids(&launch_group(&t, 31, 501, 999, &BTreeMap::new())),
            vec![30, 31]
        );
    }

    #[test]
    fn group_through_env_wrappers() {
        // Chain observed with a pnpm monorepo started from an agent shell.
        let t = table(vec![
            entry(
                8210,
                1,
                "/Applications/Claude.app/Contents/MacOS/claude --verbose",
            ),
            entry(
                86030,
                8210,
                "/bin/zsh -c source snapshot.sh && pnpm dev:web",
            ),
            entry(
                86032,
                86030,
                "node /opt/local/bin/pnpm with-env pnpm --filter web start",
            ),
            entry(
                86038,
                86032,
                "/Users/a/Library/pnpm/.tools/pnpm/12.4.1/bin/pnpm with-env",
            ),
            entry(
                86039,
                86038,
                "node /x/node_modules/.bin/dotenv -c -- pnpm --filter web start",
            ),
            entry(86042, 86039, "pnpm --filter web start -p 3000"),
            entry(86043, 86042, "next-server (v16.3.4)"),
        ]);
        let group = launch_group(&t, 86043, 501, 999, &BTreeMap::new());
        assert_eq!(pids(&group), vec![86032, 86038, 86039, 86042, 86043]);
        assert_eq!(group[0].name, "node pnpm");
        assert_eq!(group[1].name, "pnpm");
    }

    #[test]
    fn refuses_unsafe_groups() {
        let ide = table(vec![
            entry(10, 1, "/Applications/Cursor.app/Contents/MacOS/Cursor"),
            entry(30, 10, "npm run dev"),
            entry(31, 30, "node index.js"),
        ]);
        assert!(launch_group(&ide, 31, 501, 999, &BTreeMap::new()).is_empty());
        let direct = table(vec![entry(20, 1, "-zsh"), entry(31, 20, "node index.js")]);
        assert!(launch_group(&direct, 31, 501, 999, &BTreeMap::new()).is_empty());
        let mut foreign = entry(32, 30, "node worker.js");
        foreign.uid = 0;
        let t = table(vec![
            entry(20, 1, "-zsh"),
            entry(30, 20, "npm run dev"),
            entry(31, 30, "node index.js"),
            foreign,
        ]);
        assert!(launch_group(&t, 31, 501, 999, &BTreeMap::new()).is_empty());
        let own = table(vec![
            entry(20, 1, "-zsh"),
            entry(30, 20, "npm run app:dev"),
            entry(31, 30, "node vite.js"),
            entry(32, 30, "portlight"),
        ]);
        assert!(launch_group(&own, 31, 501, 32, &BTreeMap::new()).is_empty());
    }
}
