/**
 * Raycast system for 3D intersection testing
 */

const RAYCAST_MAX_DISTANCE = 1000.0;

/**
 * Represents a ray with origin and direction
 */
class Ray {
  constructor(origin, direction) {
    this.origin = origin instanceof Vector3 ? origin : new Vector3(origin);
    this.direction = direction instanceof Vector3 ? direction : new Vector3(direction);
    this.direction.normalize();
  }

  /**
   * Get a point along the ray at distance t
   * @param {number} t - Distance along ray
   * @returns {Vector3} Point at ray.origin + t * ray.direction
   */
  pointAt(t) {
    const result = new Vector3(this.direction.elements);
    result.mul(t);
    result.add(this.origin);
    return result;
  }
}

/**
 * Information about a ray hit
 */
class RayHit {
  constructor() {
    this.hit = false;           // Whether the ray hit anything
    this.object = null;         // The object that was hit
    this.point = null;          // World space hit point (Vector3)
    this.distance = Infinity;   // Distance from ray origin to hit point
    this.normal = null;         // Surface normal at hit point (Vector3)
  }
}

/**
 * Axis-Aligned Bounding Box
 */
class AABB {
  constructor(min, max) {
    this.min = min instanceof Vector3 ? min : new Vector3(min);
    this.max = max instanceof Vector3 ? max : new Vector3(max);
  }

  /**
   * Create AABB from a Shape with transform
   * @param {Shape} shape - Shape object with transform property
   * @returns {AABB} Bounding box in world space
   */
  static fromShape(shape) {
    // Base cube vertices (unit cube from -0.5 to 0.5)
    const baseMin = [-0.5, -0.5, -0.5];
    const baseMax = [0.5, 0.5, 0.5];

    // All 8 corners of the unit cube
    const corners = [
      new Vector3([baseMin[0], baseMin[1], baseMin[2]]),
      new Vector3([baseMax[0], baseMin[1], baseMin[2]]),
      new Vector3([baseMin[0], baseMax[1], baseMin[2]]),
      new Vector3([baseMax[0], baseMax[1], baseMin[2]]),
      new Vector3([baseMin[0], baseMin[1], baseMax[2]]),
      new Vector3([baseMax[0], baseMin[1], baseMax[2]]),
      new Vector3([baseMin[0], baseMax[1], baseMax[2]]),
      new Vector3([baseMax[0], baseMax[1], baseMax[2]]),
    ];

    // Transform all corners to world space
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];

    corners.forEach(corner => {
      const transformed = shape.transform.worldMatrix.multiplyVector3(corner);
      
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], transformed.elements[i]);
        max[i] = Math.max(max[i], transformed.elements[i]);
      }
    });

    return new AABB(min, max);
  }

  /**
   * Create AABB from explicit min/max bounds
   * @param {Array<number>} min - [x, y, z] minimum corner
   * @param {Array<number>} max - [x, y, z] maximum corner
   * @returns {AABB}
   */
  static fromBounds(min, max) {
    return new AABB(min, max);
  }
}

/**
 * Test ray intersection with AABB using slab method
 * @param {Ray} ray - The ray to test
 * @param {AABB} aabb - The bounding box
 * @param {number} maxDistance - Maximum distance to test
 * @returns {Object|null} {distance, point, normal} or null if no hit
 */
function rayAABBIntersect(ray, aabb, maxDistance = RAYCAST_MAX_DISTANCE) {
  let tMin = 0;
  let tMax = maxDistance;
  let hitNormal = new Vector3([0, 0, 0]);
  let normalAxis = -1;
  let normalSign = 1;

  // Test intersection with each axis-aligned slab
  for (let i = 0; i < 3; i++) {
    const invD = 1.0 / ray.direction.elements[i];
    let t0 = (aabb.min.elements[i] - ray.origin.elements[i]) * invD;
    let t1 = (aabb.max.elements[i] - ray.origin.elements[i]) * invD;

    let sign = -1;
    if (invD < 0) {
      [t0, t1] = [t1, t0];
      sign = 1;
    }

    if (t0 > tMin) {
      tMin = t0;
      normalAxis = i;
      normalSign = sign;
    }
    
    tMax = Math.min(tMax, t1);

    if (tMax < tMin) {
      return null; // No intersection
    }
  }

  // Check if intersection is behind ray or too far
  if (tMin < 0 || tMin > maxDistance) {
    return null;
  }

  // Calculate hit normal (face normal of AABB)
  if (normalAxis >= 0) {
    hitNormal.elements[normalAxis] = normalSign;
  }

  return {
    distance: tMin,
    point: ray.pointAt(tMin),
    normal: hitNormal
  };
}

