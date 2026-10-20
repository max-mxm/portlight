# Portlight — grille des programmes

La direction actuelle vient d’une refonte menée avec le skill Impeccable (`PRODUCT.md`, contrat de direction dans `.impeccable/surfaces/src-app-tsx.md`). Elle a été tirée parmi sept candidats ancrés dans l’univers des développeurs : une **grille des programmes télé**. Chaque service est une chaîne : son port est l’indicatif, sa durée de vie une émission qui court jusqu’à la ligne « maintenant ». Elle refuse le modèle habituel des tableaux de bord (tuiles de compteurs au-dessus d’une table). Restent imposés : les angles carrés partout, la palette Monday, l’usage d’abord en sombre (à côté d’un terminal et d’un éditeur sombres). Une **vue simplifiée** au même vocabulaire s’active par une case dans les réglages ou par le bouton « Vue simplifiée » de la barre supérieure.

## Composition

La barre latérale bleu nuit ancre la navigation dans les deux thèmes. Le contenu : titre, sous-titre et bouton Actualiser, puis des puces de filtre (Tous, Serveurs, Docker, À vérifier, avec leurs nombres) qui remplacent les anciennes tuiles colorées, puis la liste. Contours de 1 px, aucune ombre décalée : la hiérarchie vient de la couleur des marques et des fonds `raise` / `head`. Toutes les boîtes, badges, boutons, indicateurs, barres et dialogues sont carrés (`border-radius: 0`, pseudo-éléments compris). Les contrôles que WebKit arrondit d’office sont redessinés : cases à cocher carrées (violet et coche blanche à angles vifs une fois cochées), menus déroulants des réglages sans habillage natif, avec un triangle plein. Les icônes Lucide ont des extrémités et des jonctions carrées.

## Couleur

