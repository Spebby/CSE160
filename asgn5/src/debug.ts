// temp debug file. intended for grading.

let _debugMode = false;

export function isDebugMode(): boolean {
  return _debugMode;
}

export function setDebugMode(enabled: boolean, canvas: HTMLCanvasElement, onDisable: () => void): void {
  _debugMode = enabled;

  if (enabled) {
    canvas.requestPointerLock();
  } else {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
    onDisable();
  }

  console.debug(`[DebugMode] ${enabled ? 'ON ▶ pointer lock requested, limits removed' : 'OFF ▶ limits restored'}`);
}
