import { Cube, SlantedCube, Ramp, Cylinder } from './shapes.js';
import Transform from './transform.js'

const BODY_COLOUR = [77  / 255, 67  / 255, 57  / 255, 1.0].slice();
const BODY_DARK   = [36  / 255, 35  / 255, 33  / 255, 1.0].slice();
const BODY_ALT    = [228 / 255, 215 / 255, 206 / 255, 1.0].slice();
const HEAD_LIGHT  = [170 / 255, 158 / 255, 146 / 255, 1.0].slice();
const HEAD_NOSE   = [26  / 255, 34  / 255, 29  / 255, 1.0].slice();
const TONGUE      = [194 / 255, 170 / 255, 173 / 255, 1.0].slice();
const CLAWS       = [163 / 255, 163 / 255, 161 / 255, 1.0].slice();

export default class Anteater {
	#meshes = [];
	
	cameraFocus = null;
	pivot = null;
	pelvis = null;
	lThigh = null;
	rThigh = null;
	lShin  = null;
	rShin  = null;
	lFoot  = null;
	rFoot  = null;
	tailA  = null;
	tailB  = null;

	head = null;
	chest = null;
	lBicep = null;
	rBicep = null;
	lForearm = null;
	rForearm = null;
	lHand = null;
	rHand = null

	constructor(transform = null) {
		if (transform === null) {
			transform = new Transform();
		}
		this.pivot = transform;
		 
		// Build the anteater from sticks in a shed
		const pelvis = this.pelvis = new Transform([ 0.0,  2.25, -1.35], [-2,   0,   0], [1, 1, 1], transform);
		const lThigh = this.lThigh = new Transform([ 0.5,  0.25,  0.0], [ 0,   0,   0], [1, 1, 1], pelvis);
		const lShin  = this.lShin  = new Transform([ 0.0, -1.25,  0.0], [ 12, -0.2, 0], [1, 1, 1], lThigh);
		const lFoot  = this.lFoot  = new Transform([ 0.0, -1.0,   0.0], [-5.5, 0,   0], [1, 1, 1], lShin);
		const rThigh = this.rThigh = lThigh.clone().translate(-1, 0, 0);
		const rShin  = this.rShin  = lShin.clone().setParent(rThigh);
		const rFoot  = this.rFoot  = lFoot.clone().setParent(rShin);
		
		// Tail
		const tailA = this.tailA = new Transform([0, 0.2, -0.3], [-2, 180, 0], [1, 1, 1], pelvis);
		const tailB = this.tailB = new Transform([0, 0,   1.75], [5,  0,   0], [1, 1, 1], tailA);
		
		// Front
		const chest    = this.chest    = new Transform([0,     0,   2.75], [ 4, 0, 0], [1, 1, 1], pelvis);
		const lBicep   = this.lBicep   = new Transform([0.5,   0.1,    0], [ 3, 0, 0], [1, 1, 1], chest);
		const lForearm = this.lForearm = new Transform([0,    -1.25,   0], [-7, 0, 0], [1, 1, 1], lBicep);
		const lHand    = this.lHand    = new Transform([0.0,  -1.1, -0.1], [-5.5, 0,   0], [1, 1, 1], lForearm);
		const rBicep   = this.rBicep   = lBicep.clone().translate(-1, 0, 0);
		const rForearm = this.rForearm = lForearm.clone().setParent(rBicep);
		const rHand    = this.rHand    = lHand.clone().setParent(rForearm);

		const head = this.head = new Transform([0, 0.25, 0.5], [0, 0, 0], [1, 1, 1], chest);
	

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
		
		this.cameraFocus = bodyVis;
		this.#meshes.push(new Cube(bodyVis, BODY_COLOUR));
		this.#meshes.push(new Cube(lThighVis, BODY_COLOUR));
		this.#meshes.push(new Cube(rThighVis, BODY_COLOUR));
		this.#meshes.push(new Cube(lShinVis, BODY_COLOUR));
		this.#meshes.push(new Cube(rShinVis, BODY_COLOUR));
		this.#meshes.push(new Cube(lFootVis, BODY_COLOUR));
		this.#meshes.push(new Cube(rFootVis, BODY_COLOUR));
		this.#meshes.push(new Cube(tailAVis, BODY_COLOUR));
		this.#meshes.push(new Cube(tailBVis, BODY_DARK));
		this.#meshes.push(new Cube(lBicepVis, BODY_ALT));
		this.#meshes.push(new Cube(rBicepVis, BODY_ALT));
		this.#meshes.push(new Cube(lForearmVis, BODY_ALT));
		this.#meshes.push(new Cube(rForearmVis, BODY_ALT));
		this.#meshes.push(new Cube(lHandVis, CLAWS));
		this.#meshes.push(new Cube(rHandVis, CLAWS));
		this.#meshes.push(new SlantedCube(stripeVis, BODY_DARK));
		this.#meshes.push(new SlantedCube(headVisA, BODY_COLOUR));
		this.#meshes.push(new Cube(headVisB, BODY_COLOUR));
		this.#meshes.push(new Cylinder(eye, [0, 0, 0, 1].slice()));

		this.#meshes.push(new SlantedCube(stripeBVis, BODY_ALT));
		this.#meshes.push(new Ramp(stripeCVis, BODY_DARK));
	}

	render() {
		for (const m of this.#meshes) m.render();
	}

	getRigInfo() {
		const bones = [
			"head", "lBicep", "rBicep", "lForearm", "rForearm", "lHand", "rHand",
			"pelvis", "lThigh", "rThigh", "lShin", "rShin", "lFoot", "rFoot",
			"tailA", "tailB"
		];

		const info = {};

		for (const name of bones) {
			const bone = this[name];
			if (!bone) continue;
			info[name] = bone.rotation.slice();
		}

		return info;
	}
}
