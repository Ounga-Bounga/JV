import './style.css';
import { initTooltips } from './tooltip.js';
import { initMenuScreen } from './menu.js';
import { initDuelScreen, startDuel } from './duel.js';

const screens = {
  menu: document.getElementById('screen-menu'),
  combat: document.getElementById('screen-combat'),
  end: document.getElementById('screen-end'),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

const END_TEXT = {
  victory: { title: 'Victoire !', subtitle: 'Le gardien de la crypte tombe. Vous quittez l\'arène en vainqueur.' },
  defeat: { title: 'Défaite…', subtitle: 'Vos jambes cèdent. Le donjon garde son secret un peu plus longtemps.' },
  draw: { title: 'Double mise à mort', subtitle: 'Vos carreaux se croisent au même instant. Personne ne sort vainqueur.' },
};

initTooltips();

initMenuScreen({
  onStart: () => {
    showScreen('combat');
    startDuel();
  },
});

initDuelScreen({
  onEnd: ({ result }) => {
    const text = END_TEXT[result];
    document.getElementById('endTitle').textContent = text.title;
    document.getElementById('endSubtitle').textContent = text.subtitle;
    showScreen('end');
  },
});

document.getElementById('btnReplay').addEventListener('click', () => {
  showScreen('combat');
  startDuel();
});
