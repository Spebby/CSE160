import * as THREE from 'three';
import { isDebugMode } from './debug';

export const NORMAL_YAW_LIMIT   = THREE.MathUtils.degToRad(15);
export const NORMAL_PITCH_LIMIT = THREE.MathUtils.degToRad(15);

// I considered using ThreeJS' FirstPersonControls, but the clamping behaviour I wanted
// isn't supported by it out of the box & I didn't want the move controls it comes
// bundled with. So custom implementation made sense.
export class FirstPersonCamera {
    private yaw   = 0;
    private pitch = 0;
    private readonly baseYaw:   number;
    private readonly basePitch: number;

    private readonly defaultPosition: THREE.Vector3;
    private readonly defaultYaw:      number;
    private readonly defaultPitch:    number;

    private readonly normalSensitivity = 0.005;
    private readonly debugSensitivity  = 0.002;
    private readonly moveSpeed         = 8.0;

    private readonly keys = new Set<string>();

    constructor(
        private readonly cam: THREE.Camera,
        private readonly canvas: HTMLCanvasElement,
    ) {
        const euler    = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        this.baseYaw   = euler.y;
        this.basePitch = euler.x;

        // Save defaults for reset
        this.defaultPosition = cam.position.clone();
        this.defaultYaw      = euler.y;
        this.defaultPitch    = euler.x;

        window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup',   (e) => this.keys.delete(e.key.toLowerCase()));
    }

    private applyToCamera(): void {
        const yawQ   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.baseYaw   + this.yaw);
        const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.basePitch + this.pitch);
        this.cam.quaternion.copy(yawQ).multiply(pitchQ);
    }

    update(dt: number): void {
        if (!isDebugMode()) return;

        const move = new THREE.Vector3();
        if (this.keys.has('w')) move.z -= 1;
        if (this.keys.has('s')) move.z += 1;
        if (this.keys.has('a')) move.x -= 1;
        if (this.keys.has('d')) move.x += 1;
        if (this.keys.has('q')) move.y -= 1;
        if (this.keys.has('e')) move.y += 1;

        if (move.lengthSq() > 0) {
            move.normalize().multiplyScalar(this.moveSpeed * dt);
            move.applyQuaternion(this.cam.quaternion);
            this.cam.position.add(move);
        }
    }

    resetToDefault(): void {
        this.cam.position.copy(this.defaultPosition);
        this.yaw   = this.defaultYaw   - this.baseYaw;
        this.pitch = this.defaultPitch - this.basePitch;
        this.applyToCamera();
    }

    onMouseMove(e: MouseEvent): void {
        if (isDebugMode()) {
            this.yaw   -= e.movementX * this.debugSensitivity;
            this.pitch -= e.movementY * this.debugSensitivity;
        } else {
			this.cam.position.copy(this.defaultPosition);
            const rect    = this.canvas.getBoundingClientRect();
            const w       = rect.width  || window.innerWidth;
            const h       = rect.height || window.innerHeight;
            const offsetX = (e.clientX - rect.left) - w / 2;
            const offsetY = (e.clientY - rect.top)  - h / 2;
            this.yaw   = -(offsetX / (w / 2)) * NORMAL_YAW_LIMIT;
            this.pitch = -(offsetY / (h / 2)) * NORMAL_PITCH_LIMIT;
            this.clampToNormalLimits();
        }
        this.applyToCamera();
    }

    clampToNormalLimits(): void {
        this.yaw   = THREE.MathUtils.clamp(this.yaw,   -NORMAL_YAW_LIMIT,   NORMAL_YAW_LIMIT);
        this.pitch = THREE.MathUtils.clamp(this.pitch, -NORMAL_PITCH_LIMIT, NORMAL_PITCH_LIMIT);
        this.applyToCamera();
    }
}
