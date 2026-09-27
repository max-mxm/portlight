use crate::i18n::{self, l};
use crate::tr;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// A development process is listed in "To review" after this delay.
    pub review_hours: u32,
    /// Folders whose direct children are projects, e.g. `~/code`.
    pub project_roots: Vec<String>,
    /// Extra program names treated as development servers.
    pub dev_binaries: Vec<String>,
    /// Application used by "Open in editor".
    pub editor: Option<String>,
    /// Interface language: "en" (default) or "fr".
    pub language: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            review_hours: 8,
            project_roots: vec![],
            dev_binaries: vec![],
            editor: None,
            language: "en".into(),
        }
    }
}

fn path() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| {
        PathBuf::from(home).join("Library/Application Support/dev.portlight.desktop/settings.json")
    })
}

/// Reads the settings and applies their language to backend texts.
pub fn load() -> Settings {
    let settings = path()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|text| serde_json::from_str::<Settings>(&text).ok())
        .and_then(|s| validate(s).ok())
        .unwrap_or_default();
    i18n::set(&settings.language);
    settings
}

pub fn validate(settings: Settings) -> Result<Settings, String> {
    if !(1..=168).contains(&settings.review_hours) {
        return Err(l(
            "The review delay must be between 1 and 168 hours.",
            "Le délai de vérification doit être compris entre 1 et 168 heures.",
        )
        .into());
    }
    let mut roots = Vec::new();
    for root in settings.project_roots {
        let root = root.trim().trim_end_matches('/').to_owned();
        if root.is_empty() {
            continue;
        }
        if !(root.starts_with('/') || root.starts_with("~/")) || root.contains("..") {
            return Err(tr!(
                "Invalid folder: “{root}”. Use an absolute path or ~/…",
                "Dossier invalide : « {root} ». Utilisez un chemin absolu ou ~/…"
            ));
        }
        if !roots.contains(&root) {
            roots.push(root);
        }
    }
    let mut binaries = Vec::new();
    for name in settings.dev_binaries {
        let name = name.trim().to_ascii_lowercase();
        if name.is_empty() {
            continue;
        }
        if !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
        {
            return Err(tr!(
                "Invalid program name: “{name}”.",
                "Nom de programme invalide : « {name} »."
            ));
        }
        // The Docker engine and the macOS supervisor are never stoppable.
        if name.starts_with("com.docker") || name.starts_with("docker") || name == "launchd" {
            return Err(tr!(
                "“{name}” stays protected.",
                "« {name} » reste protégé."
            ));
        }
        if !binaries.contains(&name) {
            binaries.push(name);
        }
    }
    if roots.len() > 20 || binaries.len() > 40 {
        return Err(l(
            "Too many entries in the settings.",
            "Trop d’entrées dans les réglages.",
        )
        .into());
    }
    if let Some(editor) = &settings.editor {
        if !crate::actions::EDITORS
            .iter()
            .any(|(name, _)| name == editor)
        {
            return Err(l("Unknown editor.", "Éditeur inconnu.").into());
        }
    }
    if !i18n::LANGUAGES.contains(&settings.language.as_str()) {
        return Err(l("Unknown language.", "Langue inconnue.").into());
    }
    Ok(Settings {
        review_hours: settings.review_hours,
        project_roots: roots,
        dev_binaries: binaries,
        editor: settings.editor,
        language: settings.language,
    })
}

pub fn save(settings: Settings) -> Result<Settings, String> {
    let settings = validate(settings)?;
    let path = path().ok_or(l("Home folder not found", "Dossier personnel introuvable"))?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, text).map_err(|e| e.to_string())?;
    fs::rename(&temporary, &path).map_err(|e| e.to_string())?;
    i18n::set(&settings.language);
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalizes_and_protects() {
        let settings = validate(Settings {
            review_hours: 4,
            project_roots: vec![" ~/code/ ".into(), "".into(), "~/code".into()],
            dev_binaries: vec!["Rails ".into(), "mysqld".into()],
            editor: None,
            language: "fr".into(),
        })
        .unwrap();
        assert_eq!(settings.project_roots, vec!["~/code"]);
        assert_eq!(settings.dev_binaries, vec!["rails", "mysqld"]);
        for bad in ["com.docker.backend", "launchd", "node;rm"] {
            assert!(validate(Settings {
                dev_binaries: vec![bad.into()],
                ..Settings::default()
            })
            .is_err());
        }
        assert!(validate(Settings {
            language: "de".into(),
            ..Settings::default()
        })
        .is_err());
        assert!(validate(Settings {
            review_hours: 0,
            ..Settings::default()
        })
        .is_err());
        assert!(validate(Settings {
            project_roots: vec!["relative/path".into()],
            ..Settings::default()
        })
        .is_err());
    }
    #[test]
    fn missing_fields_use_defaults() {
        let settings: Settings = serde_json::from_str(r#"{"reviewHours":12}"#).unwrap();
        assert_eq!(settings.review_hours, 12);
        assert_eq!(settings.language, "en", "English by default");
        assert!(settings.project_roots.is_empty());
    }
}
