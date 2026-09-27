use std::path::{Path, PathBuf};

pub fn expand(root: &str) -> String {
    match (root.strip_prefix("~/"), std::env::var("HOME")) {
        (Some(rest), Ok(home)) => format!("{}/{rest}", home.trim_end_matches('/')),
        _ => root.to_owned(),
    }
}

/// Project name from a directory: first folder below a configured root,
/// otherwise below any `GitHub` folder (worktrees included).
pub fn name(dir: &str, roots: &[String]) -> Option<String> {
    let first = |relative: &str| {
        relative
            .split('/')
            .find(|part| !part.is_empty())
            .map(str::to_owned)
    };
    roots
        .iter()
        .map(|root| expand(root))
        .filter(|root| !root.is_empty())
        .find_map(|root| {
            dir.strip_prefix(root.trim_end_matches('/'))
                .filter(|rest| rest.starts_with('/'))
                .and_then(first)
        })
        .or_else(|| dir.split_once("/GitHub/").and_then(|(_, rest)| first(rest)))
}

/// Closest folder containing `.git`, without leaving the home folder.
pub fn root(dir: &str) -> Option<PathBuf> {
    let home = std::env::var("HOME").ok().map(PathBuf::from);
    Path::new(dir)
        .ancestors()
        .take_while(|p| {
            home.as_deref()
                .is_none_or(|h| p.starts_with(h) && p.as_os_str() != h.as_os_str())
        })
        .find(|p| p.join(".git").exists())
        .map(Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn configured_roots_before_github() {
        let roots = vec!["/Users/a/code".to_string(), "/Users/a/GitHub".into()];
        assert_eq!(
            name("/Users/a/code/api/src", &roots).as_deref(),
            Some("api")
        );
        assert_eq!(name("/Users/a/codex/api", &roots), None);
        assert_eq!(
            name("/Volumes/ssd/GitHub/portfolio/.claude/worktrees/demo", &[]).as_deref(),
            Some("portfolio")
        );
        assert_eq!(name("/Users/a/code", &roots), None);
    }
    #[test]
    fn git_root_of_the_repository() {
        let manifest = env!("CARGO_MANIFEST_DIR");
        let root = root(&format!("{manifest}/src")).expect("dépôt git");
        assert!(root.join(".git").exists());
        assert!(Path::new(manifest).starts_with(&root));
    }
}
