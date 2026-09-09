// Toute la logique mathematique et positionnelle du duel vit ici, sous forme
// de fonctions pures. Rien ici ne touche au DOM : ca permet de calculer les
// probabilites affichees dans les tooltips avec EXACTEMENT les memes formules
// que celles utilisees pour resoudre le combat.

export const BOARD_LENGTH = 7; // une ligne de 7 cases, positions 0..6
export const LAST_CELL = BOARD_LENGTH - 1;

export const ACTIONS = {
  TIRER: 'TIRER',
  CAC: 'CAC',
  PARER: 'PARER',
  RECHARGER: 'RECHARGER',
  AVANCER: 'AVANCER',
  RECULER: 'RECULER',
  SAUTER: 'SAUTER',
  ECHANGER: 'ECHANGER',
  BALAYETTE: 'BALAYETTE',
};

export const ACTION_INFO = {
  TIRER: { label: 'Tirer', icon: '🏹', cost: 1 },
  CAC: { label: 'Frapper', icon: '⚔️', cost: 0 },
  PARER: { label: 'Parer', icon: '🛡️', cost: 0 },
  RECHARGER: { label: 'Recharger', icon: '🔄', cost: 0 },
  AVANCER: { label: 'Avancer', icon: '➡️', cost: 0 },
  RECULER: { label: 'Reculer', icon: '⬅️', cost: 0 },
  SAUTER: { label: 'Bondir', icon: '💨', cost: 0 },
  ECHANGER: { label: 'Échanger', icon: '🔀', cost: 0 },
  BALAYETTE: { label: 'Balayette', icon: '🦵', cost: 0 },
};

export const MAX_CHARGE = 3;

// Une action "menace" inflige un effet direct (dégâts ou chute) à l'adversaire.
const THREATS = new Set([ACTIONS.TIRER, ACTIONS.CAC, ACTIONS.BALAYETTE]);
// Une action "engagée" laisse son auteur exposé : un tir, un coup ou une
// balayette adverses la punissent sans contestation possible.
const TELEGRAPHED = new Set([ACTIONS.RECHARGER, ACTIONS.SAUTER, ACTIONS.ECHANGER]);
const FOOTWORK = new Set([ACTIONS.AVANCER, ACTIONS.RECULER]);

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// --- Formules dependantes des stats -------------------------------------
// FOR : Force -> degats des coups et tirs
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

export function meleeDamageRange(stats) {
  const base = 9 + Math.round(stats.FOR * 1.7);
  return { min: base, max: base + 10 };
}

