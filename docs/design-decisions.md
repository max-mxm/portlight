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
- Barre de titre macOS intégrée (`Overlay`, sans titre) : les boutons de fenêtre se posent sur la barre latérale bleu nuit et la barre supérieure sert à déplacer la fenêtre. L’apparence native et le fond de la fenêtre suivent le thème choisi dans Portlight, pas seulement celui de macOS.
- La barre latérale défile quand la fenêtre est trop basse : la liste des projets n’est jamais écrasée, et la bande des boutons de fenêtre reste en haut.
- Chaque groupe de projet se replie et se déplie ; un bouton de la barre d’outils replie ou déplie tous les groupes. L’état est mémorisé localement ; une recherche affiche toujours ses résultats.
- « Arrêter le groupe » (tri par projet uniquement) arrête les services arrêtables affichés dans le groupe : chaque processus avec son lanceur, les conteneurs en un seul `docker stop` avec le reste de leur projet Compose. La confirmation liste les processus et conteneurs visés et la commande équivalente. Si des processus résistent, le bouton devient « Forcer l’arrêt », qui ne vise que les processus : les conteneurs ne sont jamais forcés.
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

## Langues

- Anglais par défaut, français disponible. Le choix est enregistré dans les réglages du backend : il s’applique aussi à la barre des menus, aux raisons de protection et aux messages d’arrêt.
- Sélecteur `EN | FR` en police mono dans la barre latérale, sur la même rangée que le thème (icônes seules, nom en infobulle et pour les lecteurs d’écran), pour laisser la place à la liste des projets à 820 px de hauteur. Le choix est aussi proposé dans les réglages.
- Les nombres, heures et dates suivent la langue (`12.3%` / `12,3 %`, `MB` / `Mo`, `d` / `j`).
