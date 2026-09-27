# Portlight — direction d’interface

UI UX Pro Max a été utilisé pour rechercher un système visuel de monitoring et les recommandations React concernant le focus des modales. Le résultat vérifié est enregistré dans `design-system/portlight/MASTER.md`.

Le catalogue propose un dashboard sombre avec accent vert et des surfaces transparentes. Pour cette application Mac utilitaire, nous adaptons ces recommandations : interface claire par défaut, mode sombre disponible, typographie système locale, surfaces opaques lisibles, accent vert, grille dense mais aérée, icônes Lucide. Aucun chargement de police distant. Les recommandations de landing page ne s’appliquent pas à ce produit desktop.

- Navigation stable : vue d’ensemble, serveurs, Docker, processus anciens, système, historique.
- Projet comme groupe principal ; ports et durées en chiffres tabulaires.
- Pas d’état « live » fictif : heure du relevé affichée, état ancien après 30 secondes, pause disponible.
- Actualisation toutes les 10 secondes, suspendue si la fenêtre est masquée ou pendant un arrêt.
- Arrêt normal avec confirmation du service ciblé, arrêt forcé uniquement après résistance observée.
- Dialogues natifs HTML avec confinement du focus et restauration à la fermeture.
- Couleur complétée par du texte ; focus visible ; mouvement réduit respecté.
- Le seuil de 8 heures indique « à vérifier », sans supposer qu’un serveur est inutilisé.
