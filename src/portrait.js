// Silhouettes de duellistes en SVG "fait main" (pas d'asset externe). La
// structure est partagee entre les deux combattants ; seule la palette et
// l'orientation changent, et des classes ciblent les parties animables
// (bouclier, arbalete) pour les etats Tirer / Parer / Recharger.

const PALETTES = {
  player: {
    cloak: '#274a63',
    cloakDark: '#152f42',
    armor: '#c9d6df',
    armorDark: '#8a9aa6',
    skin: '#e8c9a0',
    accent: '#e0a640',
    shield: '#3a6d8c',
    shieldRim: '#e0a640',
  },
  enemy: {
    cloak: '#4a2e3a',
    cloakDark: '#2a1620',
    armor: '#8fae86',
    armorDark: '#5c7454',
    skin: '#d7d0b8',
    accent: '#9b3d3d',
    shield: '#5c3a3a',
    shieldRim: '#9b3d3d',
  },
};

export function renderPortrait(kind) {
  const p = PALETTES[kind];
  return `
  <svg class="fighter-svg" viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="245" rx="60" ry="12" fill="#000" opacity="0.35"/>
    <g class="fighter-rig">
      <path class="part-cloak" d="M60 120 Q40 200 55 240 L145 240 Q160 200 140 120 Z" fill="${p.cloakDark}"/>
      <path class="part-legs" d="M75 190 L70 240 L92 240 L96 195 Z" fill="${p.armorDark}"/>
      <path class="part-legs" d="M125 190 L130 240 L108 240 L104 195 Z" fill="${p.armorDark}"/>
      <g class="part-shield-arm">
        <circle class="part-shield" cx="150" cy="150" r="26" fill="${p.shield}" stroke="${p.shieldRim}" stroke-width="5"/>
        <circle cx="150" cy="150" r="8" fill="${p.shieldRim}"/>
      </g>
      <path class="part-torso" d="M68 110 Q100 95 132 110 L128 175 Q100 190 72 175 Z" fill="${p.armor}"/>
      <path class="part-torso-dark" d="M85 112 L100 108 L115 112 L112 172 L100 178 L88 172 Z" fill="${p.armorDark}"/>
      <g class="part-weapon-arm">
        <rect class="part-bow" x="118" y="128" width="66" height="10" rx="3" fill="${p.accent}"/>
        <rect x="150" y="112" width="8" height="42" rx="3" fill="${p.accent}"/>
        <line class="part-string" x1="150" y1="114" x2="150" y2="152" stroke="#f4ead1" stroke-width="2"/>
        <rect x="170" y="130" width="18" height="6" rx="2" fill="#f4ead1"/>
      </g>
      <circle class="part-head" cx="100" cy="85" r="26" fill="${p.skin}"/>
      <path class="part-hood" d="M72 85 Q70 50 100 46 Q130 50 128 85 Q124 62 100 60 Q76 62 72 85 Z" fill="${p.cloak}"/>
      <circle class="part-eye" cx="92" cy="86" r="3" fill="#1a1a1a"/>
      <circle class="part-eye" cx="108" cy="86" r="3" fill="#1a1a1a"/>
    </g>
  </svg>`;
}
