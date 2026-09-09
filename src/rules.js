// Toute la logique mathematique du duel vit ici, sous forme de fonctions pures.
// Rien ici ne touche au DOM : ca permet de calculer les probabilites affichees
// dans les tooltips avec EXACTEMENT les memes formules que celles utilisees
// pour resoudre le combat.

export const ACTIONS = {
  TIRER: 'TIRER',
  PARER: 'PARER',
  RECHARGER: 'RECHARGER',
};

export const ACTION_INFO = {
  TIRER: {
    label: 'Tirer',
    verb: 'tire',
    icon: '🏹',
    cost: 1,
    summary: 'Décoche un carreau. Coûte 1 Charge, que le tir touche ou non.',
  },
  PARER: {
    label: 'Parer',
    verb: 'pare',
    icon: '🛡️',
    cost: 0,
    summary: 'Lève le bouclier. Gratuit, peut bloquer un Tir adverse.',
  },
  RECHARGER: {
    label: 'Recharger',
    verb: 'recharge',
    icon: '🔄',
    cost: 0,
    summary: 'Encoche un carreau. Gratuit, gagne de la Charge — mais expose.',
  },
};

export const MAX_CHARGE = 3;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// --- Formules dependantes des stats -------------------------------------
// FOR : Force -> degats du tir
// PRE : Precision -> chance de toucher / de parer
// VIV : Vivacite -> chance de recharge critique (+1 charge bonus)
// VIG : Vigueur -> points de vie max

export function maxHpFor(stats) {
  return 40 + stats.VIG * 6;
}

export function shotDamageRange(stats) {
  const base = 6 + Math.round(stats.FOR * 1.4);
  return { min: base, max: base + 8 };
}

export function rollShotDamage(stats, rng) {
  const { min, max } = shotDamageRange(stats);
  return min + Math.floor(rng() * (max - min + 1));
}

// Chance qu'un tir "libre" (non pare) touche, PRE de l'attaquant contre celle
// du defenseur. Utilisee pour Tirer vs Tirer.
export function hitChance(attacker, defender) {
  return clamp(55 + (attacker.PRE - defender.PRE) * 3, 15, 90);
}

// Chance que la parade bloque totalement un tir : avantage naturel de +12,
// modifie par l'ecart de Precision des deux duellistes.
export function parryChance(defender, attacker) {
  return clamp(62 + (defender.PRE - attacker.PRE) * 3, 15, 95);
}

// Chance de gagner une charge bonus (2 au lieu d'1) en rechargeant.
export function reloadCritChance(stats) {
  return clamp(20 + (stats.VIV - 10) * 4, 5, 65);
}

export function makeFighter(stats, name) {
  return {
    name,
    stats,
    hp: maxHpFor(stats),
    maxHp: maxHpFor(stats),
    charge: 0,
  };
}

export function canAfford(fighter, action) {
  return fighter.charge >= ACTION_INFO[action].cost;
}

