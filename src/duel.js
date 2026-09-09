import { renderPortrait } from './portrait.js';
import { setTooltip, hide as hideTooltip } from './tooltip.js';
import { PLAYER_STATS, ENEMY_PRESET } from './characters.js';
import {
  ACTIONS,
  ACTION_INFO,
  MAX_CHARGE,
  makeFighter,
  canAfford,
  resolveRound,
  hitChance,
  parryChance,
  reloadCritChance,
  shotDamageRange,
} from './rules.js';
import { chooseEnemyAction } from './ai.js';

const ROUND_TIME_MS = 6000;

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
    actionBar: document.getElementById('actionBar'),
  };
  els.playerPortrait.innerHTML = renderPortrait('player');
  els.enemyPortrait.innerHTML = renderPortrait('enemy');
  els.enemyHudName.textContent = ENEMY_PRESET.name;

  els.actionBar.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (locked || !canAfford(player, action)) return;
      resolvePlayerChoice(action, false);
    });
  });
}

export function startDuel() {
  player = makeFighter(PLAYER_STATS, 'Vous');
  enemy = makeFighter(ENEMY_PRESET.stats, ENEMY_PRESET.name);
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
  enemyAction = chooseEnemyAction(enemy, player, Math.random);
  els.enemyTell.textContent = TELL_LINES[Math.floor(Math.random() * TELL_LINES.length)];

  const buttons = els.actionBar.querySelectorAll('.action-btn');
  buttons.forEach((btn) => {
    const action = btn.dataset.action;
    const affordable = canAfford(player, action);
    btn.disabled = !affordable;
    setTooltip(btn, () => buildActionTooltip(action));
    if (action === ACTIONS.TIRER) {
      document.getElementById('costTirer').textContent = affordable ? '' : `requiert ${ACTION_INFO.TIRER.cost} Charge`;
    }
  });

  runTimer();
}

function buildActionTooltip(action) {
  const dmg = shotDamageRange(player.stats);
  if (action === ACTIONS.TIRER) {
    const hc = hitChance(player.stats, enemy.stats);
    const blocked = parryChance(enemy.stats, player.stats);
    return {
      title: '🏹 Tirer (coûte 1 Charge)',
      body: `Dégâts si touché : <b>${dmg.min}–${dmg.max}</b>.
      <div class="tooltip-row"><span>Chance de toucher si l'adversaire ne pare pas</span><b>${hc}%</b></div>
      <div class="tooltip-row"><span>Chance qu'il bloque s'il Pare</span><b>${blocked}%</b></div>
      <div class="tooltip-row"><span>S'il Recharge</span><b>touché garanti, +50% dégâts</b></div>
      Vous avez actuellement <b>${player.charge}</b> Charge(s).`,
    };
  }
  if (action === ACTIONS.PARER) {
    const pc = parryChance(player.stats, enemy.stats);
    return {
      title: '🛡️ Parer (gratuit)',
      body: `<div class="tooltip-row"><span>Chance de bloquer un Tir adverse</span><b>${pc}%</b></div>
      Ne rapporte rien si l'adversaire Recharge ou Pare aussi : vous perdez le tempo.`,
    };
  }
  const rc = reloadCritChance(player.stats);
  return {
    title: '🔄 Recharger (gratuit)',
    body: `Gagne 1 Charge (max ${MAX_CHARGE}).
    <div class="tooltip-row"><span>Chance de recharge critique (+2 au lieu de +1)</span><b>${rc}%</b></div>
    <b>Danger :</b> si l'adversaire Tire, vous êtes touché à coup sûr et la Charge n'est pas gagnée.`,
  };
}

function runTimer() {
  cancelAnimationFrame(rafId);
  const start = performance.now();
  const tick = (now) => {
    const remaining = Math.max(0, ROUND_TIME_MS - (now - start));
    els.timerFill.style.width = `${(remaining / ROUND_TIME_MS) * 100}%`;
    if (remaining <= 0) {
      resolvePlayerChoice(ACTIONS.PARER, true);
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function clearPoses() {
  [els.playerPortrait, els.enemyPortrait].forEach((el) => {
    el.classList.remove('pose-tirer', 'pose-parer', 'pose-recharger', 'pose-hit');
  });
}

function poseClassFor(action) {
  return `pose-${action.toLowerCase()}`;
}

function resolvePlayerChoice(playerAction, wasTimeout) {
  if (locked) return;
  locked = true;
  cancelAnimationFrame(rafId);
  hideTooltip();
  els.actionBar.querySelectorAll('.action-btn').forEach((b) => (b.disabled = true));
  els.enemyTell.textContent = wasTimeout
    ? 'Trop long à réfléchir : vous levez votre bouclier par réflexe.'
    : els.enemyTell.textContent;

  els.playerPortrait.classList.add(poseClassFor(playerAction));
  els.enemyPortrait.classList.add(poseClassFor(enemyAction));

  const hpBeforePlayer = player.hp;
  const hpBeforeEnemy = enemy.hp;

  setTimeout(() => {
    const { log, winner } = resolveRound({
      actorA: player,
      actionA: playerAction,
      actorB: enemy,
      actionB: enemyAction,
      rng: Math.random,
    });

    if (player.hp < hpBeforePlayer) flashHit(els.playerPortrait);
    if (enemy.hp < hpBeforeEnemy) flashHit(els.enemyPortrait);

    els.combatLog.innerHTML = log.map((l) => `<div>${l}</div>`).join('');
    renderHud();

    if (winner) {
      setTimeout(() => finishDuel(winner), 900);
    } else {
      setTimeout(startRound, 1500);
    }
  }, 500);
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
