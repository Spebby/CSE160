const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export const CameraMode = {
	TRACK: 0,
	FREE: 1,
	ORBIT: 2,
	FP: 3,
};

export default class Camera {
	target = null;
	
	mode = CameraMode.ORBIT;
	distance = 6;
	moveSpeed = 0.01;
	
	// Mouse/input state
	isDragging = false;
	lastMouseX = 0;
	lastMouseY = 0;
	invertX = false;
	invertY = false;
	
	keyStates = {};
	
	constructor(transform = null, target = null, mode = CameraMode.ORBIT) {
		this.transform = transform;
		this.target = target;
		this.mode = mode;
	}
	
	/**
	 * Update camera position and orientation based on mode and input
	 * @param {number} dt - Delta time in seconds
	 */
	update(dt) {
		const speed = this.moveSpeed * dt;
		
		// Get target position - use static orbit point if in ORBIT mode
		let targetX, targetY, targetZ;
		if (this.mode === CameraMode.ORBIT) {
			[targetX, targetY, targetZ] = [0, 2, 0];
		} else if (this.target) {
			[targetX, targetY, targetZ] = this.target.getWorldPosition();
		} else {
			[targetX, targetY, targetZ] = [0, 0, 0];
		}
		
		if (this.mode === CameraMode.FREE || this.mode === CameraMode.FP || this.mode === CameraMode.TRACK) {
			const forward = (this.keyStates['w'] ? 1 : 0) - (this.keyStates['s'] ? 1 : 0);
			const right = (this.keyStates['a'] ? 1 : 0) - (this.keyStates['d'] ? 1 : 0);	
			let up = (this.keyStates['e'] ? 1 : 0) - (this.keyStates['q'] ? 1 : 0);
			
			// FP mode: Apply Q/E rotation FIRST, before calculating movement vectors
			if (this.mode === CameraMode.FP) {
				const rotSpeed = 130 * dt;
				const [rotX, rotY, rotZ] = this.transform.rotation.slice();
				this.transform.setRot(rotX, rotY - up * rotSpeed, rotZ);
				up = 0.0; // Don't use for vertical movement
			}
			
			let forwardX, forwardZ, rightX, rightZ;
			if (this.mode === CameraMode.FREE || this.mode === CameraMode.FP) {
				const [, angleY] = this._getAngles();
				({ forwardX, forwardZ, rightX, rightZ } = this._getMovementVectors(angleY));
			} else {
				const [camX, camY, camZ] = this.transform.getWorldPosition();
				({ forwardX, forwardZ, rightX, rightZ } = this._getTrackingVectors(targetX, targetZ, camX, camZ));
			}
			
			this.transform.translate(
				(forwardX * forward + rightX * right) * speed,
				up * speed,
				(forwardZ * forward + rightZ * right) * speed
			);
		}
		
		if (this.mode === CameraMode.ORBIT) {
			// In orbit mode, we position the camera relative to target
			// The transform position will be updated in getViewMatrix
		}
	}
	
	/**
	 * Get the view matrix for rendering
	 * @returns {Matrix4}
	 */
	getViewMatrix() {
		const viewMatrix = new Matrix4();
		const [camX, camY, camZ] = this.transform.getWorldPosition();
		
		// Get target position - use static orbit point if in ORBIT mode
		let targetX, targetY, targetZ;
		if (this.mode === CameraMode.ORBIT) {
			[targetX, targetY, targetZ] = [0, 2, 0];
		} else if (this.target) {
			[targetX, targetY, targetZ] = this.target.getWorldPosition();
		} else {
			[targetX, targetY, targetZ] = [0, 0, 0];
		}
		
		if (this.mode === CameraMode.FREE || this.mode === CameraMode.FP) {
			const [angleX, angleY] = this._getAngles();
			const lookAt = this._getLookAtPoint(angleX, angleY);
			viewMatrix.setLookAt(camX, camY, camZ, lookAt.x, lookAt.y, lookAt.z, 0, 1, 0);
		} else if (this.mode === CameraMode.TRACK) {
			viewMatrix.setLookAt(camX, camY, camZ, targetX, targetY, targetZ, 0, 1, 0);
		} else if (this.mode === CameraMode.ORBIT) {
			const [angleX, angleY] = this._getAngles();
			const pos = this._getOrbitPosition(targetX, targetY, targetZ, this.distance, angleX, angleY);
			
			// Update transform to match orbit position
			this.transform.setPos(pos.x, pos.y, pos.z);
			
			viewMatrix.setLookAt(pos.x, pos.y, pos.z, targetX, targetY, targetZ, 0, 1, 0);
		}
		
		return viewMatrix;
	}
	
