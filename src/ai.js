import * as CANNON from "cannon-es";
import * as THREE from "three";

const ATTACK_RANGE = 1.0;
const ATTACK_DURATION = 0.4;
const ATTACK_COOLDOWN = 0.55;
const HIT_RADIUS = 0.55;
const APPROACH_SPEED_TORQUE = 420;
const MAX_WALK_SPEED = 4;
const WALK_CYCLE_SPEED = 5.4;
const LEG_SWING_AMP = 0.46;
const KNEE_BEND_AMP = 0.75;
const ARM_SWING_AMP = 0.42;
const PUNCH_SHOULDER_AMP = 2.1;
const PUNCH_ELBOW_AMP = 1.4;
const SEPARATION_RADIUS = 0.85;
const SEPARATION_FORCE = 10;
const TURN_RATE = 5.5; // rad/s, caps how fast a unit can re-face a new direction
const MAX_CORRECTION_ANGLE = 1.4; // rad, caps single-tick PD torque spikes
const MAX_ANGULAR_VELOCITY = 9; // rad/s, hard cap on controlled bones to stop wild spin jitter

// ---- scratch objects reused every tick to avoid garbage collection churn ----
const _fwd = new THREE.Vector3();
const _eye = new THREE.Vector3(0, 0, 0);
const _target = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _m4 = new THREE.Matrix4();
const _tq = new THREE.Quaternion();
const _rawYaw = new CANNON.Quaternion();
const _yaw = new CANNON.Quaternion();
const _pitch = new CANNON.Quaternion();
const _limbTarget = new CANNON.Quaternion();
const _currentInv = new CANNON.Quaternion();
const _err = new CANNON.Quaternion();
const _axisX = new CANNON.Vec3(1, 0, 0);
const _torque = new CANNON.Vec3();
const _diff = new CANNON.Vec3();

function yawQuatTowards(dx, dz, out) {
  if (dx * dx + dz * dz < 1e-6) {
    out.set(0, 0, 0, 1);
    return out;
  }
  _fwd.set(dx, 0, dz).normalize();
  _target.copy(_fwd);
  _m4.lookAt(_eye, _target, _up);
  _tq.setFromRotationMatrix(_m4);
  out.set(_tq.x, _tq.y, _tq.z, _tq.w);
  return out;
}

/** Smoothly rotates `unit.facingYaw` toward the raw desired yaw, at most TURN_RATE rad/s. */
function updateFacing(unit, dx, dz, dt, out) {
  yawQuatTowards(dx, dz, _rawYaw);
  const cur = unit.facingYaw;
  cur.conjugate(_currentInv);
  _rawYaw.mult(_currentInv, _err);
  if (_err.w < 0) {
    _err.x = -_err.x;
    _err.y = -_err.y;
    _err.z = -_err.z;
    _err.w = -_err.w;
  }
  const w = Math.min(1, Math.max(-1, _err.w));
  const angle = 2 * Math.acos(w);
  const maxStep = TURN_RATE * dt;
  if (angle > maxStep && angle > 1e-4) {
    const t = maxStep / angle;
    _pitch.x = _err.x * t;
    _pitch.y = _err.y * t;
    _pitch.z = _err.z * t;
    _pitch.w = 1 - t + t * _err.w;
    _pitch.normalize();
    _pitch.mult(cur, out);
  } else {
    out.set(_rawYaw.x, _rawYaw.y, _rawYaw.z, _rawYaw.w);
  }
  unit.facingYaw.set(out.x, out.y, out.z, out.w);
  return out;
}

