# Duel de l'Arène

Duel 1 contre 1 au tour par tour, ambiance donjon : vous affrontez un garde-squelette
à coups de carreaux d'arbalète, à grand renfort de bluff et de probabilités.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée (par défaut http://localhost:5173).

## Le principe

Chaque round, l'adversaire choisit son action **en secret**. Vous avez ensuite
quelques secondes pour choisir la vôtre — sans savoir ce qu'il a décidé — en
voyant les probabilités exactes de chaque option calculées à partir de vos
stats (survolez les boutons et les stats pour le détail). Les deux actions se
révèlent ensuite en même temps et se résolvent.

Trois actions, qui se contrent en triangle façon pierre-feuille-ciseaux :

- **🏹 Tirer** (coûte 1 Charge) bat **🔄 Recharger** : un adversaire pris en
  train de recharger est touché à coup sûr, avec des dégâts bonus.
- **🛡️ Parer** (gratuit) bat **🏹 Tirer** : une parade a de bonnes chances de
  bloquer totalement un tir.
- **🔄 Recharger** (gratuit) bat **🛡️ Parer** : recharger contre une parade est
  sûr et fait gagner de la Charge pendant que l'adversaire perd son tour.

Les stats (Force, Précision, Vivacité, Vigueur) sont fixes pour cette V1 et
pèsent directement sur les formules (dégâts, chance de toucher, chance de
parer, chance de recharge critique) — visibles dans les tooltips.

## Structure du code

- `src/rules.js` — toute la logique de résolution (formules, RNG), pure et
  indépendante du DOM.
- `src/ai.js` — décision de l'adversaire.
- `src/characters.js` — stats des combattants.
- `src/portrait.js` — silhouettes SVG des duellistes.
- `src/menu.js` / `src/duel.js` / `src/main.js` — écrans et mise en scène.
- `src/tooltip.js` — moteur de tooltip générique au survol.

## Prochaines pistes

- Progression (or gagné, boutique d'équipement, plusieurs adversaires).
- IA plus lisible/maline (lecture de patterns, bluff).
- Plus d'actions et de profondeur stratégique autour de la Charge.

## Build de production

```bash
npm run build
npm run preview
```
