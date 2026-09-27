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

## Refonte brutaliste

Version reconstruite avec les fontes locales Space Grotesk et JetBrains Mono. Contrôle visuel effectué dans l’application Mac sur la vue d’ensemble, la liste complète des services avec noms de conteneurs longs, le mode sombre et la palette ⌘K. Tous les composants de l’interface web utilisent un rayon de bordure nul. Build TypeScript/Vite et quatre tests Vitest réussis. Aucun arrêt de service n’a été effectué pour cette vérification de style.

## Fiabilité des arrêts, tests et fonctionnalités

- Table des processus lue en un seul appel `ps` ; relevé réel en environ 1,4 s en debug avec 15 services.
- Lignée vérifiée sur un vrai monorepo pnpm : `next-server` ← `pnpm` ← `node dotenv` ← `pnpm` ← `node pnpm` ← `zsh`. Groupe de 5 processus proposé ; le shell et l’agent parent restent exclus.
- Projets Compose détectés sur la machine (`acme` : 3 conteneurs, `storefront_sync` : 2).
- 19 tests Rust, dont un test d’intégration qui crée son propre shell, un lanceur `nodemon.js` et un serveur Node, puis arrête le groupe et vérifie la libération du port. Aucun service préexistant arrêté.
- 17 tests Vitest, dont des tests de composants (confirmation par portée, palette `:port`, ports non web, arrêt forcé par portée, ouverture dans l’éditeur, Compose).
- Interface contrôlée dans le navigateur intégré avec un IPC simulé à partir d’un relevé réel : détails, confirmation de groupe, bascule vers l’arrêt forcé, palette, réglages (délai appliqué aux compteurs et aux titres), thèmes clair et sombre.
- Application lancée avec `npm run app:dev` sans erreur. L’icône de la barre des menus, le masquage à la fermeture et le lancement à la connexion n’ont pas pu être contrôlés visuellement dans cette session (pas d’accès à l’écran).
- Démon Gradle (`org.gradle.launcher.daemon.bootstrap.GradleDaemon`) reconnu sur la machine : outil protégé, projet « Gradle » au lieu de « 9.3.1 », arrêt conseillé avec `./gradlew --stop`. Mêmes règles pour les démons Kotlin et Metals. Une application Java lancée avec des jars Gradle dans son classpath reste arrêtable.
- Relevé regroupé : un seul `lsof` pour les dossiers de travail et un seul `docker inspect` pour tous les conteneurs. Six commandes système par relevé au lieu de 22 sur la machine de test ; médiane de 5 relevés en release : 0,31 s au lieu de 0,69 s.
- Conteneurs décrits d’après leur image (`postgres:18`, `axllent/mailpit`, `minio/minio`, `journeyapps/powersync-service`) et non plus d’après leur nom.
- Vite détecté d’après le programme lancé ou un script de `node_modules`, plus d’après une sous-chaîne de la commande. CLI Docker recherchée aussi dans `~/.docker/bin`, `~/.orbstack/bin`, `~/.rd/bin` et OrbStack.app ; processus d’OrbStack, Lima/Colima et Rancher Desktop protégés comme le moteur Docker.
- Nom de projet tiré du dépôt git le plus proche (dans le dossier personnel ou sur un volume externe) ; un worktree, même avec un `gitdir` relatif, porte le nom de son dépôt principal ; un dossier racine configuré reste prioritaire.
- Serveur Rust de test lancé avec `cargo run` dans un dépôt temporaire : reconnu comme serveur de développement arrêtable, projet `demo-server`, puis arrêté et supprimé. Liste intégrée élargie (bases de données, .NET, Elixir, PHP-FPM…), comparée au nom exact ou suivi d’une version (`python3.12`, `redis-server`) : `Airtable` n’est plus un serveur `air`.
- Arrêt revalidé sur la seule cible : table des processus ou `docker inspect` du conteneur avant, puis `lsof` et `netstat` pour les ports libérés, au lieu de deux relevés complets. Les processus zombies ne comptent plus comme en vie. Une identité périmée (même PID, autre heure de démarrage) ne reçoit aucun signal.

## Internationalisation

- Interface, barre des menus et messages du backend en anglais par défaut, en français sur choix. Dictionnaire français vérifié par TypeScript contre le dictionnaire anglais.
- Tests : rendu en français d’une ligne de service, formats de durée, mémoire et CPU dans les deux langues, langue par défaut des réglages et refus d’une langue inconnue côté Rust.
- Capture du README refaite en anglais : interface rendue par Chrome headless à 1220 × 820 (×2) avec un relevé réel de la machine injecté par un IPC simulé. Ce n’est pas une capture de la fenêtre native (pas d’accès à l’enregistrement d’écran dans la session).
