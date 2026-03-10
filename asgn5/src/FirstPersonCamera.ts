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

  private readonly normalSensitivity = 0.005;
  private readonly debugSensitivity  = 0.002;

  constructor(
    private readonly cam: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
  ) {}

  onMouseMove(e: MouseEvent): void {
    if (isDebugMode()) {
      this.yaw   -= e.movementX * this.debugSensitivity;
      this.pitch -= e.movementY * this.debugSensitivity;
    } else {
      const rect    = this.canvas.getBoundingClientRect();
      const offsetX = (e.clientX - rect.left)  - rect.width  / 2;
      const offsetY = (e.clientY - rect.top)   - rect.height / 2;

      this.yaw   = -(offsetX / (rect.width  / 2)) * NORMAL_YAW_LIMIT;
      this.pitch = -(offsetY / (rect.height / 2)) * NORMAL_PITCH_LIMIT;
      this.clampToNormalLimits();
    }

    this.applyToCamera();
  }

  clampToNormalLimits(): void {
    this.yaw   = THREE.MathUtils.clamp(this.yaw,   -NORMAL_YAW_LIMIT,   NORMAL_YAW_LIMIT);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -NORMAL_PITCH_LIMIT, NORMAL_PITCH_LIMIT);
    this.applyToCamera();
  }

  private applyToCamera(): void {
    this.cam.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    );
  }
}
