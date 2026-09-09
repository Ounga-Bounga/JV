import { ACTIONS } from './rules.js';

// IA volontairement simple pour la V1 : ponderation par etat de Charge et
// agressivite croissante quand le joueur est bas en vie. A etoffer plus tard
// (lecture de pattern, bluff, etc.)
export function chooseEnemyAction(enemy, player, rng) {
  const canShoot = enemy.charge >= 1;
  const playerLowHp = player.hp / player.maxHp < 0.35;

  let weights = canShoot
    ? { TIRER: 0.45, PARER: 0.3, RECHARGER: 0.25 }
    : { TIRER: 0, PARER: 0.45, RECHARGER: 0.55 };

  if (playerLowHp && canShoot) {
    weights = { ...weights, TIRER: weights.TIRER + 0.2, PARER: weights.PARER - 0.1, RECHARGER: weights.RECHARGER - 0.1 };
  }

  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [action, weight] of entries) {
    if (roll < weight) return ACTIONS[action];
    roll -= weight;
  }
  return ACTIONS.PARER;
}