/** PD controller driving `body` toward `targetQuat` (world space). */
function applyPD(body, targetQuat, kp, kd, maxTorque) {
  body.quaternion.conjugate(_currentInv);
  targetQuat.mult(_currentInv, _err);
  if (_err.w < 0) {
    _err.x = -_err.x;
    _err.y = -_err.y;
    _err.z = -_err.z;
    _err.w = -_err.w;
  }
  const w = Math.min(1, Math.max(-1, _err.w));
  let angle = 2 * Math.acos(w);
  const s = Math.sqrt(1 - w * w);
  let ax = 0,
    ay = 0,
    az = 0;
  if (s > 1e-6) {
    ax = _err.x / s;
    ay = _err.y / s;
    az = _err.z / s;
  }
  if (angle > MAX_CORRECTION_ANGLE) angle = MAX_CORRECTION_ANGLE;
  _torque.set(
    ax * angle * kp - body.angularVelocity.x * kd,
    ay * angle * kp - body.angularVelocity.y * kd,
    az * angle * kp - body.angularVelocity.z * kd,
  );
  const mag = _torque.length();
  if (mag > maxTorque) _torque.scale(maxTorque / mag, _torque);
  body.torque.x += _torque.x;
  body.torque.y += _torque.y;
  body.torque.z += _torque.z;

  // Hard-limit residual spin from collisions/impacts so controlled bones never whip around.
  const av = body.angularVelocity;
  const avMag = av.length();
  if (avMag > MAX_ANGULAR_VELOCITY) av.scale(MAX_ANGULAR_VELOCITY / avMag, av);
}

function limbQuat(yawQuat, theta, out) {
  _pitch.setFromAxisAngle(_axisX, theta);
  yawQuat.mult(_pitch, out);
  return out;
}

