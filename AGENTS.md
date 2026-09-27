# Portlight

Application macOS locale Tauri 2 / Rust / React / TypeScript. UI en anglais par défaut, français disponible : textes dans `src/i18n/messages.ts` et `src-tauri/src/i18n.rs`, jamais en dur. Priorité à la clarté, la réactivité et la précision des actions.

- Lire docs/design-decisions.md pour les décisions d’interface.
- Ne pas ajouter de serveur HTTP en production ni de service cloud.
- Exécuter les commandes système avec des arguments structurés, sans shell.
- Le frontend fournit une identité d’inventaire ; le backend résout et revalide la cible.
- Ne jamais arrêter com.docker.backend pour libérer un port de conteneur.
- Arrêt normal avant forcé, processus système protégés. Tester les actions avec des processus créés par le test uniquement.
- Conserver une séparation entre collecte, Docker, actions, IPC et UI. Pas de réécriture d’architecture sans besoin concret.
- npm run build, npm test et cargo test après une modification fonctionnelle pertinente.