// --- Resolution d'un round -------------------------------------------------
// rng() doit retourner un flottant [0,1). On l'injecte pour pouvoir tester
// la logique de maniere deterministe.
export function resolveRound({ actorA, actionA, actorB, actionB, rng }) {
  const log = [];
  const rolls = [];

  // Le cout de Tirer est toujours paye, touche ou non.
  if (actionA === ACTIONS.TIRER) actorA.charge -= 1;
  if (actionB === ACTIONS.TIRER) actorB.charge -= 1;

  const pair = (a, b) => `${a}|${b}`;

  const applyReload = (actor, other, otherAction) => {
    // Un tir adverse reussi interrompt le rechargement (pas de charge gagnee).
    if (otherAction === ACTIONS.TIRER) return;
    const crit = reloadCritChance(actor.stats);
    const roll = rng() * 100;
    rolls.push({ who: actor.name, kind: 'Recharge critique', chance: crit, roll });
    const gain = roll < crit ? 2 : 1;
    actor.charge = clamp(actor.charge + gain, 0, MAX_CHARGE);
    log.push(`${actor.name} recharge (+${gain} Charge)${roll < crit ? ' — recharge experte !' : '.'}`);
  };

  const applyFreeShot = (shooter, target, bonus, tag) => {
    const dmg = Math.round(rollShotDamage(shooter.stats, rng) * bonus);
    target.hp = clamp(target.hp - dmg, 0, target.maxHp);
    log.push(`${shooter.name} ${tag} pour ${dmg} dégâts !`);
  };

  const applyContestedShot = (shooter, target) => {
    const chance = hitChance(shooter.stats, target.stats);
    const roll = rng() * 100;
    rolls.push({ who: shooter.name, kind: 'Tir', chance, roll });
    if (roll < chance) {
      applyFreeShot(shooter, target, 1, 'touche');
    } else {
      log.push(`${shooter.name} tire… et rate sa cible.`);
    }
  };

  switch (pair(actionA, actionB)) {
    case pair(ACTIONS.TIRER, ACTIONS.TIRER): {
      applyContestedShot(actorA, actorB);
      applyContestedShot(actorB, actorA);
      break;
    }
    case pair(ACTIONS.TIRER, ACTIONS.RECHARGER): {
      applyFreeShot(actorA, actorB, 1.5, 'surprend sa recharge et tire');
      log.push(`${actorB.name} n'a pas eu le temps d'armer son carreau.`);
      break;
    }
    case pair(ACTIONS.RECHARGER, ACTIONS.TIRER): {
      applyFreeShot(actorB, actorA, 1.5, 'surprend sa recharge et tire');
      log.push(`${actorA.name} n'a pas eu le temps d'armer son carreau.`);
      break;
    }
    case pair(ACTIONS.TIRER, ACTIONS.PARER): {
      const chance = parryChance(actorB.stats, actorA.stats);
      const roll = rng() * 100;
      rolls.push({ who: actorB.name, kind: 'Parade', chance, roll });
      if (roll < chance) {
        log.push(`${actorB.name} bloque le tir derrière son bouclier !`);
      } else {
        applyFreeShot(actorA, actorB, 1, 'perce la garde et touche');
      }
      break;
    }
    case pair(ACTIONS.PARER, ACTIONS.TIRER): {
      const chance = parryChance(actorA.stats, actorB.stats);
      const roll = rng() * 100;
      rolls.push({ who: actorA.name, kind: 'Parade', chance, roll });
      if (roll < chance) {
        log.push(`${actorA.name} bloque le tir derrière son bouclier !`);
      } else {
        applyFreeShot(actorB, actorA, 1, 'perce la garde et touche');
      }
      break;
    }
    case pair(ACTIONS.RECHARGER, ACTIONS.RECHARGER): {
      applyReload(actorA, actorB, actionB);
      applyReload(actorB, actorA, actionA);
      break;
    }
    case pair(ACTIONS.PARER, ACTIONS.PARER): {
      log.push(`${actorA.name} et ${actorB.name} se jaugent du regard, boucliers levés.`);
      break;
    }
    case pair(ACTIONS.PARER, ACTIONS.RECHARGER): {
      log.push(`${actorA.name} garde sa garde, pour rien : ${actorB.name} recharge tranquillement.`);
      applyReload(actorB, actorA, actionA);
      break;
    }
    case pair(ACTIONS.RECHARGER, ACTIONS.PARER): {
      log.push(`${actorB.name} garde sa garde, pour rien : ${actorA.name} recharge tranquillement.`);
      applyReload(actorA, actorB, actionB);
      break;
    }
    default:
      throw new Error(`Combinaison d'actions inconnue: ${actionA} / ${actionB}`);
  }

  const winner = actorA.hp <= 0 && actorB.hp <= 0
    ? 'draw'
    : actorA.hp <= 0
      ? actorB.name
      : actorB.hp <= 0
        ? actorA.name
        : null;

  return { log, rolls, winner };
}