function rollFromRange(range, rng) {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

// Distance actuelle entre deux combattants (positions sur la ligne 0..6).
export function distanceBetween(a, b) {
  return Math.abs(a.pos - b.pos);
}

// Chance qu'un Tir touche : la Précision fait la différence, et chaque case
// de distance au-delà du contact rend le tir un peu plus difficile.
export function hitChance(attacker, defender, distance = 1) {
  return clamp(55 + (attacker.PRE - defender.PRE) * 3 - (distance - 1) * 2, 15, 90);
}

// Chance de toucher au corps-à-corps (toujours à distance 1).
export function meleeHitChance(attacker, defender) {
  return clamp(60 + (attacker.PRE - defender.PRE) * 3, 15, 92);
}

// Chance que la parade bloque totalement un Tir, un Coup ou une Balayette.
export function parryChance(defender, attacker) {
  return clamp(62 + (defender.PRE - attacker.PRE) * 3, 15, 95);
}

// Chance de gagner une charge bonus (2 au lieu d'1) en rechargeant.
export function reloadCritChance(stats) {
  return clamp(20 + (stats.VIV - 10) * 4, 5, 65);
}

export function makeFighter(stats, name, startPos) {
  return {
    name,
    stats,
    hp: maxHpFor(stats),
    maxHp: maxHpFor(stats),
    charge: 0,
    pos: startPos,
    stunned: false,
  };
}

// --- Disponibilité des actions, selon la distance et l'état du combattant --

function towardSign(from, to) {
  return from === to ? 0 : from < to ? 1 : -1;
}

export function canRetreat(fighter, opponent) {
  const dir = -towardSign(fighter.pos, opponent.pos);
  const next = fighter.pos + dir;
  return next >= 0 && next <= LAST_CELL;
}

export function availableActions(fighter, opponent) {
  const distance = distanceBetween(fighter, opponent);
  const list = [];
  if (fighter.charge >= ACTION_INFO.TIRER.cost) list.push(ACTIONS.TIRER);
  if (distance === 1) list.push(ACTIONS.CAC, ACTIONS.BALAYETTE, ACTIONS.ECHANGER);
  list.push(ACTIONS.PARER);
  if (fighter.charge < MAX_CHARGE) list.push(ACTIONS.RECHARGER);
  if (distance > 1) list.push(ACTIONS.AVANCER);
  if (distance >= 3) list.push(ACTIONS.SAUTER);
  if (canRetreat(fighter, opponent)) list.push(ACTIONS.RECULER);
  return list;
}

// --- Déplacements ---------------------------------------------------------
// Toujours calculés à partir de positions figées en début de round, pour que
// deux déplacements simultanés restent symétriques.

function advanceTo(fighter, ownStart, opponentStart, steps) {
  const dir = towardSign(ownStart, opponentStart);
  let next = ownStart + dir * steps;
  next = dir >= 0 ? Math.min(next, opponentStart - 1) : Math.max(next, opponentStart + 1);
  fighter.pos = clamp(next, 0, LAST_CELL);
}

function retreatTo(fighter, ownStart, opponentStart, steps) {
  const dir = -towardSign(ownStart, opponentStart);
  fighter.pos = clamp(ownStart + dir * steps, 0, LAST_CELL);
}

// --- Resolution d'un round -------------------------------------------------
// rng() doit retourner un flottant [0,1). On l'injecte pour pouvoir tester
// la logique de maniere deterministe.
export function resolveRound({ actorA, actionA, actorB, actionB, rng }) {
  const log = [];
  const startA = actorA.pos;
  const startB = actorB.pos;

  if (actionA === ACTIONS.TIRER) actorA.charge -= 1;
  if (actionB === ACTIONS.TIRER) actorB.charge -= 1;

  const dealShot = (shooter, target, distance, bonus, tag) => {
    const dmg = Math.round(rollFromRange(shotDamageRange(shooter.stats), rng) * bonus);
    target.hp = clamp(target.hp - dmg, 0, target.maxHp);
    log.push(`${shooter.name} ${tag} pour ${dmg} dégâts !`);
  };
  const dealMelee = (attacker, target, bonus, tag) => {
    const dmg = Math.round(rollFromRange(meleeDamageRange(attacker.stats), rng) * bonus);
    target.hp = clamp(target.hp - dmg, 0, target.maxHp);
    log.push(`${attacker.name} ${tag} pour ${dmg} dégâts !`);
  };
  const knockDown = (sweeper, target, tag) => {
    target.stunned = true;
    log.push(`${sweeper.name} ${tag} ${target.name} passe le prochain round à terre.`);
  };
  const applyReload = (actor) => {
    const crit = reloadCritChance(actor.stats);
    const roll = rng() * 100;
    const gain = roll < crit ? 2 : 1;
    actor.charge = clamp(actor.charge + gain, 0, MAX_CHARGE);
    log.push(`${actor.name} recharge (+${gain} Charge)${roll < crit ? ' — recharge experte !' : '.'}`);
  };
  const applyMovementFor = (actor, action, ownStart, opponentStart) => {
    if (action === ACTIONS.AVANCER) { advanceTo(actor, ownStart, opponentStart, 1); log.push(`${actor.name} avance.`); }
    else if (action === ACTIONS.RECULER) { retreatTo(actor, ownStart, opponentStart, 1); log.push(`${actor.name} recule.`); }
    else if (action === ACTIONS.SAUTER) { advanceTo(actor, ownStart, opponentStart, 2); log.push(`${actor.name} bondit en avant.`); }
    else if (action === ACTIONS.RECHARGER) { applyReload(actor); }
    else if (action === ACTIONS.PARER) { log.push(`${actor.name} garde la garde haute.`); }
  };

  const isThreatA = THREATS.has(actionA);
  const isThreatB = THREATS.has(actionB);

  if (isThreatA && isThreatB) {
    resolveThreatVsThreat(actorA, actionA, actorB, actionB, rng, log, dealShot, dealMelee, knockDown);
  } else if (isThreatA !== isThreatB) {
    const [threatActor, threatAction, otherActor, otherAction, threatIsA] = isThreatA
      ? [actorA, actionA, actorB, actionB, true]
      : [actorB, actionB, actorA, actionA, false];
    resolveThreatVsOther({
      threatActor, threatAction, otherActor, otherAction, rng, log,
      dealShot, dealMelee, knockDown,
      ownStart: threatIsA ? startB : startA, // position de départ de l'autre (pour Reculer/Recharger)
      opponentStart: threatIsA ? startA : startB,
    });
  } else if (actionA === ACTIONS.ECHANGER || actionB === ACTIONS.ECHANGER) {
    if (actionA === ACTIONS.ECHANGER && actionB === ACTIONS.ECHANGER) {
      log.push(`${actorA.name} et ${actorB.name} tentent de se croiser en même temps : personne ne bouge.`);
    } else {
      const [swapper, other, otherAction] = actionA === ACTIONS.ECHANGER
        ? [actorA, actorB, actionB]
        : [actorB, actorA, actionA];
      actorA.pos = startB;
      actorB.pos = startA;
      log.push(`${swapper.name} roule sous sa garde et change de côté.`);
      // Recharger reste possible pendant la manœuvre ; un déplacement est lui coupé court.
      if (otherAction === ACTIONS.RECHARGER) applyReload(other);
      else if (otherAction !== ACTIONS.PARER) log.push(`${other.name} n'a pas eu le temps d'achever son mouvement.`);
    }
  } else {
    applyMovementFor(actorA, actionA, startA, startB);
    applyMovementFor(actorB, actionB, startB, startA);
    // Deux pas simultanés vers le centre peuvent atterrir sur la même case :
    // dans ce cas précis, personne n'avance (on annule les deux mouvements).
    if (actorA.pos === actorB.pos) {
      actorA.pos = startA;
      actorB.pos = startB;
      log.push(`${actorA.name} et ${actorB.name} manquent de se percuter en plein élan : personne n'avance.`);
    }
  }

  const winner = actorA.hp <= 0 && actorB.hp <= 0
    ? 'draw'
    : actorA.hp <= 0
      ? actorB.name
      : actorB.hp <= 0
        ? actorA.name
        : null;

  return { log, winner };
}

function resolveThreatVsThreat(actorA, actionA, actorB, actionB, rng, log, dealShot, dealMelee, knockDown) {
  const distance = distanceBetween(actorA, actorB);

  if (actionA === actionB) {
    if (actionA === ACTIONS.BALAYETTE) {
      log.push(`${actorA.name} et ${actorB.name} se prennent mutuellement les jambes : personne ne tombe.`);
      return;
    }
    // Tir contre Tir, ou Frapper contre Frapper : deux jets indépendants.
    const isShot = actionA === ACTIONS.TIRER;
    const chanceA = isShot ? hitChance(actorA.stats, actorB.stats, distance) : meleeHitChance(actorA.stats, actorB.stats);
    const chanceB = isShot ? hitChance(actorB.stats, actorA.stats, distance) : meleeHitChance(actorB.stats, actorA.stats);
    const strike = (attacker, target) => {
      if (isShot) dealShot(attacker, target, distance, 1, 'touche');
      else dealMelee(attacker, target, 1, 'frappe et touche');
    };
    if (rng() * 100 < chanceA) strike(actorA, actorB); else log.push(`${actorA.name} ${isShot ? 'tire' : 'frappe'}… et rate.`);
    if (rng() * 100 < chanceB) strike(actorB, actorA); else log.push(`${actorB.name} ${isShot ? 'tire' : 'frappe'}… et rate.`);
    return;
  }

  const pair = new Set([actionA, actionB]);
  const nameFor = (action) => (actionA === action ? actorA : actorB);
  const other = (action) => (actionA === action ? actorB : actorA);

  if (pair.has(ACTIONS.CAC) && pair.has(ACTIONS.TIRER)) {
    const cacActor = nameFor(ACTIONS.CAC);
    const tirerActor = other(ACTIONS.CAC);
    dealMelee(cacActor, tirerActor, 1.1, "s'engouffre à bout portant et frappe");
    log.push(`${tirerActor.name} n'a pas eu le temps de tirer avant d'être touché.`);
    return;
  }
  if (pair.has(ACTIONS.TIRER) && pair.has(ACTIONS.BALAYETTE)) {
    const tirerActor = nameFor(ACTIONS.TIRER);
    const balayetteActor = other(ACTIONS.TIRER);
    dealShot(tirerActor, balayetteActor, distance, 1.5, 'surprend sa balayette et tire');
    log.push(`${balayetteActor.name} était penché(e), bien trop exposé(e).`);
    return;
  }
  if (pair.has(ACTIONS.CAC) && pair.has(ACTIONS.BALAYETTE)) {
    const cacActor = nameFor(ACTIONS.CAC);
    const balayetteActor = other(ACTIONS.CAC);
    knockDown(balayetteActor, cacActor, 'fauche les appuis de son adversaire :');
    return;
  }
}

function resolveThreatVsOther({ threatActor, threatAction, otherActor, otherAction, rng, log, dealShot, dealMelee, knockDown, ownStart, opponentStart }) {
  const distance = distanceBetween(threatActor, otherActor);

  if (otherAction === ACTIONS.PARER) {
    const chance = parryChance(otherActor.stats, threatActor.stats);
    if (rng() * 100 < chance) {
      log.push(`${otherActor.name} bloque ${threatAction === ACTIONS.TIRER ? 'le tir' : threatAction === ACTIONS.CAC ? 'le coup' : 'la balayette'} derrière son bouclier !`);
      return;
    }
    if (threatAction === ACTIONS.TIRER) dealShot(threatActor, otherActor, distance, 1, 'perce la garde et touche');
    else if (threatAction === ACTIONS.CAC) dealMelee(threatActor, otherActor, 1, 'perce la garde et touche');
    else knockDown(threatActor, otherActor, 'passe sous le bouclier et fauche les jambes :');
    return;
  }

  if (threatAction === ACTIONS.CAC && otherAction === ACTIONS.RECULER) {
    retreatTo(otherActor, ownStart, opponentStart, 1);
    log.push(`${otherActor.name} recule hors de portée : le coup de ${threatActor.name} fauche l'air.`);
    return;
  }

  if (TELEGRAPHED.has(otherAction)) {
    const tag = threatAction === ACTIONS.TIRER ? 'surprend' : threatAction === ACTIONS.CAC ? "s'engouffre et frappe" : 'fauche';
    if (threatAction === ACTIONS.TIRER) dealShot(threatActor, otherActor, distance, 1.5, `${tag} ${otherActor.name} et tire`);
    else if (threatAction === ACTIONS.CAC) dealMelee(threatActor, otherActor, 1.3, `${tag} avant qu'il/elle ne réagisse`);
    else knockDown(threatActor, otherActor, 'le/la surprend en pleine action :');
    log.push(`${otherActor.name} n'a pas eu le temps de réagir.`);
    return;
  }

  if (FOOTWORK.has(otherAction)) {
    // On applique quand même le mouvement (esquive partielle), sauf pour Frapper contre Reculer (géré plus haut).
    if (otherAction === ACTIONS.AVANCER) advanceTo(otherActor, ownStart, opponentStart, 1);
    else retreatTo(otherActor, ownStart, opponentStart, 1);

    if (threatAction === ACTIONS.TIRER) {
      const chance = hitChance(threatActor.stats, otherActor.stats, distance);
      if (rng() * 100 < chance) dealShot(threatActor, otherActor, distance, 1, 'touche en mouvement');
      else log.push(`${threatActor.name} tire… et rate sa cible mouvante.`);
    } else {
      // Frapper contre Avancer (rare) ou Balayette contre un pas : l'attaque rate, la cible n'était plus là.
      log.push(`${otherActor.name} se déplace : ${threatActor.name} frappe dans le vide.`);
    }
  }
}
