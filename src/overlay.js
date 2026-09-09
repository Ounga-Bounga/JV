import * as THREE from "three";

const _v = new THREE.Vector3();

function project(worldPos, camera, width, height) {
  _v.set(worldPos.x, worldPos.y, worldPos.z);
  _v.project(camera);
  return {
    x: (_v.x * 0.5 + 0.5) * width,
    y: (1 - (_v.y * 0.5 + 0.5)) * height,
    behind: _v.z > 1 || _v.z < -1,
  };
}

/**
 * DOM overlay for floating per-unit health bars and damage numbers, kept
 * separate from the three.js scene since sprites for tiny 2D UI elements
 * are more fiddly than plain positioned <div>s.
 */
export function createBattleOverlay(uiRoot) {
  const barsLayer = document.createElement("div");
  barsLayer.id = "hpbars";
  uiRoot.appendChild(barsLayer);

  const fxLayer = document.createElement("div");
  fxLayer.id = "fx";
  uiRoot.appendChild(fxLayer);

  const bars = new Map();

  function ensureBar(ragdoll) {
    let entry = bars.get(ragdoll.id);
    if (!entry) {
      const el = document.createElement("div");
      el.className = "hpbar";
      const fill = document.createElement("div");
      fill.className = `hpbar-fill ${ragdoll.team}`;
      el.appendChild(fill);
      barsLayer.appendChild(el);
      entry = { el, fill };
      bars.set(ragdoll.id, entry);
    }
    return entry;
  }

  function removeBar(id) {
    const entry = bars.get(id);
    if (entry) {
      entry.el.remove();
      bars.delete(id);
    }
  }

  function update(ragdolls, camera, width, height) {
    const seen = new Set();
    for (const r of ragdolls) {
      if (!r.alive) continue;
      seen.add(r.id);
      const entry = ensureBar(r);
      const head = r.getHeadPosition();
      const p = project({ x: head.x, y: head.y + 0.34, z: head.z }, camera, width, height);
      if (p.behind || p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60) {
        entry.el.style.display = "none";
        continue;
      }
      entry.el.style.display = "block";
      entry.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      entry.fill.style.width = `${Math.max(0, Math.min(1, r.hp / r.maxHp)) * 100}%`;
    }
    for (const id of Array.from(bars.keys())) {
      if (!seen.has(id)) removeBar(id);
    }
  }

  function spawnDamage(worldPos, amount, knockedOut, camera, width, height) {
    const p = project(worldPos, camera, width, height);
    if (p.behind) return;
    const el = document.createElement("div");
    el.className = knockedOut ? "dmg ko" : "dmg";
    el.textContent = knockedOut ? "K.O." : `-${amount}`;
    el.style.left = `${p.x.toFixed(1)}px`;
    el.style.top = `${p.y.toFixed(1)}px`;
    fxLayer.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("rise")));
    setTimeout(() => el.remove(), 900);
  }

  function clear() {
    for (const entry of bars.values()) entry.el.remove();
    bars.clear();
    fxLayer.replaceChildren();
  }

  return { update, spawnDamage, clear };
}
