//! Language of the texts produced by the backend (errors, stop results,
//! protection reasons, menu bar). English by default, French available.
use std::sync::atomic::{AtomicBool, Ordering};

static FRENCH: AtomicBool = AtomicBool::new(false);

pub const LANGUAGES: &[&str] = &["en", "fr"];

pub fn set(language: &str) {
    FRENCH.store(language == "fr", Ordering::Relaxed);
}

pub fn french() -> bool {
    FRENCH.load(Ordering::Relaxed)
}

pub fn pick<T>(french: bool, en: T, fr: T) -> T {
    if french {
        fr
    } else {
        en
    }
}

/// Static text in the current language.
pub fn l(en: &'static str, fr: &'static str) -> &'static str {
    pick(french(), en, fr)
}

/// Formatted text in the current language: `tr!("Stop refused: {error}", "Arrêt refusé : {error}")`.
#[macro_export]
macro_rules! tr {
    ($en:literal, $fr:literal) => {
        if $crate::i18n::french() {
            format!($fr)
        } else {
            format!($en)
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn picks_the_language() {
        assert_eq!(pick(false, "Stop", "Arrêter"), "Stop");
        assert_eq!(pick(true, "Stop", "Arrêter"), "Arrêter");
        let port = 3000;
        // English unless the settings select French.
        assert_eq!(tr!("Port {port}", "Le port {port}"), "Port 3000");
        assert!(LANGUAGES.contains(&"en"));
    }
}