	/**
	 * Handle mouse drag for camera rotation
	 * @param {number} deltaX - Mouse movement in X
	 * @param {number} deltaY - Mouse movement in Y
	 */
	handleMouseDrag(deltaX, deltaY) {
		if (this.mode === CameraMode.TRACK) return;
		
		const dx = deltaX * (this.invertX ? 1 : -1);
		const dy = deltaY * (this.invertY ? -1 : 1);
		
		const [angleX, angleY] = this._getAngles();
		const newAngleY = angleY + dx * 0.2;
		const newAngleX = Math.max(-89, Math.min(89, angleX - dy * 0.2));
		
		this.transform.setRot(newAngleX, newAngleY, 0);
	}
	
	/**
	 * Handle mouse wheel for distance/speed adjustment
	 * @param {number} delta - Wheel delta
	 * @param {number} maxSpeed - Maximum movement speed
	 * @param {number} step - Speed adjustment step
	 */
	handleMouseWheel(delta, maxSpeed = 0.1, step = 0.001) {
		if (this.mode === CameraMode.ORBIT) {
			this.distance += delta * 0.01;
			this.distance = Math.max(0.1, this.distance);
		} else {
			this.moveSpeed += step;
			this.moveSpeed = Math.max(0.001, Math.min(this.moveSpeed, maxSpeed));
		}
	}
	
	/**
	 * Transition between camera modes
	 * @param {number} newMode - New camera mode
	 */
	setMode(newMode) {
		const oldMode = this.mode;
		
		// Get target position for transitions
		let targetX, targetY, targetZ;
		if (this.target) {
			[targetX, targetY, targetZ] = this.target.getWorldPosition();
		} else {
			[targetX, targetY, targetZ] = [0, 2, 0];
		}
		
		// ORBIT → FREE / TRACK
		if (oldMode === CameraMode.ORBIT && newMode !== CameraMode.ORBIT) {
			// Use static orbit point for transition
			[targetX, targetY, targetZ] = [0, 2, 0];
			const [angleX, angleY] = this._getAngles();
			const [dx, dy, dz] = this._anglesToDir(angleX, angleY);
			
			this.transform.setPos(
				targetX + dx * this.distance,
				targetY + dy * this.distance,
				targetZ + dz * this.distance
			);
			
			this.transform.setRot(-angleX, ((angleY + 180 + 180) % 360) - 180, 0);
			
			// Update target for TRACK mode
			if (newMode === CameraMode.TRACK && this.target) {
				[targetX, targetY, targetZ] = this.target.getWorldPosition();
			}
		}
		
		// TRACK → FREE
		if (oldMode === CameraMode.TRACK && newMode === CameraMode.FREE) {
			const [camX, camY, camZ] = this.transform.getWorldPosition();
			const ang = this._dirToAngles(targetX - camX, targetY - camY, targetZ - camZ);
			if (ang) this.transform.setRot(ang[0], ang[1], 0);
		}
		
		// FREE / TRACK → ORBIT
		if (newMode === CameraMode.ORBIT && oldMode !== CameraMode.ORBIT) {
			// Use static orbit point for transition
			[targetX, targetY, targetZ] = [0, 2, 0];
			const [camX, camY, camZ] = this.transform.getWorldPosition();
			
			const dx = camX - targetX;
			const dy = camY - targetY;
			const dz = camZ - targetZ;
			
			this.distance = Math.hypot(dx, dy, dz);
			const ang = this._dirToAngles(dx, dy, dz);
			if (ang) this.transform.setRot(ang[0], ang[1], 0);
		}
		
		this.mode = newMode;
	}
	
