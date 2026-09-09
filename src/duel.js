import { renderPortrait } from './portrait.js';
import { setTooltip, hide as hideTooltip } from './tooltip.js';
import { PLAYER_STATS, ENEMY_PRESET, STAT_INFO } from './characters.js';
import {
  ACTIONS,
  ACTION_INFO,
  MAX_CHARGE,
  BOARD_LENGTH,
  LAST_CELL,
  makeFighter,
  availableActions,
  distanceBetween,
  resolveRound,
  hitChance,
  meleeHitChance,
  parryChance,
  reloadCritChance,
  shotDamageRange,
  meleeDamageRange,
} from './rules.js';
import { chooseEnemyAction } from './ai.js';

const ROUND_TIME_MS = 7000;
const RISKY_ACTIONS = new Set([ACTIONS.RECHARGER, ACTIONS.SAUTER, ACTIONS.ECHANGER, ACTIONS.BALAYETTE]);
const MOVE_ORDER = [ACTIONS.AVANCER, ACTIONS.RECULER, ACTIONS.SAUTER, ACTIONS.ECHANGER];
const MELEE_ORDER = [ACTIONS.CAC, ACTIONS.BALAYETTE];
const FIXED_ORDER = [ACTIONS.TIRER, ACTIONS.PARER, ACTIONS.RECHARGER];

const TELL_LINES = [
  "L'adversaire a déjà arrêté son choix.",
  'Son regard ne cille pas.',
  'Il attend, immobile, sa décision prise.',
  'Quelque chose se prépare derrière ce masque.',
  'Trop tard pour le lire : il a déjà choisi.',
];

let els;
let player, enemy;
let enemyAction;
let locked = false;
let rafId = null;
let onEnd;

export function initDuelScreen({ onEnd: endCb }) {
  onEnd = endCb;
  els = {
    playerPortrait: document.getElementById('playerPortrait'),
    enemyPortrait: document.getElementById('enemyPortrait'),
    playerStatus: document.getElementById('playerStatus'),
    enemyStatus: document.getElementById('enemyStatus'),
    playerHpFill: document.getElementById('playerHpFill'),
    enemyHpFill: document.getElementById('enemyHpFill'),
    playerHpText: document.getElementById('playerHpText'),
    enemyHpText: document.getElementById('enemyHpText'),
    playerChargeRow: document.getElementById('playerChargeRow'),
    enemyChargeRow: document.getElementById('enemyChargeRow'),
    enemyHudName: document.getElementById('enemyHudName'),
    enemyTell: document.getElementById('enemyTell'),
    timerFill: document.getElementById('timerFill'),
    combatLog: document.getElementById('combatLog'),
    moveRow: document.getElementById('moveRow'),
    combatRow: document.getElementById('combatRow'),
    board: document.getElementById('board'),
    clashCenter: document.getElementById('clashCenter'),
    distanceValue: document.getElementById('distanceValue'),
  };
  els.playerPortrait.innerHTML = renderPortrait('player');
  els.enemyPortrait.innerHTML = renderPortrait('enemy');
  els.enemyHudName.textContent = ENEMY_PRESET.name;
  setTooltip(els.enemyHudName, () => ({
    title: `${ENEMY_PRESET.name} — ${ENEMY_PRESET.title}`,
    body: Object.keys(STAT_INFO).map((key) => {
      const info = STAT_INFO[key];
      return `<div class="tooltip-row"><span>${info.icon} ${info.label}</span><b>${ENEMY_PRESET.stats[key]}</b></div>`;
    }).join(''),
  }));

  buildBoard();
}

function buildBoard() {
  els.board.innerHTML = '';
  for (let i = 0; i < BOARD_LENGTH; i++) {
    const cell = document.createElement('div');
    cell.className = 'board-cell';
    if (i === 0) cell.classList.add('wall', 'wall-left');
    if (i === LAST_CELL) cell.classList.add('wall', 'wall-right');
    els.board.appendChild(cell);
  }
  els.playerToken = document.createElement('div');
  els.playerToken.className = 'board-token player';
  els.enemyToken = document.createElement('div');
  els.enemyToken.className = 'board-token enemy';
  els.board.appendChild(els.playerToken);
  els.board.appendChild(els.enemyToken);
}

