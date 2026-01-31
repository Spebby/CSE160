import { Cube, Cylinder } from './shapes.js';
import Transform from './transform.js'

const BODY_COLOUR = [126 / 255, 133 / 255, 104 / 255, 1.0].slice();
const BODY_DARK   = [36  / 255, 35  / 255, 33  / 255, 1.0].slice();
const BODY_ALT    = [228 / 255, 215 / 255, 206 / 255, 1.0].slice();
const HEAD_LIGHT  = [170 / 255, 158 / 255, 146 / 255, 1.0].slice();
const HEAD_NOSE   = [26  / 255, 34  / 255, 29  / 255, 1.0].slice();
const TONGUE      = [194 / 255, 170 / 255, 173 / 255, 1.0].slice();
const CLAWS       = [163 / 255, 163 / 255, 161 / 255, 1.0].slice();

export default class Anteater {
	meshes = [];

	pevlis = null;
	lThigh = null;
	rThigh = null;
	lShin  = null;
	rShin  = null;
	lFoot  = null;
	rFoot  = null;

	constructor(transform = null) {
		if (transform === null) {
			transform = new Transform();
		}

		this.transform = transform;

		// temp vars to simplify unit conversions when necessary
		let iM;
		let wTrans, wRot, wScale;

		// Build the anteater from sticks in a shed
		const pelvis = this.pelvis = new Transform([0, 0, 0], [-5, 0, 0]);
		const chestTransform = new Transform([0, 0.1, 1], [0, 0, 0], [0.75, 1.25, 2.5], pelvis);
		const lThigh = this.lThigh = new Transform([0.5, -0.1, 0], [0, 0, 0], [0.5, 1.25, 0.75], pelvis);
		const rThigh = this.rThigh = lThigh.clone().translate(-1, 0, 0);

		const lShin = this.lShin = new Transform([0, -1, 0], [12, 0, 0], [0.8, 1.25, 0.8], lThigh);
		const rShin = this.rShin = lShin.clone().setParent(rThigh);

		// Chest, L&R Thigh
		this.meshes.push(new Cube(chestTransform, BODY_COLOUR));
		this.meshes.push(new Cube(lThigh, BODY_COLOUR));
		this.meshes.push(new Cube(rThigh, BODY_COLOUR));

		// L&R Shin
		this.meshes.push(new Cube(lShin, BODY_COLOUR));
		this.meshes.push(new Cube(rShin, BODY_COLOUR));

		// atp of third order joint it's becoming really challenging to get scales that feel good,
		// so converting back to world coords for convenience
		iM = lShin.worldMatrix.clone().invert();
		wScale = iM.multiplyVector4(new Vector4([1, 1, 1, 1])).elements;

		const lFoot = this.lFoot = new Transform([0, -0.5, 0.5], [5, 0, 0], [1.1 * wScale[0], 0.1 * wScale[1], 1.25 * wScale[2]], lShin);
		const rFoot = this.rFoot = lFoot.clone().setParent(rShin);

		// L&R Foot
		this.meshes.push(new Cube(lFoot, BODY_DARK));
		this.meshes.push(new Cube(rFoot, BODY_DARK));
	}

	render() {
		for (const m of this.meshes) m.render();
	}
}
