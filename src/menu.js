import { renderPortrait } from './portrait.js';
import { setTooltip } from './tooltip.js';
import { PLAYER_STATS, ENEMY_PRESET, STAT_INFO } from './characters.js';
import { ACTION_INFO, hitChance, parryChance, reloadCritChance, shotDamageRange } from './rules.js';

function renderStatList(container, stats) {
  container.innerHTML = '';
  for (const key of Object.keys(STAT_INFO)) {
    const info = STAT_INFO[key];
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `<span class="stat-label">${info.icon} ${info.label}</span><span class="stat-value">${stats[key]}</span>`;
    setTooltip(row, () => ({ title: `${info.icon} ${info.label}`, body: info.describe(stats[key]) }));
    container.appendChild(row);
  }
}

const RULE_TOOLTIPS = {
  TIRER: () => ({
    title: '🏹 Tirer bat Recharger',
    body: `Un tireur surprend toujours un adversaire en train de <b>Recharger</b> : le tir touche à coup sûr, avec +50% de dégâts. Recharger sans savoir si l'adversaire va tirer est donc un pari.`,
  }),
  PARER: () => ({
    title: '🛡️ Parer bat Tirer',
    body: `Face à un <b>Tir</b>, une Parade a une bonne chance de bloquer totalement les dégâts (avantage de base +12%, modifié par l'écart de Précision). Mais Parer contre un adversaire qui Recharge ne rapporte rien : vous perdez le tempo.`,
  }),
  RECHARGER: () => ({
    title: '🔄 Recharger bat Parer',
    body: `Recharger contre une <b>Parade</b> adverse est sûr et vous fait gagner de la Charge pendant que l'adversaire ne fait rien. Recharger est la seule façon de pouvoir Tirer (1 Charge requise).`,
  }),
};

export function initMenuScreen({ onStart }) {
  document.getElementById('menuPlayerPortrait').innerHTML = renderPortrait('player');
  document.getElementById('menuEnemyPortrait').innerHTML = renderPortrait('enemy');
  document.getElementById('enemyName').textContent = ENEMY_PRESET.name;
  document.getElementById('enemyTitle').textContent = ENEMY_PRESET.title;

  renderStatList(document.getElementById('playerStatList'), PLAYER_STATS);
  renderStatList(document.getElementById('enemyStatList'), ENEMY_PRESET.stats);

  document.querySelectorAll('.rule-chip').forEach((chip) => {
    const key = chip.dataset.key;
    setTooltip(chip, RULE_TOOLTIPS[key]);
  });

  setTooltip(document.getElementById('rulesInfoDot'), () => {
    const hc = hitChance(PLAYER_STATS, ENEMY_PRESET.stats);
    const pc = parryChance(PLAYER_STATS, ENEMY_PRESET.stats);
    const rc = reloadCritChance(PLAYER_STATS);
    const dmg = shotDamageRange(PLAYER_STATS);
    return {
      title: 'Vue d\'ensemble',
      body: `Chaque round, votre adversaire choisit son action <b>en secret</b>, puis vous avez quelques secondes pour choisir la vôtre — sans savoir ce qu'il a décidé. Les deux actions se révèlent ensuite ensemble.
      <div class="tooltip-row"><span>Chance de toucher au Tir (base)</span><b>${hc}%</b></div>
      <div class="tooltip-row"><span>Chance de bloquer en Parade</span><b>${pc}%</b></div>
      <div class="tooltip-row"><span>Chance de recharge critique</span><b>${rc}%</b></div>
      <div class="tooltip-row"><span>Dégâts d'un Tir</span><b>${dmg.min}–${dmg.max}</b></div>`,
    };
  });

  document.getElementById('btnStart').addEventListener('click', onStart);
}