	// Private helper methods
	_getAngles() {
		const [angleX, angleY] = this.transform.rotation;
		return [angleX, angleY];
	}
	
	_getMovementVectors(angleY) {
		const radY = angleY * DEG_TO_RAD;
		return {
			forwardX: Math.sin(radY),
			forwardZ: Math.cos(radY),
			rightX: Math.cos(radY),
			rightZ: -Math.sin(radY)
		};
	}
	
	_getTrackingVectors(targetX, targetZ, camX, camZ) {
		const dx = targetX - camX;
		const dz = targetZ - camZ;
		const len = Math.sqrt(dx*dx + dz*dz);
		
		if (len > 0.001) {
			return {
				forwardX: dx / len,
				forwardZ: dz / len,
				rightX: dz / len,
				rightZ: -dx / len
			};
		}
		return { forwardX: 0, forwardZ: 1, rightX: 1, rightZ: 0 };
	}
	
	_getOrbitPosition(targetX, targetY, targetZ, distance, angleX, angleY) {
		const radX = angleX * DEG_TO_RAD;
		const radY = angleY * DEG_TO_RAD;
		return {
			x: targetX + distance * Math.cos(radX) * Math.sin(radY),
			y: targetY + distance * Math.sin(radX),
			z: targetZ + distance * Math.cos(radX) * Math.cos(radY)
		};
	}
	
	_getLookAtPoint(angleX, angleY, distance = 10) {
		const radX = angleX * DEG_TO_RAD;
		const radY = angleY * DEG_TO_RAD;
		const [camX, camY, camZ] = this.transform.getWorldPosition();
		return {
			x: camX + distance * Math.cos(radX) * Math.sin(radY),
			y: camY + distance * Math.sin(radX),
			z: camZ + distance * Math.cos(radX) * Math.cos(radY)
		};
	}
	
	_anglesToDir(ax, ay) {
		const radX = ax * DEG_TO_RAD, radY = ay * DEG_TO_RAD;
		return [
			Math.cos(radX) * Math.sin(radY),
			Math.sin(radX),
			Math.cos(radX) * Math.cos(radY)
		];
	}
	
	_dirToAngles(dx, dy, dz) {
		const len = Math.hypot(dx, dy, dz);
		return len < 1e-3 ? null : [
			Math.asin(dy / len) * RAD_TO_DEG,
			Math.atan2(dx, dz) * RAD_TO_DEG
		];
	}
	
	/**
	 * Cast a ray from screen coordinates and find nearest hit
	 * Convenient wrapper around raycastFromScreen from raycast.js
	 * @param {number} screenX - Screen X coordinate (pixels)
	 * @param {number} screenY - Screen Y coordinate (pixels)
	 * @param {Array<Object>} objects - Array of objects to test
	 * @param {number} maxDistance - Maximum distance to raycast (default: 1000)
	 * @param {Matrix4} projectionMatrix - Projection matrix (optional, uses window.projectionMatrix)
	 * @param {HTMLCanvasElement} canvas - Canvas element (optional, uses window.canvas)
	 * @returns {RayHit} Information about the hit
	 */
	raycast(screenX, screenY, objects, maxDistance = 1000, projectionMatrix = null, canvas = null) {
		// This requires raycast.js to be loaded
		if (typeof raycastFromScreen === 'undefined') {
			throw new Error('raycast.js must be loaded to use Camera.raycast()');
		}
		return raycastFromScreen(screenX, screenY, this, objects, maxDistance, projectionMatrix, canvas);
	}
}
