import * as CANNON from "cannon-es";
import * as THREE from "three";

// Bone dimensions (half-extents in meters for boxes, radius for the head sphere).
const DIM = {
  pelvis: { half: [0.17, 0.1, 0.11], mass: 8 },
  torso: { half: [0.19, 0.23, 0.12], mass: 14 },
  head: { radius: 0.13, mass: 4 },
  upperArm: { half: [0.065, 0.15, 0.065], mass: 2.2 },
  lowerArm: { half: [0.055, 0.13, 0.055], mass: 1.6 },
  upperLeg: { half: [0.095, 0.2, 0.095], mass: 6 },
  lowerLeg: { half: [0.075, 0.2, 0.075], mass: 4.5 },
};

// Resting world-space heights (y) for the center of each bone, feet on the ground (y=0).
const Y = {
  lowerLeg: 0.2,
  upperLeg: 0.6,
  pelvis: 0.9,
  torso: 1.23,
  head: 1.59,
  shoulder: 1.4,
  upperArmCenter: 1.25,
  lowerArmCenter: 0.97,
};

const ARM_X = 0.26;
const HIP_X = 0.11;

function box(half) {
  return new CANNON.Box(new CANNON.Vec3(half[0], half[1], half[2]));
}

function makeBody(mass, shape, position, material) {
  const body = new CANNON.Body({ mass, shape, material });
  body.position.set(position.x, position.y, position.z);
  body.linearDamping = 0.05;
  body.angularDamping = 0.7;
  body.allowSleep = false;
  return body;
}

function makeMesh(geometry, color, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function boxGeo(half) {
  return new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
}

/**
 * Builds a ragdoll humanoid: rigid bodies connected by ball-and-socket joints
 * (CANNON.PointToPointConstraint). AI/locomotion drives a subset of joints
 * with PD torque control (see ai.js); the rest stay purely physical.
 */
export function createRagdoll(world, ragdollMaterial, scene, { x, z, team, color, skin = 0xe8b48c, id }) {
  const bodies = {};
  const meshes = {};
  const constraints = [];

  const spawn = (name, dim, pos, isSphere = false) => {
    const shape = isSphere ? new CANNON.Sphere(dim.radius) : box(dim.half);
    const body = makeBody(dim.mass, shape, pos, ragdollMaterial);
    world.addBody(body);
    bodies[name] = body;

    const geo = isSphere ? new THREE.SphereGeometry(dim.radius, 16, 12) : boxGeo(dim.half);
    const meshColor = name === "head" ? skin : color;
    const mesh = makeMesh(geo, meshColor);
    scene.add(mesh);
    meshes[name] = mesh;
    return body;
  };

  spawn("pelvis", DIM.pelvis, { x, y: Y.pelvis, z });
  spawn("torso", DIM.torso, { x, y: Y.torso, z });
  spawn("head", DIM.head, { x, y: Y.head, z }, true);

  for (const side of [1, -1]) {
    const tag = side === 1 ? "R" : "L";
    spawn(`upperArm${tag}`, DIM.upperArm, { x: x + side * ARM_X, y: Y.upperArmCenter, z });
    spawn(`lowerArm${tag}`, DIM.lowerArm, { x: x + side * ARM_X, y: Y.lowerArmCenter, z });
    spawn(`upperLeg${tag}`, DIM.upperLeg, { x: x + side * HIP_X, y: Y.upperLeg, z });
    spawn(`lowerLeg${tag}`, DIM.lowerLeg, { x: x + side * HIP_X, y: Y.lowerLeg, z });
  }

  const link = (bodyA, pivotA, bodyB, pivotB, maxForce = 1e6) => {
    const c = new CANNON.PointToPointConstraint(
      bodyA,
      new CANNON.Vec3(...pivotA),
      bodyB,
      new CANNON.Vec3(...pivotB),
      maxForce,
    );
    world.addConstraint(c);
    constraints.push(c);
    return c;
  };

  const joints = {};

  joints.waist = link(bodies.pelvis, [0, DIM.pelvis.half[1], 0], bodies.torso, [0, -DIM.torso.half[1], 0]);
  joints.neck = link(bodies.torso, [0, DIM.torso.half[1], 0], bodies.head, [0, -DIM.head.radius, 0]);

  for (const side of [1, -1]) {
    const tag = side === 1 ? "R" : "L";
    joints[`shoulder${tag}`] = link(
      bodies.torso,
      [side * ARM_X, Y.shoulder - Y.torso, 0],
      bodies[`upperArm${tag}`],
      [0, DIM.upperArm.half[1], 0],
    );
    joints[`elbow${tag}`] = link(
      bodies[`upperArm${tag}`],
      [0, -DIM.upperArm.half[1], 0],
      bodies[`lowerArm${tag}`],
      [0, DIM.lowerArm.half[1], 0],
    );
    joints[`hip${tag}`] = link(
      bodies.pelvis,
      [side * HIP_X, -DIM.pelvis.half[1], 0],
      bodies[`upperLeg${tag}`],
      [0, DIM.upperLeg.half[1], 0],
    );
    joints[`knee${tag}`] = link(
      bodies[`upperLeg${tag}`],
      [0, -DIM.upperLeg.half[1], 0],
      bodies[`lowerLeg${tag}`],
      [0, DIM.lowerLeg.half[1], 0],
    );
  }

  const ragdoll = {
    id,
    team,
    color,
    bodies,
    meshes,
    joints,
    hp: 100,
    maxHp: 100,
    alive: true,
    downed: false,
    state: "idle",
    attackCooldown: 0,
    attackTimer: 0,
    attackSide: 1,
    hitLanded: false,
    target: null,
    walkPhase: Math.random() * Math.PI * 2,
    stumbleTimer: 0,

    syncMeshes() {
      for (const name in bodies) {
        const b = bodies[name];
        const m = meshes[name];
        m.position.copy(b.position);
        m.quaternion.copy(b.quaternion);
      }
    },

    getPosition() {
      return bodies.pelvis.position;
    },

    dispose() {
      for (const c of constraints) world.removeConstraint(c);
      for (const name in bodies) world.removeBody(bodies[name]);
      for (const name in meshes) scene.remove(meshes[name]);
    },
  };

  return ragdoll;
}
