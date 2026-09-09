export const PLAYER_STATS = { FOR: 12, PRE: 13, VIV: 10, VIG: 11 };

export const ENEMY_PRESET = {
  name: 'Garde-Squelette',
  title: 'Gardien de la crypte',
  stats: { FOR: 11, PRE: 11, VIV: 11, VIG: 11 },
};

export const STAT_INFO = {
  FOR: {
    label: 'Force',
    icon: '💪',
    describe: (v) => {
      const shot = 6 + Math.round(v * 1.4);
      const melee = 9 + Math.round(v * 1.7);
      return `Augmente les dégâts d'un Tir (${shot}–${shot + 8}) et d'un Coup au corps-à-corps (${melee}–${melee + 10}).`;
    },
  },
  PRE: {
    label: 'Précision',
    icon: '🎯',
    describe: () => `Augmente la chance de toucher au Tir et au corps-à-corps, et la chance de réussir une Parade (+3% par point d'écart).`,
  },
  VIV: {
    label: 'Vivacité',
    icon: '⚡',
    describe: (v) => `Chance de Recharge critique (+1 Charge bonus) : actuellement ${Math.min(65, Math.max(5, 20 + (v - 10) * 4))}%.`,
  },
  VIG: {
    label: 'Vigueur',
    icon: '❤️',
    describe: (v) => `Détermine les points de vie maximum (actuellement ${40 + v * 6} PV).`,
  },
};