export function startDuel() {
  player = makeFighter(PLAYER_STATS, 'Vous', 0);
  enemy = makeFighter(ENEMY_PRESET.stats, ENEMY_PRESET.name, LAST_CELL);
  els.combatLog.textContent = 'Le duel commence. Que le sort en décide.';
  renderHud();
  startRound();
}

function renderHud() {
  els.playerHpFill.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  els.enemyHpFill.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
  els.playerHpText.textContent = `${Math.max(0, player.hp)} / ${player.maxHp}`;
  els.enemyHpText.textContent = `${Math.max(0, enemy.hp)} / ${enemy.maxHp}`;
  renderCharge(els.playerChargeRow, player.charge);
  renderCharge(els.enemyChargeRow, enemy.charge);
  els.playerToken.style.left = `${(player.pos / LAST_CELL) * 100}%`;
  els.enemyToken.style.left = `${(enemy.pos / LAST_CELL) * 100}%`;
  els.distanceValue.textContent = distanceBetween(player, enemy);
  els.playerStatus.hidden = !player.stunned;
  els.enemyStatus.hidden = !enemy.stunned;
}

function renderCharge(container, charge) {
  container.innerHTML = '';
  for (let i = 0; i < MAX_CHARGE; i++) {
    const pip = document.createElement('div');
    pip.className = 'charge-pip' + (i < charge ? ' filled' : '');
    container.appendChild(pip);
  }
}

function startRound() {
  locked = false;
  clearPoses();

  const playerForced = player.stunned;
  const enemyForced = enemy.stunned;
  player.stunned = false;
  enemy.stunned = false;
  renderHud();
  if (playerForced) { els.playerPortrait.classList.add('pose-stunned'); els.playerStatus.hidden = false; }
  if (enemyForced) { els.enemyPortrait.classList.add('pose-stunned'); els.enemyStatus.hidden = false; }

  enemyAction = enemyForced ? ACTIONS.PARER : chooseEnemyAction(enemy, player, Math.random);

  if (playerForced) {
    els.enemyTell.textContent = 'À terre, vous vous relevez en parant par réflexe…';
    els.moveRow.innerHTML = '';
    els.combatRow.innerHTML = '';
    setTimeout(() => resolvePlayerChoice(ACTIONS.PARER, null), 900);
    return;
  }

  els.enemyTell.textContent = TELL_LINES[Math.floor(Math.random() * TELL_LINES.length)];
  renderActionButtons();
  runTimer();
}

function makeActionButton(action) {
  const btn = document.createElement('button');
  btn.className = 'action-btn has-tooltip';
  btn.dataset.action = action;
  if (RISKY_ACTIONS.has(action)) btn.classList.add('risky');
  const info = ACTION_INFO[action];
  btn.innerHTML = `<span class="action-icon">${info.icon}</span><span class="action-label">${info.label}</span>`;
  setTooltip(btn, () => buildActionTooltip(action));
  btn.addEventListener('click', () => {
    if (locked || btn.disabled) return;
    resolvePlayerChoice(action, btn.getBoundingClientRect());
  });
  return btn;
}

function renderActionButtons() {
  const legal = new Set(availableActions(player, enemy));
  els.moveRow.innerHTML = '';
  MOVE_ORDER.forEach((action) => {
    if (legal.has(action)) els.moveRow.appendChild(makeActionButton(action));
  });

  els.combatRow.innerHTML = '';
  MELEE_ORDER.forEach((action) => {
    if (legal.has(action)) els.combatRow.appendChild(makeActionButton(action));
  });
  FIXED_ORDER.forEach((action) => {
    const btn = makeActionButton(action);
    if (!legal.has(action)) btn.disabled = true;
    els.combatRow.appendChild(btn);
  });
}

