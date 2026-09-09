import * as THREE from "three";
import { createPhysicsWorld, createScene } from "./world.js";
import { createRagdoll } from "./ragdoll.js";
import { updateAI } from "./ai.js";
import { FreeCamera } from "./freeCamera.js";
import { createBattleOverlay } from "./overlay.js";

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
const freeCamera = new FreeCamera(camera, canvas);
freeCamera.setStartPose(new THREE.Vector3(0, 6, 22), 0, -0.18);

const scene = createScene();
const { world, ragdollMaterial } = createPhysicsWorld();
const overlay = createBattleOverlay(document.getElementById("ui"));

let viewportW = window.innerWidth;
let viewportH = window.innerHeight;

function resize() {
  viewportW = window.innerWidth;
  viewportH = window.innerHeight;
  renderer.setSize(viewportW, viewportH);
  camera.aspect = viewportW / viewportH;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const TEAM = {
  blue: { color: 0x3fa7ff, baseZ: -8 },
  red: { color: 0xff5b5b, baseZ: 8 },
};

let ragdolls = [];
let battleActive = false;
let nextId = 0;
let winnerDeclared = false;

function spawnFormation(team, count) {
  const cfg = TEAM[team];
  const cols = Math.min(count, 8);
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cellsInRow = Math.min(cols, count - row * cols);
    const x = (col - (cellsInRow - 1) / 2) * 1.3 + (Math.random() - 0.5) * 0.15;
    const rowOffset = row * 1.3 * (team === "blue" ? -1 : 1);
    const z = cfg.baseZ + rowOffset + (Math.random() - 0.5) * 0.15;

    const ragdoll = createRagdoll(world, ragdollMaterial, scene, {
      x,
      z,
      team,
      color: cfg.color,
      id: nextId++,
    });
    ragdolls.push(ragdoll);
  }
}

function clearBattle() {
  for (const r of ragdolls) r.dispose();
  ragdolls = [];
  battleActive = false;
  winnerDeclared = false;
  banner.classList.remove("show");
  banner.textContent = "";
  overlay.clear();
}

function startBattle() {
  clearBattle();
  const countBlue = Math.max(1, Math.min(16, parseInt(countBlueInput.value, 10) || 1));
  const countRed = Math.max(1, Math.min(16, parseInt(countRedInput.value, 10) || 1));
  spawnFormation("blue", countBlue);
  spawnFormation("red", countRed);
  battleActive = true;
}

function onHit(hit) {
  overlay.spawnDamage(hit, hit.amount, hit.knockedOut, camera, viewportW, viewportH);
}

const countBlueInput = document.getElementById("countBlue");
const countRedInput = document.getElementById("countRed");
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const timeScaleInput = document.getElementById("timeScale");
const scoreBlueEl = document.getElementById("scoreBlue");
const scoreRedEl = document.getElementById("scoreRed");
const hpBlueEl = document.getElementById("hpBlue");
const hpRedEl = document.getElementById("hpRed");
const banner = document.getElementById("banner");
const helpToggle = document.getElementById("helpToggle");
const helpBody = document.getElementById("helpBody");

btnStart.addEventListener("click", startBattle);
btnReset.addEventListener("click", clearBattle);
helpToggle.addEventListener("click", () => helpBody.classList.toggle("show"));

startBattle();

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
let accumulator = 0;
let lastTime = performance.now();

function updateHud() {
  let aliveBlue = 0,
    aliveRed = 0,
    hpBlue = 0,
    maxHpBlue = 0,
    hpRed = 0,
    maxHpRed = 0;

  for (const r of ragdolls) {
    if (r.team === "blue") {
      if (r.alive) aliveBlue++;
      hpBlue += r.hp;
      maxHpBlue += r.maxHp;
    } else {
      if (r.alive) aliveRed++;
      hpRed += r.hp;
      maxHpRed += r.maxHp;
    }
  }

  scoreBlueEl.textContent = aliveBlue;
  scoreRedEl.textContent = aliveRed;
  hpBlueEl.style.width = `${maxHpBlue ? (hpBlue / maxHpBlue) * 100 : 0}%`;
  hpRedEl.style.width = `${maxHpRed ? (hpRed / maxHpRed) * 100 : 0}%`;

  if (battleActive && !winnerDeclared && ragdolls.length > 0) {
    const blueDone = aliveBlue === 0;
    const redDone = aliveRed === 0;
    if (blueDone || redDone) {
      winnerDeclared = true;
      if (blueDone && redDone) {
        banner.textContent = "Match nul !";
        banner.style.color = "#f0f6fc";
      } else if (redDone) {
        banner.textContent = "Victoire Bleue !";
        banner.style.color = "#58a6ff";
      } else {
        banner.textContent = "Victoire Rouge !";
        banner.style.color = "#ff7b72";
      }
      banner.classList.add("show");
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let frameDt = (now - lastTime) / 1000;
  lastTime = now;
  frameDt = Math.min(frameDt, 0.1);

  const timeScale = parseInt(timeScaleInput.value, 10) / 100; // 0 .. 2
  accumulator += frameDt * timeScale;

  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    for (const r of ragdolls) r.savePrevTransform();
    updateAI(ragdolls, FIXED_DT, onHit);
    world.step(FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;

  const alpha = Math.min(1, accumulator / FIXED_DT);
  for (const r of ragdolls) r.syncMeshes(alpha, frameDt);

  freeCamera.update(frameDt);
  updateHud();
  overlay.update(ragdolls, camera, viewportW, viewportH);

  renderer.render(scene, camera);
}

animate();
