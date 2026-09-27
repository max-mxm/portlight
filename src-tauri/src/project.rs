use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn expand(root: &str) -> String {
    match (root.strip_prefix("~/"), std::env::var("HOME")) {
        (Some(rest), Ok(home)) => format!("{}/{rest}", home.trim_end_matches('/')),
        _ => root.to_owned(),
    }
}

/// Project name from a directory: first folder below a configured root,
/// then the git repository containing it (a worktree is named after its
/// main repository), then the first folder below any `GitHub` folder.
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
        .or_else(|| repository(dir))
        .or_else(|| dir.split_once("/GitHub/").and_then(|(_, rest)| first(rest)))
}

fn folder_name(path: &Path) -> Option<String> {
    path.file_name().map(|n| n.to_string_lossy().into_owned())
}

/// Name of the repository containing `dir`.
pub fn repository(dir: &str) -> Option<String> {
    let root = root(dir)?;
    let git = root.join(".git");
    if git.is_file() {
        // Worktree: "gitdir: /path/main/.git/worktrees/<name>", possibly relative.
        let text = fs::read_to_string(&git).ok()?;
        let gitdir = text.lines().find_map(|l| l.strip_prefix("gitdir:"))?.trim();
        let resolved = fs::canonicalize(root.join(gitdir)).unwrap_or_else(|_| gitdir.into());
        if let Some((main, _)) = resolved.to_string_lossy().split_once("/.git/worktrees/") {
            return folder_name(Path::new(main));
        }
    }
    folder_name(&root)
}

/// Closest folder containing `.git`, inside the home folder (never the home
/// folder itself, often a dotfiles repository) or on an external volume.
pub fn root(dir: &str) -> Option<PathBuf> {
    let home = std::env::var("HOME").ok().map(PathBuf::from);
    Path::new(dir)
        .ancestors()
        .take_while(|p| {
            let in_home = home
                .as_deref()
                .is_some_and(|h| p.starts_with(h) && p.as_os_str() != h.as_os_str());
            // "/Volumes/<disk>/<folder>" and below, not the disk itself.
            let on_volume = p.starts_with("/Volumes") && p.components().count() > 3;
            in_home || on_volume
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
    /// Temporary repositories below the crate, inside the home folder.
    struct Sandbox(PathBuf);
    impl Drop for Sandbox {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn repositories_and_worktrees() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("project-tests-{}", std::process::id()));
        let sandbox = Sandbox(base.clone());
        let web = base.join("storefront/apps/web");
        fs::create_dir_all(&web).unwrap();
        fs::create_dir_all(base.join("storefront/.git/worktrees/demo")).unwrap();
        let demo = base.join("trees/demo");
        fs::create_dir_all(demo.join("src")).unwrap();
        fs::write(
            demo.join(".git"),
            format!(
                "gitdir: {}\n",
                base.join("storefront/.git/worktrees/demo").display()
            ),
        )
        .unwrap();
        let relative = base.join("trees/relative");
        fs::create_dir_all(&relative).unwrap();
        fs::write(
            relative.join(".git"),
            "gitdir: ../../storefront/.git/worktrees/demo\n",
        )
        .unwrap();
        let submodule = base.join("storefront/vendor/lib");
        fs::create_dir_all(&submodule).unwrap();
        fs::write(submodule.join(".git"), "gitdir: ../../.git/modules/lib\n").unwrap();

        let path = |p: &Path| p.to_string_lossy().into_owned();
        assert_eq!(repository(&path(&web)).as_deref(), Some("storefront"));
        assert_eq!(
            repository(&path(&demo.join("src"))).as_deref(),
            Some("storefront")
        );
        assert_eq!(repository(&path(&relative)).as_deref(), Some("storefront"));
        assert_eq!(repository(&path(&submodule)).as_deref(), Some("lib"));
        // A configured root still wins over git.
        let roots = vec![path(&base.join("storefront/apps"))];
        assert_eq!(name(&path(&web), &roots).as_deref(), Some("web"));
        assert_eq!(root(&path(&demo.join("src"))), Some(demo.clone()));
        drop(sandbox);
    }

    #[test]
    fn git_root_of_the_repository() {
        let manifest = env!("CARGO_MANIFEST_DIR");
        let root = root(&format!("{manifest}/src")).expect("dépôt git");
        assert!(root.join(".git").exists());
        assert!(Path::new(manifest).starts_with(&root));
    }
}
