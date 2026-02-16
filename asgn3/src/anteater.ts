import { Cube, SlantedCube, Ramp, Cylinder } from '../../assets/lib/shapes.js';
import Transform from '../../assets/lib/transform.js';
import { Rig, AnimMan } from '../../assets/lib/animation.js';

const BODY_COLOUR = [77  / 255, 67  / 255, 57  / 255, 1.0].slice() as [number, number, number, number];
const BODY_DARK   = [36  / 255, 35  / 255, 33  / 255, 1.0].slice() as [number, number, number, number];
const BODY_ALT    = [228 / 255, 215 / 255, 206 / 255, 1.0].slice() as [number, number, number, number];
const HEAD_LIGHT  = [170 / 255, 158 / 255, 146 / 255, 1.0].slice() as [number, number, number, number];
const HEAD_NOSE   = [26  / 255, 34  / 255, 29  / 255, 1.0].slice() as [number, number, number, number];
const TONGUE      = [194 / 255, 170 / 255, 173 / 255, 1.0].slice() as [number, number, number, number];
const CLAWS       = [163 / 255, 163 / 255, 161 / 255, 1.0].slice() as [number, number, number, number];

enum AnteaterState {
	IDLE = 'idle',
	WALKING = 'walking',
	ANIMATING = 'animating'
}

// This class handles too much but im crunching
type Geometry = Cube | SlantedCube | Ramp | Cylinder;
export default class Anteater {
	bones: Rig = {};
    cameraFocus: Transform | null = null;
	private rootTransform: Transform;
	private meshes: Geometry[] = [];

	// AI state
	private ANIM_MAN: AnimMan;
	private state: AnteaterState = AnteaterState.IDLE;
	private destination: [number, number] | null = null;
	private targetRotation: number = 0;
	private moveSpeed: number = 2.0;
	private turnSpeed: number = 180; // degrees per second
	private arrivalDistance: number = 0.3;
	private maxRoamDistance: number = 10.0;
	
	// Animation timing
	private timeSinceLastWander: number = 0;
	private baseWanderDelay: number = 2.0;
	private wanderDelayIncrease: number = 0.5;
	private currentWanderDelay: number = 2.0;

