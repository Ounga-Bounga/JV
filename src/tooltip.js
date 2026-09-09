// Petit moteur de tooltip generique : un element avec la classe
// `.has-tooltip` et une fonction `getTooltip` attachee (via WeakMap) affiche
// un panneau flottant "parchemin" au survol, positionne pres du curseur et
// garde a l'interieur de l'ecran.

const tooltipContent = new WeakMap();
let tooltipEl;
let activeTarget = null;

export function initTooltips() {
  tooltipEl = document.getElementById('tooltip');

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.has-tooltip');
    if (!target || target === activeTarget) return;
    show(target, e);
  });

  document.addEventListener('mousemove', (e) => {
    if (activeTarget && tooltipEl && !tooltipEl.classList.contains('hidden')) {
      position(e.clientX, e.clientY);
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('.has-tooltip');
    if (target && target === activeTarget && !target.contains(e.relatedTarget)) {
      hide();
    }
  });

  document.addEventListener('scroll', hide, true);
}

export function setTooltip(el, getContent) {
  el.classList.add('has-tooltip');
  tooltipContent.set(el, getContent);
}

function show(target, e) {
  const getContent = tooltipContent.get(target);
  if (!getContent) return;
  activeTarget = target;
  const { title, body } = getContent();
  tooltipEl.innerHTML = `<div class="tooltip-title">${title}</div><div class="tooltip-body">${body}</div>`;
  tooltipEl.classList.remove('hidden');
  position(e.clientX, e.clientY);
}

function position(x, y) {
  const margin = 16;
  const rect = tooltipEl.getBoundingClientRect();
  let left = x + margin;
  let top = y + margin;
  if (left + rect.width > window.innerWidth - 8) left = x - rect.width - margin;
  if (top + rect.height > window.innerHeight - 8) top = y - rect.height - margin;
  tooltipEl.style.left = `${Math.max(8, left)}px`;
  tooltipEl.style.top = `${Math.max(8, top)}px`;
}

export function hide() {
  activeTarget = null;
  if (tooltipEl) tooltipEl.classList.add('hidden');
}

export function refreshIfActive(target) {
  if (activeTarget === target) {
    const getContent = tooltipContent.get(target);
    if (!getContent) return;
    const { title, body } = getContent();
    tooltipEl.innerHTML = `<div class="tooltip-title">${title}</div><div class="tooltip-body">${body}</div>`;
  }
}
