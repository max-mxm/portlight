# Validation locale — 27 septembre 2026

- Application macOS Apple Silicon compilée en release et ouverte sans serveur Vite.
- Inventaire réel : deux serveurs Storefront, cinq conteneurs Docker, neuf ports de développement distincts après le test.
- Identification des conteneurs Mailpit, PostgreSQL, PowerSync et MinIO ; plage 9000–9001 et IPv6 reconnus.
- Aucun avertissement Docker après correction du format de métadonnées.
- Test depuis l’interface : ⌘K, recherche du port éphémère 50199, Entrée, confirmation du processus de test PID 79829, arrêt normal et contrôle lsof du port libéré.
- Historique de l’action contrôlé visuellement. Les services préexistants ont été préservés.
- Recherche ⌘F du port 3000, accès aux détails au clavier, thèmes clair/sombre et focus de la palette contrôlés dans l’application Mac.
- TypeScript strict et build Vite réussis.
- Quatre tests Vitest et six tests Rust réussis. Le test Rust crée son propre serveur et vérifie une identité périmée, SIGTERM résistant et SIGKILL.
- Clippy sur toutes les cibles de test avec `-D warnings` : aucune erreur.
- Formatage Prettier et rustfmt vérifié. Audit npm : aucune vulnérabilité détectée lors de l’installation finale des dépendances.

L’interface et le moteur sont fonctionnels. Cette version ne constitue pas une distribution Developer ID signée et notarisée ; les parcours d’installation sur d’autres Mac n’ont pas été validés.
