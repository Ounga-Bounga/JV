import { ACTIONS, availableActions, distanceBetween } from './rules.js';

// IA volontairement simple pour la V1 : ponderation par distance, charge et
// vie restante. A etoffer plus tard (lecture de pattern, bluff, etc.)
export function chooseEnemyAction(enemy, player, rng) {
  const distance = distanceBetween(enemy, player);
  const legal = new Set(availableActions(enemy, player));
  const playerLowHp = player.hp / player.maxHp < 0.35;
  const enemyLowHp = enemy.hp / enemy.maxHp < 0.35;

  let weights;
  if (distance === 1) {
    weights = {
      CAC: 0.34,
      BALAYETTE: 0.16,
      TIRER: 0.12,
      RECHARGER: 0.14,
      PARER: 0.14,
      RECULER: 0.06,
      ECHANGER: 0.04,
    };
    if (enemyLowHp) { weights.RECULER += 0.2; weights.CAC -= 0.1; weights.BALAYETTE -= 0.05; }
    if (playerLowHp) { weights.CAC += 0.15; weights.BALAYETTE += 0.1; }
  } else {
    weights = {
      TIRER: 0.4,
      RECHARGER: 0.22,
      PARER: 0.13,
      AVANCER: 0.17,
      SAUTER: 0.08,
    };
    if (playerLowHp) { weights.TIRER += 0.15; weights.RECHARGER -= 0.1; }
    if (enemyLowHp) { weights.PARER += 0.15; weights.AVANCER -= 0.1; }
  }

  const entries = Object.entries(weights).filter(([action, w]) => w > 0 && legal.has(ACTIONS[action]));
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return ACTIONS.PARER;
  let roll = rng() * total;
  for (const [action, weight] of entries) {
    if (roll < weight) return ACTIONS[action];
    roll -= weight;
  }
  return ACTIONS.PARER;
}
