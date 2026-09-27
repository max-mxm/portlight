# Portlight — brutaliste chromatique

La direction actuelle répond à la demande explicite : brutaliste, palette Monday, fontes plus grandes et technologiques, aucun angle arrondi. Le skill `ui-ux-pro-max:ui-styling` a été appliqué pour la composition, les tokens de thème, la typographie et l’accessibilité. Le CSS existant est retravaillé directement : pas de migration de bibliothèque de composants nécessaire pour ce changement visuel.

## Composition

La barre latérale bleu nuit ancre la navigation. Le contenu fonctionne comme une grille éditoriale : titre massif, bandeau de quatre compteurs colorés contigus, table de services structurée par projet. Les contours de 1–3 px et les ombres décalées sans flou matérialisent la hiérarchie. Toutes les boîtes, badges, boutons, indicateurs et dialogues sont carrés (`border-radius: 0`).

Les couleurs sont choisies à partir de la [palette officielle des produits Monday](https://www.brand-monday.com/products) : violet `#6161FF`, vert `#00CA72`, jaune `#FFCC00`, rose `#FB275D`, avec bleu nuit et surfaces neutres. Le violet marque Docker et la navigation active ; le vert les processus ; le jaune le rafraîchissement et les avertissements ; le rose les points à vérifier et les actions d’arrêt. Les couleurs sont toujours accompagnées de mots ou d’icônes.

## Typographie

Space Grotesk Variable pour l’interface ; JetBrains Mono Variable pour les données techniques et les commandes. Les deux fontes sont embarquées via Fontsource, sans requête réseau au lancement. Corps principal 15–16 px ; noms de services 15–16 px ; métadonnées 12–13 px ; titres de section 19–22 px ; titre principal 30–40 px ; compteurs 46–68 px. Les noms longs et les chemins se replient ; les colonnes secondaires sont retirées de la liste sur les petites fenêtres mais restent disponibles dans les détails.

## Interaction et accessibilité

- Navigation, recherche, actions rapides et protections du moteur Rust conservées.
- Contraste AA pour les paires de texte sur les couleurs saturées : blanc/violet environ 4,50:1, encre/rose supérieur à 4,5:1, encre/vert et encre/jaune supérieurs à 7:1.
- Mode sombre avec les mêmes couleurs vives et des textes secondaires éclaircis. Le thème suit macOS par défaut ; un sélecteur carré à trois positions (Système, Clair, Sombre) reste dans la barre latérale.
- Contour de focus visible ; dialogues avec confinement du focus et retour à l’élément d’origine.
- Pas de flou décoratif, pas de mouvement de mise en page au survol ; mouvement réduit respecté.
- Actualisation toutes les 10 secondes, suspendue si la fenêtre est masquée ou pendant un arrêt. Heure du relevé et état ancien conservés.

## Portées d’arrêt et barre des menus

- L’arrêt par défaut vise toujours le seul processus ou conteneur en écoute. Les portées plus larges (lanceur et descendants, projet Compose) sont proposées dans les détails, dans un encadré à liseré jaune, avec un bouton secondaire : elles ne concurrencent pas l’action principale.
- Toute confirmation liste exactement les processus (PID, nom, ports) ou conteneurs concernés, avec la commande équivalente.
- Les ports non web (PostgreSQL, SMTP, ADB…) s’affichent en pointillés et ne sont pas cliquables.
- CPU et mémoire apparaissent sous la durée d’activité, en petit et en couleur discrète, pour aider à trier « À vérifier » sans alourdir la table.
- La barre des menus utilise une icône modèle monochrome (carré brutaliste et port central) et le nombre de ports occupés. Ses actions d’arrêt ouvrent la fenêtre et passent par la même confirmation.
- Les réglages tiennent dans un seul panneau, champs à contour de 2 px, bouton principal violet. Les protections (moteur Docker, services macOS) sont rappelées à côté des champs qui pourraient les concerner.