	constructor(transform: Transform | null = null, animations: any) {
		if (transform === null) transform = new Transform();
		this.rootTransform = transform;
		const pivot = transform;
 
		// Build the anteater from sticks in a shed
		const pelvis = new Transform([ 0.0,  2.25, -1.35], [-2,   0,   0], [1, 1, 1], transform);
		const lThigh = new Transform([ 0.5,  0.25,  0.0], [ 0,   0,   0], [1, 1, 1], pelvis);
		const lShin  = new Transform([ 0.0, -1.25,  0.0], [ 12, -0.2, 0], [1, 1, 1], lThigh);
		const lFoot  = new Transform([ 0.0, -1.0,   0.0], [-5.5, 0,   0], [1, 1, 1], lShin);
		const rThigh = lThigh.clone().translate(-1, 0, 0);
		const rShin  = lShin.clone().setParent(rThigh);
		const rFoot  = lFoot.clone().setParent(rShin);

		// Tail
		const tailA = new Transform([0, 0.2, -0.3], [-2, 180, 0], [1, 1, 1], pelvis);
		const tailB = new Transform([0, 0,   1.75], [5,  0,   0], [1, 1, 1], tailA);

		// Front
		const chest    = new Transform([0,     0,   2.75], [ 4, 0, 0], [1, 1, 1], pelvis);
		const lBicep   = new Transform([0.5,   0.1,    0], [ 3, 0, 0], [1, 1, 1], chest);
		const lForearm = new Transform([0,    -1.25,   0], [-7, 0, 0], [1, 1, 1], lBicep);
		const lHand    = new Transform([0.0,  -1.1, -0.1], [-5.5, 0,   0], [1, 1, 1], lForearm);
		const rBicep   = lBicep.clone().translate(-1, 0, 0);
		const rForearm = lForearm.clone().setParent(rBicep);
		const rHand    = lHand.clone().setParent(rForearm);

		const head = new Transform([0, 0.25, 0.5], [0, 0, 0], [1, 1, 1], chest);


		// To simplify mesh creation & animation, I do not scale the skeleton's pivots.
		// as a result the attached "chunks" must be scaled individually. 
		const bodyVis    = new Transform([0, 0.1, 1.5], [0, 0, 0], [0.75, 1.25, 4], pelvis);
		const tailAVis   = new Transform([0, 0, 0.875], [0, 0, 0], [0.75, 1, 1.75], tailA);
		const tailBVis   = new Transform([0, -0.1, 0.5], [0, 0, 0], [0.8, 1.25, 1.65], tailB);
		const stripeVis  = new Transform([0, -0.02, 0.11], [176, 180, 0], [0.76, 0.8, 1.3], chest);
		const stripeBVis = new Transform([0, -0.065, -0.5], [176, 180, 0], [0.765, 0.8, 1], chest);
		const stripeCVis = new Transform([0,  0.2, -0.75], [176, 180, 0], [0.77, 0.8, 1], chest);

		const lThighVis = new Transform([0, -0.625, 0], [0, 0, 0], [0.5, 1.5, 0.75], lThigh);
		const lShinVis  = new Transform([0, -0.5, 0], [0, 0, 0], [0.4, 1.25, 0.6], lShin);
		const lFootVis  = new Transform([0, -0.125, 0.375], [0, 0, 0], [0.5, 0.25, 0.75], lFoot);
		const rThighVis = lThighVis.clone().setParent(rThigh);
		const rShinVis  = lShinVis.clone().setParent(rShin);
		const rFootVis  = lFootVis.clone().setParent(rFoot);

		const lBicepVis   = new Transform([0, -0.625, 0], [0, 0, 0], [0.5, 1.5, 0.75], lBicep);
		const lForearmVis = new Transform([0, -0.55, 0], [0, 0, 0], [0.4, 1.35, 0.6], lForearm);
		const lHandVis    = new Transform([0,  0,   -0.1], [0, 0, 0], [0.65, 0.25, 0.45], lHand);
		const rBicepVis   = lBicepVis.clone().setParent(rBicep);
		const rForearmVis = lForearmVis.clone().setParent(rForearm);
		const rHandVis    = lHandVis.clone().setParent(rHand);

		const headVisA = new Transform([0, 0, 0.55], [0, 0, 0], [0.4, 0.8, 1], head);
		const headVisB = new Transform(
			[0, 0.274605, headVisA.position[2] + 0.85],
			[4, 0, 0],
			[headVisA.scale[0], 0.4, 0.75], head);
		const eye = new Transform([0, 0.3, 0.5], [0, 0, 90], [0.1, 0.42, 0.1], head);

        this.bones = {
            pelvis, lThigh, rThigh, lShin, rShin, lFoot, rFoot,
            chest, lBicep, rBicep, lForearm, rForearm, lHand, rHand,
            head, tailA, tailB
        };

		this.ANIM_MAN = new AnimMan(this.bones, animations);
		this.cameraFocus = bodyVis;
		this.meshes.push(new Cube(bodyVis, BODY_COLOUR));
		this.meshes.push(new Cube(lThighVis, BODY_COLOUR));
		this.meshes.push(new Cube(rThighVis, BODY_COLOUR));
		this.meshes.push(new Cube(lShinVis, BODY_COLOUR));
		this.meshes.push(new Cube(rShinVis, BODY_COLOUR));
		this.meshes.push(new Cube(lFootVis, BODY_COLOUR));
		this.meshes.push(new Cube(rFootVis, BODY_COLOUR));
		this.meshes.push(new Cube(tailAVis, BODY_COLOUR));
		this.meshes.push(new Cube(tailBVis, BODY_DARK));
		this.meshes.push(new Cube(lBicepVis, BODY_ALT));
		this.meshes.push(new Cube(rBicepVis, BODY_ALT));
		this.meshes.push(new Cube(lForearmVis, BODY_ALT));
		this.meshes.push(new Cube(rForearmVis, BODY_ALT));
		this.meshes.push(new Cube(lHandVis, CLAWS));
		this.meshes.push(new Cube(rHandVis, CLAWS));
		this.meshes.push(new SlantedCube(stripeVis, BODY_DARK));
		this.meshes.push(new SlantedCube(headVisA, BODY_COLOUR));
		this.meshes.push(new Cube(headVisB, BODY_COLOUR));
		this.meshes.push(new Cylinder(eye, [0, 0, 0, 1].slice() as [number, number, number, number]));
		this.meshes.push(new SlantedCube(stripeBVis, BODY_ALT));
		this.meshes.push(new Ramp(stripeCVis, BODY_DARK));
	}

	/**
	 * Pick a random destination within maxRoamDistance of origin
	 */
	private pickRandomDestination(): void {
		const minDistanceFromOrigin = 3.0;
		const minDistanceFromCurrent = 4.0;
		const maxAttempts = 10;
		
		let attempt = 0;
		let validDestination = false;
		let destX = 0, destZ = 0;
		
		const [currentX, , currentZ] = this.rootTransform.getWorldPosition();
		
		while (!validDestination && attempt < maxAttempts) {
			// random point in ring
			const angle = Math.random() * Math.PI * 2;
			const distance = minDistanceFromOrigin + Math.random() * (this.maxRoamDistance - minDistanceFromOrigin);
			
			destX = Math.cos(angle) * distance;
			destZ = Math.sin(angle) * distance;
			
			// avoid close points
			const dx = destX - currentX;
			const dz = destZ - currentZ;
			const distFromCurrent = Math.sqrt(dx * dx + dz * dz);
			
			if (distFromCurrent >= minDistanceFromCurrent) {
				validDestination = true;
			}
			
			attempt++;
		}

		// if fail, this is just the last attempt 
		this.destination = [destX, destZ];
		const [x, , z] = this.rootTransform.getWorldPosition();
		this.targetRotation = Math.atan2(destX - x, destZ - z) * (180 / Math.PI);
	}

