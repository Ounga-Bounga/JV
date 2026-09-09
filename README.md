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
révèlent ensuite en même temps, avec une petite animation de clash au centre,
puis se résolvent selon la distance qui vous sépare sur le plateau.

Un plateau de 7 cases sépare les duellistes. À distance, un premier triangle :

- **🏹 Tirer** (coûte 1 Charge) bat **🔄 Recharger** / **💨 Bondir** / **🔀
  Échanger** : toute action engagée expose à un tir garanti, dégâts bonus.
- **🛡️ Parer** (gratuit) bat **🏹 Tirer** (et le Frappe, et la Balayette) :
  bonnes chances de tout bloquer.
- **🔄 Recharger** (gratuit) bat **🛡️ Parer** : fait gagner de la Charge
  pendant que l'adversaire perd son tour. C'est la seule façon de Tirer.

Au contact (distance 1), un second triangle s'ouvre :

- **⚔️ Frapper** bat **🏹 Tirer** à bout portant (le coup part avant le tir).
- **🏹 Tirer** bat **🦵 Balayette** (se pencher pour faucher expose au tir).
- **🦵 Balayette** bat **⚔️ Frapper** (aucun dégât, mais l'adversaire passe le
  round suivant à terre). Elle échoue si l'adversaire recule ou bouge.

**⬅️ Reculer** esquive automatiquement un Frappe adverse. **🔀 Échanger**
permet de changer de côté avec l'adversaire (utile près d'un mur, qui bloque
Reculer). **💨 Bondir** rapproche de 2 cases d'un coup, au même risque que
Recharger ou Échanger face à un Tir.

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
- Plus de relief visuel sur le plateau (obstacles, zones).

## Build de production

```bash
npm run build
npm run preview
```