function pickTarget(unit, all) {
  let best = null;
  let bestDist = Infinity;
  const p = unit.getPosition();
  for (const other of all) {
    if (other === unit || other.team === unit.team || !other.alive) continue;
    const op = other.getPosition();
    const dx = op.x - p.x;
    const dz = op.z - p.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}

function triggerAttack(unit) {
  unit.state = "attack";
  unit.attackTimer = 0;
  unit.hitLanded = false;
  unit.attackSide = Math.random() < 0.5 ? 1 : -1;
}

function resolveHit(attacker, defender, onHit) {
  const damage = 12 + Math.random() * 16;
  defender.hp -= damage;
  const ap = attacker.getPosition();
  const dp = defender.getPosition();
  _diff.set(dp.x - ap.x, 0.4, dp.z - ap.z);
  if (_diff.length() < 1e-4) _diff.set(0, 0.4, 1);
  _diff.normalize();
  const power = 3.2 + Math.random() * 1.6;
  defender.bodies.torso.applyImpulse(new CANNON.Vec3(_diff.x * power, power * 0.6, _diff.z * power));
  defender.bodies.head.applyImpulse(new CANNON.Vec3(_diff.x * power * 0.5, power * 0.3, _diff.z * power * 0.5));
  defender.flashHit();

  let knockedOut = false;
  if (defender.hp <= 0) {
    defender.hp = 0;
    defender.alive = false;
    defender.downed = true;
    defender.state = "down";
    knockedOut = true;
  }

  if (onHit) {
    const hp = defender.getHeadPosition();
    onHit({ x: hp.x, y: hp.y, z: hp.z, amount: Math.round(damage), team: defender.team, knockedOut });
  }
}

export function updateAI(ragdolls, dt, onHit) {
  // --- gentle separation between overlapping teammates so crowds don't pile up ---
  // (enemies are deliberately left free to close the distance and clash)
  for (let i = 0; i < ragdolls.length; i++) {
    const a = ragdolls[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < ragdolls.length; j++) {
      const b = ragdolls[j];
      if (!b.alive || b.team !== a.team) continue;
      const pa = a.getPosition();
      const pb = b.getPosition();
      const dx = pb.x - pa.x;
      const dz = pb.z - pa.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.001 && dist < SEPARATION_RADIUS) {
        const push = ((SEPARATION_RADIUS - dist) / SEPARATION_RADIUS) * SEPARATION_FORCE;
        const nx = (dx / dist) * push;
        const nz = (dz / dist) * push;
        a.bodies.pelvis.force.x -= nx;
        a.bodies.pelvis.force.z -= nz;
        b.bodies.pelvis.force.x += nx;
        b.bodies.pelvis.force.z += nz;
      }
    }
  }

  for (const unit of ragdolls) {
    if (!unit.alive) continue;

    unit.target = unit.target && unit.target.alive ? unit.target : pickTarget(unit, ragdolls);
    const target = unit.target;

    const p = unit.getPosition();
    let dx = 0,
      dz = 1;
    let dist = Infinity;
    if (target) {
      const tp = target.getPosition();
      dx = tp.x - p.x;
      dz = tp.z - p.z;
      dist = Math.sqrt(dx * dx + dz * dz);
    }

    if (unit.attackCooldown > 0) unit.attackCooldown -= dt;

    if (target) {
      if (unit.state === "attack") {
        unit.attackTimer += dt;
        const progress = unit.attackTimer / ATTACK_DURATION;
        if (!unit.hitLanded && progress > 0.3 && progress < 0.8) {
          const tag = unit.attackSide === 1 ? "R" : "L";
          const hand = unit.bodies[`lowerArm${tag}`].position;
          const dpx = target.bodies.torso.position.x - hand.x;
          const dpy = target.bodies.torso.position.y - hand.y;
          const dpz = target.bodies.torso.position.z - hand.z;
          if (dpx * dpx + dpy * dpy + dpz * dpz < HIT_RADIUS * HIT_RADIUS) {
            resolveHit(unit, target, onHit);
            unit.hitLanded = true;
          }
        }
        if (progress >= 1) {
          unit.state = dist <= ATTACK_RANGE ? "idle" : "approach";
          unit.attackCooldown = ATTACK_COOLDOWN;
        }
      } else if (dist <= ATTACK_RANGE) {
        unit.state = unit.attackCooldown <= 0 ? "attack" : "idle";
        if (unit.state === "attack") triggerAttack(unit);
      } else {
        unit.state = "approach";
      }
    } else {
      unit.state = "idle";
    }

    updateFacing(unit, dx, dz, dt, _yaw);

    // Torso + pelvis: balance and face the target/movement direction.
    applyPD(unit.bodies.pelvis, _yaw, 175, 24, 260);
    applyPD(unit.bodies.torso, _yaw, 105, 17, 170);
    applyPD(unit.bodies.head, _yaw, 20, 7, 34);

    if (unit.state === "approach" || (unit.state === "idle" && dist > 0.7)) {
      unit.walkPhase += dt * WALK_CYCLE_SPEED;
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      const vel = unit.bodies.pelvis.velocity;
      const forwardSpeed = vel.x * nx + vel.z * nz;
      if (forwardSpeed < MAX_WALK_SPEED) {
        const scale = unit.state === "approach" ? 1 : 0.45;
        const pushForce = Math.min(dist, 1) * APPROACH_SPEED_TORQUE * scale;
        unit.bodies.pelvis.force.x += nx * pushForce;
        unit.bodies.pelvis.force.z += nz * pushForce;
      }
    }

    const phase = unit.walkPhase;
    const legAmp = unit.state === "approach" ? LEG_SWING_AMP : 0;
    for (const side of [1, -1]) {
      const tag = side === 1 ? "R" : "L";
      const sidePhase = side === 1 ? phase : phase + Math.PI;
      const hipTheta = legAmp * Math.sin(sidePhase);
      const kneeTheta = legAmp > 0 ? KNEE_BEND_AMP * Math.max(0, Math.sin(sidePhase)) : 0.15;

      limbQuat(_yaw, hipTheta, _limbTarget);
      applyPD(unit.bodies[`upperLeg${tag}`], _limbTarget, 120, 15, 210);

      limbQuat(_yaw, hipTheta * 0.4 + kneeTheta, _limbTarget);
      applyPD(unit.bodies[`lowerLeg${tag}`], _limbTarget, 95, 13, 170);

      let armTheta = -ARM_SWING_AMP * Math.sin(sidePhase);
      let elbowTheta = 0.3;

      if (unit.state === "attack" && unit.attackSide === side) {
        const progress = Math.min(1, unit.attackTimer / ATTACK_DURATION);
        const swing = Math.sin(progress * Math.PI);
        armTheta = -0.6 + PUNCH_SHOULDER_AMP * swing;
        elbowTheta = 0.2 + PUNCH_ELBOW_AMP * swing;
      }

      limbQuat(_yaw, armTheta, _limbTarget);
      applyPD(unit.bodies[`upperArm${tag}`], _limbTarget, 72, 11, 135);
      limbQuat(_yaw, armTheta * 0.5 + elbowTheta, _limbTarget);
      applyPD(unit.bodies[`lowerArm${tag}`], _limbTarget, 56, 9, 105);
    }
  }
}
