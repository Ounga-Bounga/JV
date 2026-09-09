# JV — Projets de jeux

Ce depot regroupe plusieurs petits jeux independants.

- [`dnd-dungeon-crawler/`](./dnd-dungeon-crawler) — *La Crypte aux Treize Voies*, un RPG roguelike au tour par tour ou l'on compose une equipe de 4 heros parmi 13 classes de D&D.
- Ragdoll Battle 3D (racine du depot, voir ci-dessous).

## Ragdoll Battle 3D

Simulateur de bataille 3D avec des IA ragdoll qui s'affrontent, et une camera libre inspiree de *Totally Accurate Battle Simulator*.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichee (par defaut http://localhost:5173).

## Commandes

- **Panneau (haut-gauche)** : nombre d'unites par equipe, bouton *Lancer la bataille*, *Reinitialiser*, curseur de vitesse de simulation.
- **Camera libre** :
  - Clic gauche sur la scene : verrouille la souris pour regarder autour
  - `ZQSD` / `WASD` ou fleches : deplacement
  - `Espace` / `Ctrl` : monter / descendre
  - `Maj` : acceleration
  - Molette : ajuste la vitesse de deplacement
  - `Echap` : libere la souris

## Comment ca marche

- **Physique** : [cannon-es](https://github.com/pmndrs/cannon-es), chaque combattant est un ragdoll articule (bassin, torse, tete, bras, jambes) relie par des liaisons a rotule.
- **IA** : chaque unite cherche l'ennemi le plus proche, marche vers lui (cycle de marche procedural piloté par des controleurs PD sur les articulations) puis dechaine des coups de poing au contact. Les coups appliquent des degats et une impulsion de recul ; a 0 PV, l'unite devient un ragdoll totalement inerte.
- **Rendu** : [three.js](https://threejs.org/).

## Build de production

```bash
npm run build
npm run preview
```
