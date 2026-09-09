import * as CANNON from "cannon-es";
import * as THREE from "three";

const GROUND_SIZE = 60;

export function createPhysicsWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 20;
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

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b7d9);
  scene.fog = new THREE.Fog(0x87b7d9, 40, 90);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(15, 25, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 80;
  scene.add(sun);

  const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4c9a4c, roughness: 1 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const grid = new THREE.GridHelper(GROUND_SIZE, 30, 0x2c6e2c, 0x3a7d3a);
  grid.position.y = 0.01;
  scene.add(grid);

  return scene;
}

export { GROUND_SIZE };