	/**
	 * Weighted random animation selection
	 */
	private pickIdleAnimation(): string {
		const rand = Math.random();
		if (rand < 0.8) {
			return 'idle';
		} else {
			return 'guard';
		}
	}
	
	/**
	 * Lerp angle with wraparound
	 */
	private lerpAngle(from: number, to: number, t: number): number {
		const normalize = (a: number) => ((a + 180) % 360 + 360) % 360 - 180;
		from = normalize(from);
		to = normalize(to);
		
		// shortest path
		let delta = to - from;
		if (delta > 180) delta -= 360;
		if (delta < -180) delta += 360;
		
		return normalize(from + delta * t);
	}
	
	update(dt: number): void {
		const [x, y, z] = this.rootTransform.getWorldPosition();
		const [, currentRotY,] = this.rootTransform.rotation.slice();
		this.ANIM_MAN.update(dt);
		
		switch (this.state) {
			case AnteaterState.IDLE:
				this.timeSinceLastWander += dt;
				
				const currentAnim = this.ANIM_MAN.getActiveAnimation();
				const queueLength = this.ANIM_MAN.getQueueLength();
				
				if (!currentAnim && queueLength === 0) {
					const wanderProb = Math.min(this.timeSinceLastWander / this.currentWanderDelay, 1.0);
					
					if (Math.random() < wanderProb) {
						this.pickRandomDestination();
						this.state = AnteaterState.WALKING;
						this.ANIM_MAN.interruptAnimQueue('walk'); // Changed from queueAnim
						
						this.currentWanderDelay += this.wanderDelayIncrease;
					} else {
						this.ANIM_MAN.queueAnim(this.pickIdleAnimation());
					}
				}
				break;
			
			case AnteaterState.WALKING:
				if (!this.destination) {
					this.state = AnteaterState.IDLE;
					break;
				}
				
				const [destX, destZ] = this.destination;
				const dx = destX - x;
				const dz = destZ - z;
				const distance = Math.sqrt(dx * dx + dz * dz);
				
				if (distance < this.arrivalDistance) {
					this.destination = null;
					this.state = AnteaterState.IDLE;
					this.timeSinceLastWander = 0;
					this.ANIM_MAN.interruptAnimQueue(this.pickIdleAnimation());
					break;
				}
				
				// Lerp rotation towards destination
				const newRotY = this.lerpAngle(currentRotY, this.targetRotation, dt * this.turnSpeed / 180);
				this.rootTransform.setRot(0, newRotY, 0);
				
				// Move DIRECTLY towards destination (ignore rotation for movement)
				const moveAmount = this.moveSpeed * dt;
				const direction = [dx / distance, dz / distance]; // Normalized direction
				
				this.rootTransform.translate(
					direction[0] * moveAmount,
					0,
					direction[1] * moveAmount
				);
				break;
			
			case AnteaterState.ANIMATING:
				if (!this.ANIM_MAN.getActiveAnimation()) {
					this.state = AnteaterState.IDLE;
				}
				break;
		}
	}

	render(): void {
		for (const m of this.meshes) m.render();
	}

	getRigInfo(): Record<string, [number, number, number]> {
		const bones = [
			"head", "lBicep", "rBicep", "lForearm", "rForearm", "lHand", "rHand",
			"pelvis", "lThigh", "rThigh", "lShin", "rShin", "lFoot", "rFoot",
			"tailA", "tailB"
		] as const;

		const info: Record<string, [number, number, number]> = {};

		for (const name of Object.keys(this.bones)) {
			const bone = this.bones[name];
			if (!bone) continue;
			info[name] = bone.rotation.slice() as [number, number, number];
		}

		return info;
	}

	setMoveSpeed(speed: number): void {
		this.moveSpeed = speed;
	}
	
	setMaxRoamDistance(distance: number): void {
		this.maxRoamDistance = distance;
	}
	
	setWanderTiming(baseDelay: number, increase: number): void {
		this.baseWanderDelay = baseDelay;
		this.wanderDelayIncrease = increase;
		this.currentWanderDelay = baseDelay;
	}
}
