# La Crypte aux Treize Voies

Un RPG roguelike auto-battler dans le navigateur : composez une compagnie de 4 héros parmi les 13 classes de D&D, regardez-la combattre seule salle après salle, et ajustez équipement, formation et talents entre les affrontements pour descendre dans une Crypte générée aléatoirement jusqu'au boss final.

## Lancer le projet

Aucune installation requise : c'est une page HTML autonome (HTML/CSS/JS vanilla, sans dépendance).

```bash
npx serve .
# ou simplement ouvrir index.html dans un navigateur
```

## Contenu

- **13 classes** (les 12 classes historiques de D&D + l'Artificier), chacune avec ses statistiques de base, 2 sorts/capacités spéciales, une attaque de base et un trait passif unique.
- **Combats automatiques au tour par tour** : chaque personnage agit seul selon une IA (soigne les blessés, place ses buffs, cible les ennemis les plus faibles...), avec ordre d'initiative, lignes avant/arrière, concentration (ressource de sorts) et effets de statut (étourdissement, affaiblissement, marquage, bouclier...). Lecture, pause, étape par étape ou résolution instantanée, au choix.
- **Carte de donjon générée** à chaque expédition, avec la compagnie visible se déplaçant de salle en salle façon RPG : salles de combat, élites, marchand, évènement à choix, et campement, menant à un boss final.
- **Butin et synergies** : objets avec bonus conditionnels selon le rôle ou la composition de l'équipe, synergies de rôles calculées en temps réel (ex. 2+ Remparts, 3+ Lanceurs de sorts...), montées de niveau avec choix de talents permanents.
- **Sauvegarde locale** (localStorage) et Nouvelle Partie+ après une victoire.

## Notes techniques

Fichier unique `index.html`, aucune dépendance externe hormis les polices Google Fonts (Cinzel, Spectral, JetBrains Mono).