/**
 * Convert screen coordinates to a world-space ray
 * Assumes projection matrix is accessible via window.projectionMatrix
 * @param {number} screenX - Screen X coordinate (pixels)
 * @param {number} screenY - Screen Y coordinate (pixels)
 * @param {Camera} camera - Camera object
 * @param {Matrix4} projectionMatrix - Projection matrix (optional, uses window.projectionMatrix if not provided)
 * @param {HTMLCanvasElement} canvas - Canvas element (optional, uses window.canvas if not provided)
 * @returns {Ray} Ray from camera through screen point
 */
function screenToWorldRay(screenX, screenY, camera, projectionMatrix = null, canvas = null) {
  // Get canvas if not provided
  if (!canvas) {
    canvas = window.canvas || document.querySelector('canvas');
    if (!canvas) {
      throw new Error('Canvas not found. Please provide canvas parameter or set window.canvas');
    }
  }

  // Get projection matrix if not provided
  if (!projectionMatrix) {
    projectionMatrix = window.projectionMatrix;
    if (!projectionMatrix) {
      throw new Error('Projection matrix not found. Please provide projectionMatrix parameter or set window.projectionMatrix');
    }
  }

  // Convert screen coordinates to NDC (-1 to 1)
  const ndcX = (2.0 * screenX / canvas.width) - 1.0;
  const ndcY = 1.0 - (2.0 * screenY / canvas.height);

  // Create clip coordinates (point on near plane)
  const clipCoords = new Vector4([ndcX, ndcY, -1.0, 1.0]);

  // Transform to eye/view space
  const invProj = new Matrix4();
  invProj.setInverseOf(projectionMatrix);
  const eyeCoords = invProj.multiplyVector4(clipCoords);
  eyeCoords.elements[2] = -1.0; // Forward direction
  eyeCoords.elements[3] = 0.0;  // This is a direction, not a point

  // Transform to world space
  const viewMatrix = camera.getViewMatrix();
  const invView = new Matrix4();
  invView.setInverseOf(viewMatrix);
  const worldCoords = invView.multiplyVector4(eyeCoords);

  // Create ray from camera position with world direction
  const origin = new Vector3(camera.transform.getWorldPosition());
  const direction = new Vector3([
    worldCoords.elements[0],
    worldCoords.elements[1],
    worldCoords.elements[2]
  ]);
  direction.normalize();

  return new Ray(origin, direction);
}

/**
 * Cast a ray through the scene and find the nearest hit
 * @param {Ray} ray - The ray to cast
 * @param {Array<Object>} objects - Array of objects to test (must have transform property)
 * @param {number} maxDistance - Maximum distance to raycast (default: 1000)
 * @returns {RayHit} Information about the hit
 */
function raycast(ray, objects, maxDistance = RAYCAST_MAX_DISTANCE) {
  const result = new RayHit();

  for (const obj of objects) {
    // Skip objects without transforms
    if (!obj.transform) continue;

    // Create AABB for object
    const aabb = AABB.fromShape(obj);

    // Test intersection
    const hit = rayAABBIntersect(ray, aabb, maxDistance);

    if (hit && hit.distance < result.distance) {
      result.hit = true;
      result.object = obj;
      result.point = hit.point;
      result.distance = hit.distance;
      result.normal = hit.normal;
    }
  }

  return result;
}

/**
 * Cast a ray from screen coordinates and find nearest hit
 * @param {number} screenX - Screen X coordinate (pixels)
 * @param {number} screenY - Screen Y coordinate (pixels)
 * @param {Camera} camera - Camera object
 * @param {Array<Object>} objects - Array of objects to test
 * @param {number} maxDistance - Maximum distance to raycast (default: 1000)
 * @param {Matrix4} projectionMatrix - Projection matrix (optional)
 * @param {HTMLCanvasElement} canvas - Canvas element (optional)
 * @returns {RayHit} Information about the hit
 */
function raycastFromScreen(screenX, screenY, camera, objects, maxDistance = RAYCAST_MAX_DISTANCE, projectionMatrix = null, canvas = null) {
  const ray = screenToWorldRay(screenX, screenY, camera, projectionMatrix, canvas);
  return raycast(ray, objects, maxDistance);
}
