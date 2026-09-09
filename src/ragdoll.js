import * as CANNON from "cannon-es";
import * as THREE from "three";

// Bone dimensions (half-extents in meters for boxes, radius for the head sphere).
// These describe the PHYSICS shapes; visual meshes are capsules sized to match.
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
  body.angularDamping = 0.85;
  body.allowSleep = false;
  return body;
}

function makeMesh(geometry, color, castShadow = true) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

// Visual meshes are capsules/spheres sized to roughly match the physics
// box/sphere shapes: radius covers the x/z footprint, the cylindrical part
// fills whatever height is left.
function visualGeometry(isSphere, dim) {
  if (isSphere) return new THREE.SphereGeometry(dim.radius, 20, 16);
  const radius = (dim.half[0] + dim.half[2]) / 2;
  const length = Math.max(0.03, dim.half[1] * 2 - radius * 2);
  return new THREE.CapsuleGeometry(radius, length, 6, 12);
}

/**
 * Builds a ragdoll humanoid: rigid bodies connected by ball-and-socket joints
 * (CANNON.PointToPointConstraint). AI/locomotion drives a subset of joints
 * with PD torque control (see ai.js); the rest stay purely physical.
 */
export function createRagdoll(world, ragdollMaterial, scene, { x, z, team, color, skin = 0xe8b48c, id }) {
  const bodies = {};
  const meshes = {};
  const baseColors = {};
  const constraints = [];

  const spawn = (name, dim, pos, isSphere = false) => {
    const shape = isSphere ? new CANNON.Sphere(dim.radius) : box(dim.half);
    const body = makeBody(dim.mass, shape, pos, ragdollMaterial);
    world.addBody(body);
    bodies[name] = body;
    body.prevPosition = body.position.clone();
    body.prevQuaternion = new CANNON.Quaternion().copy(body.quaternion);

    const meshColor = name === "head" ? skin : color;
    const mesh = makeMesh(visualGeometry(isSphere, dim), meshColor);
    scene.add(mesh);
    meshes[name] = mesh;
    baseColors[name] = meshColor;
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

  const _tmpColor = new THREE.Color();
  const flashColor = new THREE.Color(0xffffff);
  const _prevQ = new THREE.Quaternion();
  const _curQ = new THREE.Quaternion();

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
    facingYaw: new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), team === "blue" ? Math.PI : 0),
    flashTimer: 0,

    savePrevTransform() {
      for (const name in bodies) {
        const b = bodies[name];
        b.prevPosition.copy(b.position);
        b.prevQuaternion.copy(b.quaternion);
      }
    },

    syncMeshes(alpha, frameDt = 1 / 60) {
      for (const name in bodies) {
        const b = bodies[name];
        const m = meshes[name];
        m.position.set(
          b.prevPosition.x + (b.position.x - b.prevPosition.x) * alpha,
          b.prevPosition.y + (b.position.y - b.prevPosition.y) * alpha,
          b.prevPosition.z + (b.position.z - b.prevPosition.z) * alpha,
        );
        _prevQ.set(b.prevQuaternion.x, b.prevQuaternion.y, b.prevQuaternion.z, b.prevQuaternion.w);
        _curQ.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        m.quaternion.slerpQuaternions(_prevQ, _curQ, alpha);
      }

      if (this.flashTimer > 0) {
        this.flashTimer -= frameDt;
        const t = Math.max(0, this.flashTimer / 0.18);
        for (const name of ["torso", "upperArmL", "upperArmR", "head"]) {
          _tmpColor.set(baseColors[name]).lerp(flashColor, t * 0.85);
          meshes[name].material.color.copy(_tmpColor);
        }
      }
    },

    flashHit() {
      this.flashTimer = 0.18;
    },

    getPosition() {
      return bodies.pelvis.position;
    },

    getHeadPosition() {
      return bodies.head.position;
    },

    dispose() {
      for (const c of constraints) world.removeConstraint(c);
      for (const name in bodies) world.removeBody(bodies[name]);
      for (const name in meshes) {
        meshes[name].geometry.dispose();
        meshes[name].material.dispose();
        scene.remove(meshes[name]);
      }
    },
  };

  return ragdoll;
}