Les quatre teintes de la [palette des produits Monday](https://www.brand-monday.com/products) font un travail précis, jamais décoratif :

- vert `#00CA72` : serveur de développement (indicatif, bord du bloc) ;
- violet `#6161FF` : conteneur Docker, ligne « maintenant », sélection, navigation active et contour de focus (lavande `#B7B7FF` en sombre) ;
- jaune `#FFCC00` : au-delà du seuil « À vérifier » (indicatif, bloc, jauge d’âge, seuil sur la frise) et pression mémoire, toujours accompagné d’un mot ;
- rose `#FB275D` : arrêt (carré plein des boutons Arrêter, Quitter et Arrêter le groupe, bouton d’arrêt des confirmations).

L’exposition réseau d’un service est un fait, pas une alerte : un carré évidé, à côté du carré vert « local ». Les pastilles de projet de la barre latérale prennent des teintes hors statut (vert, cyan, lavande, gris). En clair, le jaune reçoit un filet d’encre pour se détacher du fond crème. La barre de sélection de Processus et les notifications sont neutres.

Le texte reste à l’encre ou en gris secondaire, jamais dans la couleur d’une série. Thème sombre : fond `#0E1024`, rangées de groupe `#151838`, en-têtes `#181B34`. Thème clair : fond `#F6F5F0`, surfaces `#FBFAF6`, même barre latérale bleu nuit. Le thème suit macOS par défaut ; le sélecteur Système, Clair, Sombre reste dans la barre latérale. Les couleurs de la grille sont celles des premières maquettes, conservées à la demande, avec deux réglages de contraste en clair (gris secondaire `#4F5274`, case CPU la plus chaude `#007F45`).

## Typographie

Archivo Variable pour l’interface (axe de largeur : titres et noms de groupe en largeur 84–85 %, graisse 800) ; JetBrains Mono Variable pour les ports, PID, durées, mesures et commandes. Les deux fontes sont embarquées via Fontsource, sans requête réseau. Titre 34 px, noms de service 14,5 px, métadonnées 11–12 px, en-têtes de colonnes 11 px en capitales.

## Grille des programmes (services)

- Chaque rangée a le même mobilier : indicatif carré du port (vert serveur, violet conteneur, jaune au-delà du seuil, gris pour les outils et services macOS ; un clic ouvre un port web, un port non web reste en pointillés dans la liste des autres ports), nom (ouvre les détails), description, heure réelle de lancement (« depuis jeu. 03:10 »), accès local ou réseau, CPU et mémoire, commande en une ligne, puis « Arrêter ».
- La frise couvre le seuil « À vérifier » plus un quart (10 h pour le seuil de 8 h par défaut), sur une seule échelle de temps pour toutes les rangées. Graduations aux heures rondes ; seuil tracé en jaune (encre en clair) ; ligne « maintenant » violette avec l’heure du relevé. Un service lancé avant la fenêtre pointe à gauche et affiche son heure de lancement ; un bloc trop court garde sa durée à l’extérieur.
- Légende sous la liste : serveur, conteneur, au-delà du seuil, maintenant, fenêtre affichée, accès local ou réseau. Le texte de la frise est doublé pour les lecteurs d’écran (« depuis …, durée, au-delà de 8 h »).
- Sous 900 px, la commande et les heures des graduations disparaissent ; le seuil ne garde que son carré, avec son libellé en infobulle.

## Vue simplifiée

- Pour un coup d’œil rapide et moins de bruit visuel. Le réglage `simpleView` est enregistré par le backend, comme la langue.
- Services : liste compacte de 46 px par rangée, petit carré de couleur et port, nom et description sur une ligne, jauge d’âge qui se remplit jusqu’au seuil (pleine et jaune au-delà, avec un carré jaune et « au-delà de 8 h » pour les lecteurs d’écran), puis « Arrêter ». Pas de frise, pas de commande, pas d’accès.
- Processus : une bande de chiffres sur une ligne (processeur avec programmes et noyau, mémoire avec la pression, swap, température, ventilateur, GPU, puissance), puis la liste avec une barre CPU fine. Pas d’historique : rien n’est conservé côté interface dans ce mode.

## Processus (grille)

- En tête, deux minutes de charge échantillonnées toutes les 2 s : graphique en marches, programmes en vert et noyau empilé au-dessus, valeur actuelle et répartition dans l’en-tête, étiquette de fin sur la ligne « maintenant ». À droite, la mémoire (valeur, jauge contre le total, pression, swap, nombre de processus). Dessous, une bande de capteurs (température moyenne des cœurs avec le maximum et l’état thermique de macOS, ventilateur le plus rapide en tr/min, GPU, puissance du Mac entier ; un état thermique dégradé passe sa note en encre avec un carré jaune et son nom ; une valeur que le Mac n’expose pas affiche « — » et « non exposé par ce Mac », sans estimation).
- Chaque application a son processeur actuel dans une case colorée et une bande de 60 cases (une par relevé) sur la même ligne « maintenant ». La rampe est une seule teinte de vert, graduée par rapport à un cœur : moins de 1 %, une fraction de cœur, un cœur, deux cœurs et plus ; la légende donne les seuils et « un cœur sur 8 = 12,5 % ». La ligne « Noyau macOS (non attribué) » garde la même échelle, désaturée.
- L’historique est gardé côté interface uniquement (`addSample`, 60 relevés), seulement dans ce mode et seulement pendant que la vue est visible.
- Liste regroupée par application, triée par processeur par défaut (en part du Mac entier : tous les cœurs = 100 %, pour que les lignes s’additionnent jusqu’au graphique, contrairement à `top` où 100 % vaut un cœur), limitée aux 40 premières lignes avec « Tout afficher ». Filtre « Les miens » par défaut. Les chiffres approximatifs (processus d’autres utilisateurs) sont préfixés par `≈`. L’ordre des lignes se fige tant que le pointeur est sur la liste ou qu’une sélection est en cours. La mesure s’arrête quand la vue ou la fenêtre est masquée.
- Une application se ferme comme avec ⌘Q (`NSRunningApplication.terminate`) pour pouvoir enregistrer ; l’arrêt forcé n’est proposé qu’après un refus. La sélection multiple affiche ce qu’elle libérerait (mémoire, processeur) avant la confirmation, dont le bouton par défaut est « Annuler ».

## Interaction et accessibilité

- Navigation, recherche, actions rapides et protections du moteur Rust conservées.
- Contraste AA du texte vérifié dans les deux thèmes et les deux modes, à 1280 et 800 px (sonde de contraste réel dans la page). Contour de focus visible ; anneau blanc sur les surfaces violettes (en-tête des dialogues, navigation active), où la couleur de focus du thème ne contraste pas assez.
- Barre de titre macOS intégrée (`Overlay`, sans titre) : les boutons de fenêtre se posent sur la barre latérale bleu nuit et la barre supérieure sert à déplacer la fenêtre. L’apparence native et le fond de la fenêtre suivent le thème choisi dans Portlight.
- La barre latérale défile quand la fenêtre est trop basse : la liste des projets n’est jamais écrasée, et la bande des boutons de fenêtre reste en haut.
- Chaque groupe de projet se replie et se déplie ; un bouton de la barre d’outils replie ou déplie tous les groupes. L’état est mémorisé localement ; une recherche affiche toujours ses résultats.
- « Arrêter le groupe » (tri par projet uniquement) arrête les services arrêtables affichés dans le groupe : chaque processus avec son lanceur, les conteneurs en un seul `docker stop` avec le reste de leur projet Compose. La confirmation liste les processus et conteneurs visés et la commande équivalente. Si des processus résistent, le bouton devient « Forcer l’arrêt », qui ne vise que les processus : les conteneurs ne sont jamais forcés.
- Dialogues natifs (`<dialog>`) avec confinement du focus et retour à l’élément d’origine. Pas de flou décoratif, pas de mouvement de mise en page au survol ; mouvement réduit respecté.
- Actualisation toutes les 10 secondes, suspendue si la fenêtre est masquée ou pendant un arrêt. Heure du relevé et état ancien conservés.

## Portées d’arrêt et barre des menus

- L’arrêt par défaut vise toujours le seul processus ou conteneur en écoute. Les portées plus larges (lanceur et descendants, projet Compose) sont proposées dans les détails, dans un encadré à liseré jaune, avec un bouton secondaire : elles ne concurrencent pas l’action principale.
- Toute confirmation liste exactement les processus (PID, nom, ports) ou conteneurs concernés, avec la commande équivalente.
- Icône de l’app : un carré violet plein, sans ombre décalée, avec un phare blanc, ses faisceaux blancs, sa lanterne et son socle verts, sur fond bleu nuit, la couleur de la barre latérale (`src-tauri/icon.svg`). Le vert dit « en écoute », comme les serveurs de la grille ; le jaune et le rose restent réservés aux états et à l’arrêt. L’icône suit la grille des icônes macOS (824 px dans 1024) pour que macOS 26 ne l’enferme pas dans un cadre gris. La barre latérale reprend la même icône, redessinée sur la grille de celle de la barre des menus.
- La barre des menus utilise la même icône en modèle monochrome (`src-tauri/tray.svg` : le carré plein, le phare et ses faisceaux découpés dedans) et le nombre de ports occupés. Ses actions d’arrêt ouvrent la fenêtre et passent par la même confirmation.
- Les réglages tiennent dans un seul panneau : langue, vue simplifiée, délai « À vérifier », dossiers de projets, serveurs supplémentaires, éditeur, ouverture à la connexion. Les protections (moteur Docker, services macOS) sont rappelées à côté des champs qui pourraient les concerner.

## Langues

- Anglais par défaut, français disponible. Le choix est enregistré dans les réglages du backend : il s’applique aussi à la barre des menus, aux raisons de protection et aux messages d’arrêt.
- Sélecteur `EN | FR` en police mono dans la barre latérale, sur la même rangée que le thème. Le choix est aussi proposé dans les réglages.
- Les nombres, heures et dates suivent la langue (`12.3%` / `12,3 %`, `MB` / `Mo`, `d` / `j`, 12 h / 24 h).
