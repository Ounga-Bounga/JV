import * as CANNON from "cannon-es";
import * as THREE from "three";

const GROUND_SIZE = 90;
const ARENA_RADIUS = 22;

export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 24;
  world.allowSleep = false;

  const groundMaterial = new CANNON.Material("ground");
  const ragdollMaterial = new CANNON.Material("ragdoll");

  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: groundMaterial,
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  world.addContactMaterial(
    new CANNON.ContactMaterial(groundMaterial, ragdollMaterial, {
      friction: 0.45,
      restitution: 0.05,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(ragdollMaterial, ragdollMaterial, {
      friction: 0.3,
      restitution: 0.05,
    }),
  );

  return { world, groundMaterial, ragdollMaterial };
}

function makeSky() {
  const geo = new THREE.SphereGeometry(180, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x6fa9d8) },
      bottomColor: { value: new THREE.Color(0xdcf0f5) },
      offset: { value: 12 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

function makeArenaGroundTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#7dbb5f");
  grad.addColorStop(0.65, "#5fa249");
  grad.addColorStop(1, "#417a34");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 2;
  for (let r = size * 0.12; r < size * 0.5; r += size * 0.12) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9cfe6);
  scene.fog = new THREE.Fog(0xbfe0ee, 34, 85);
  scene.add(makeSky());

  const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x3c5a35, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3da, 2.1);
  sun.position.set(16, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // Wide backdrop ground beyond the arena, kept dim so it fades into the fog.
  const farGroundGeo = new THREE.CircleGeometry(GROUND_SIZE, 48);
  const farGroundMat = new THREE.MeshStandardMaterial({ color: 0x6f9660, roughness: 1 });
  const farGround = new THREE.Mesh(farGroundGeo, farGroundMat);
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = -0.03;
  farGround.receiveShadow = true;
  scene.add(farGround);

  // The actual arena floor, with a soft radial-gradient texture for depth.
  const arenaGeo = new THREE.CircleGeometry(ARENA_RADIUS, 64);
  const arenaMat = new THREE.MeshStandardMaterial({ map: makeArenaGroundTexture(), roughness: 0.95 });
  const arenaMesh = new THREE.Mesh(arenaGeo, arenaMat);
  arenaMesh.rotation.x = -Math.PI / 2;
  arenaMesh.receiveShadow = true;
  scene.add(arenaMesh);

  // A raised sandy border ring marks the fighting pit boundary.
  const ringGeo = new THREE.TorusGeometry(ARENA_RADIUS, 0.32, 10, 64);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xcdb17f, roughness: 0.85 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  ring.receiveShadow = true;
  ring.castShadow = true;
  scene.add(ring);

  return scene;
}

export { GROUND_SIZE, ARENA_RADIUS };
