import * as THREE from "three";

const KEY_MAP = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "up",
  ControlLeft: "down",
  KeyC: "down",
  ShiftLeft: "boost",
  ShiftRight: "boost",
};

/**
 * A TABS-style free-fly camera: click the canvas to lock the pointer, look
 * around with the mouse, move with WASD/arrows, Space/Ctrl for up/down,
 * Shift to go faster, and the scroll wheel to tune the base speed.
 */
export class FreeCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.yaw = 0;
    this.pitch = -0.25;
    this.baseSpeed = 8;
    this.keys = {};
    this.locked = false;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = (e) => {
      const action = KEY_MAP[e.code];
      if (action) this.keys[action] = true;
    };
    this._onKeyUp = (e) => {
      const action = KEY_MAP[e.code];
      if (action) this.keys[action] = false;
    };
    this._onWheel = (e) => {
      this.baseSpeed = THREE.MathUtils.clamp(this.baseSpeed * (1 - Math.sign(e.deltaY) * 0.1), 1, 60);
    };
    this._onClick = () => {
      if (document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.domElement;
    };

    domElement.addEventListener("click", this._onClick);
    document.addEventListener("pointerlockchange", this._onLockChange);
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    domElement.addEventListener("wheel", this._onWheel, { passive: true });
  }

  _onMouseMove(e) {
    if (!this.locked) return;
    const sensitivity = 0.0022;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  }

  setStartPose(position, yaw, pitch) {
    this.camera.position.copy(position);
    this.yaw = yaw;
    this.pitch = pitch;
  }

  update(dt) {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

    const speed = this.baseSpeed * (this.keys.boost ? 2.6 : 1);
    const move = new THREE.Vector3();
    if (this.keys.forward) move.add(forward);
    if (this.keys.backward) move.sub(forward);
    if (this.keys.right) move.add(right);
    if (this.keys.left) move.sub(right);
    if (this.keys.up) move.y += 1;
    if (this.keys.down) move.y -= 1;

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.camera.position.add(move);
    }

    if (this.camera.position.y < 0.3) this.camera.position.y = 0.3;
  }
}