function buildActionTooltip(action) {
  const distance = distanceBetween(player, enemy);
  if (action === ACTIONS.TIRER) {
    const hc = hitChance(player.stats, enemy.stats, distance);
    const blocked = parryChance(enemy.stats, player.stats);
    const dmg = shotDamageRange(player.stats);
    return {
      title: '🏹 Tirer (coûte 1 Charge)',
      body: `Dégâts si touché : <b>${dmg.min}–${dmg.max}</b>. La distance actuelle (${distance}) pèse sur la précision.
      <div class="tooltip-row"><span>Chance de toucher (s'il ne pare pas)</span><b>${hc}%</b></div>
      <div class="tooltip-row"><span>Chance qu'il bloque en Parade</span><b>${blocked}%</b></div>
      <div class="tooltip-row"><span>S'il Recharge / Bondit / Échange</span><b>touché garanti, +50%</b></div>
      <div class="tooltip-row"><span>Face à un Frappe adverse (contact)</span><b>vous êtes touché en premier</b></div>
      Vous avez <b>${player.charge}</b> Charge(s).`,
    };
  }
  if (action === ACTIONS.CAC) {
    const mhc = meleeHitChance(player.stats, enemy.stats);
    const dmg = meleeDamageRange(player.stats);
    return {
      title: '⚔️ Frapper (contact, gratuit)',
      body: `Dégâts si touché : <b>${dmg.min}–${dmg.max}</b>.
      <div class="tooltip-row"><span>Chance de toucher</span><b>${mhc}%</b></div>
      <div class="tooltip-row"><span>Contre un Tir adverse</span><b>vous frappez en premier</b></div>
      <div class="tooltip-row"><span>Contre une Balayette</span><b>vous êtes fauché, 0 dégât reçu</b></div>
      <div class="tooltip-row"><span>S'il Recule</span><b>votre coup part dans le vide</b></div>`,
    };
  }
  if (action === ACTIONS.BALAYETTE) {
    return {
      title: '🦵 Balayette (contact, gratuit)',
      body: `Aucun dégât : si elle réussit, l'adversaire passe le prochain round à terre (Parade forcée).
      <div class="tooltip-row"><span>Contre un Frappe adverse</span><b>réussit toujours</b></div>
      <div class="tooltip-row"><span>Contre une Parade ou un Tir</span><b>échoue, vous êtes exposé(e)</b></div>
      <div class="tooltip-row"><span>Si l'adversaire bouge</span><b>rate, sans conséquence</b></div>`,
    };
  }
  if (action === ACTIONS.PARER) {
    const pc = parryChance(player.stats, enemy.stats);
    return {
      title: '🛡️ Parer (gratuit)',
      body: `<div class="tooltip-row"><span>Chance de bloquer un Tir, un Coup ou une Balayette</span><b>${pc}%</b></div>
      Ne rapporte rien si l'adversaire se contente de bouger ou de Recharger : vous perdez le tempo.`,
    };
  }
  if (action === ACTIONS.RECHARGER) {
    const rc = reloadCritChance(player.stats);
    return {
      title: '🔄 Recharger (gratuit)',
      body: `Gagne 1 Charge (max ${MAX_CHARGE}).
      <div class="tooltip-row"><span>Chance de recharge critique (+2)</span><b>${rc}%</b></div>
      <b>Danger :</b> un Tir ou un Frappe adverse vous touche à coup sûr pendant que vous rechargez.`,
    };
  }
  if (action === ACTIONS.AVANCER) {
    return { title: '➡️ Avancer', body: `Rapproche d'une case (distance actuelle : ${distance}). Un Tir adverse garde une chance normale de toucher : avancer n'expose pas plus qu'autre chose.` };
  }
  if (action === ACTIONS.RECULER) {
    return { title: '⬅️ Reculer', body: `Éloigne d'une case. <b>Esquive automatiquement</b> un Frappe adverse au corps-à-corps ! Reste vulnérable à un Tir (chance normale).` };
  }
  if (action === ACTIONS.SAUTER) {
    return { title: '💨 Bondir (2 cases)', body: `Rapproche de 2 cases d'un coup — utile pour foncer au contact. Comme Recharger, un Tir ou un Frappe adverse vous touche à coup sûr pendant le bond.` };
  }
  if (action === ACTIONS.ECHANGER) {
    return { title: '🔀 Échanger (contact, gratuit)', body: `Vous roulez sous sa garde et échangez vos positions — utile pour ne plus être acculé(e) au mur. Comme Recharger, expose à un Tir ou un Frappe garanti.` };
  }
  return { title: ACTION_INFO[action].label, body: '' };
}

