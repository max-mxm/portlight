# Contribuer à Portlight

Portlight est une application macOS locale, en anglais par défaut et disponible en français, construite avec Tauri 2, Rust, React et TypeScript. Voir le [README](README.md) pour l’installation.

## Développement

- Lire [AGENTS.md](AGENTS.md) et [les décisions de design](docs/design-decisions.md).
- Tout texte visible passe par `src/i18n/messages.ts` (anglais, puis français) ou par `l()` / `tr!` dans `src-tauri/src/i18n.rs`. Aucun texte en dur dans les composants.
- Conserver la séparation entre inventaire, métadonnées Docker, actions, IPC et interface.
- Préserver le fonctionnement sans serveur en production et l’exécution système sans shell.
- Revalider l’identité des processus avant tout signal ; préserver les protections système.
- Vérifier les arrêts uniquement avec des serveurs créés pour le test. Ne jamais arrêter un service de travail pour tester une modification.
- Garder l’interface carrée, lisible et utilisable au clavier ; vérifier les deux thèmes.

## Avant une pull request

```sh
npm run build
npm test
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Décrire le problème, le comportement obtenu et les vérifications effectuées. Ajouter une capture lorsqu’une modification change l’interface. Pour signaler un problème, préciser macOS, architecture, version, étapes et comportement attendu ; retirer les secrets et commandes sensibles des logs.