function runTimer() {
  cancelAnimationFrame(rafId);
  const start = performance.now();
  const tick = (now) => {
    const remaining = Math.max(0, ROUND_TIME_MS - (now - start));
    els.timerFill.style.width = `${(remaining / ROUND_TIME_MS) * 100}%`;
    if (remaining <= 0) {
      resolvePlayerChoice(ACTIONS.PARER, null);
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function clearPoses() {
  [els.playerPortrait, els.enemyPortrait].forEach((el) => {
    el.classList.remove('pose-tirer', 'pose-cac', 'pose-parer', 'pose-recharger', 'pose-balayette', 'pose-hit', 'pose-stunned');
  });
}

function poseClassFor(action) {
  return `pose-${action.toLowerCase()}`;
}

// --- Icônes qui volent du bouton choisi vers le centre, puis "explosent" --

function flyIcon(icon, fromRect, toPoint, delay) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'clash-flyer';
    el.textContent = icon;
    el.style.left = '0px';
    el.style.top = '0px';
    document.body.appendChild(el);
    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const midX = (startX + toPoint.x) / 2;
    const midY = Math.min(startY, toPoint.y) - 46;
    const anim = el.animate([
      { transform: `translate(${startX}px, ${startY}px) rotate(0deg) scale(0.85)`, opacity: 1 },
      { transform: `translate(${midX}px, ${midY}px) rotate(300deg) scale(1.2)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${toPoint.x}px, ${toPoint.y}px) rotate(540deg) scale(1.35)`, opacity: 0.95 },
    ], { duration: 520, delay, easing: 'cubic-bezier(.25,.55,.3,1)', fill: 'forwards' });
    anim.onfinish = () => { el.remove(); resolve(); };
  });
}

function triggerBurst(point) {
  const burst = document.createElement('div');
  burst.className = 'clash-burst burst-play';
  burst.style.left = `${point.x}px`;
  burst.style.top = `${point.y}px`;
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 550);
}

async function playClash(playerAction, playerOriginRect) {
  const centerRect = els.clashCenter.getBoundingClientRect();
  const center = { x: centerRect.left + centerRect.width / 2, y: centerRect.top + centerRect.height / 2 };
  const playerOrigin = playerOriginRect || els.playerPortrait.getBoundingClientRect();
  const enemyOrigin = els.enemyPortrait.getBoundingClientRect();
  await Promise.all([
    flyIcon(ACTION_INFO[playerAction].icon, playerOrigin, center, 0),
    flyIcon(ACTION_INFO[enemyAction].icon, enemyOrigin, center, 90),
  ]);
  triggerBurst(center);
  await new Promise((resolve) => setTimeout(resolve, 260));
}

function resolvePlayerChoice(playerAction, playerOriginRect) {
  if (locked) return;
  locked = true;
  cancelAnimationFrame(rafId);
  hideTooltip();
  els.moveRow.querySelectorAll('.action-btn').forEach((b) => (b.disabled = true));
  els.combatRow.querySelectorAll('.action-btn').forEach((b) => (b.disabled = true));

  els.playerPortrait.classList.add(poseClassFor(playerAction));
  els.enemyPortrait.classList.add(poseClassFor(enemyAction));

  const hpBeforePlayer = player.hp;
  const hpBeforeEnemy = enemy.hp;

  playClash(playerAction, playerOriginRect).then(() => {
    const result = resolveRound({ actorA: player, actionA: playerAction, actorB: enemy, actionB: enemyAction, rng: Math.random });

    if (player.hp < hpBeforePlayer) flashHit(els.playerPortrait);
    if (enemy.hp < hpBeforeEnemy) flashHit(els.enemyPortrait);

    els.combatLog.innerHTML = result.log.map((l) => `<div>${l}</div>`).join('');
    renderHud();

    if (result.winner) setTimeout(() => finishDuel(result.winner), 900);
    else setTimeout(startRound, 1500);
  });
}

function flashHit(el) {
  el.classList.remove('pose-hit');
  void el.offsetWidth;
  el.classList.add('pose-hit');
}

function finishDuel(winner) {
  els.playerPortrait.classList.remove('pose-hit');
  els.enemyPortrait.classList.remove('pose-hit');
  let result;
  if (winner === 'draw') {
    result = 'draw';
  } else if (winner === player.name) {
    els.playerPortrait.classList.add('pose-victory');
    els.enemyPortrait.classList.add('pose-defeat');
    result = 'victory';
  } else {
    els.enemyPortrait.classList.add('pose-victory');
    els.playerPortrait.classList.add('pose-defeat');
    result = 'defeat';
  }
  setTimeout(() => onEnd({ result }), 1300);
}
