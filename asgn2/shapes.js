import Transform from './transform.js'

// shapes.js
/**
 * We can pack a bunch of vertex information in here & use offsets
 * to avoid reassigning buffer data.
 * This is a little messy but for a project of this scale it's probably
 * the simplest thing to do.
 */

// build cylinder data at runtime
function makeUnitCylinder(radialSegments = 8) {
	const vertices = [];
	const r = 0.5;
	const h = 0.5;
	const angleStep = (2 * Math.PI) / radialSegments;
  
	// Build sides
	for (let i = 0; i < radialSegments; i++) {
		const theta0 = i * angleStep;
		const theta1 = ((i + 1) % radialSegments) * angleStep;
		
		const x0 = r * Math.cos(theta0);
		const z0 = r * Math.sin(theta0);
		const x1 = r * Math.cos(theta1);
		const z1 = r * Math.sin(theta1);
		
		vertices.push(
		  x0, -h, z0,
		  x0,  h, z0,
		  x1,  h, z1,
		  
		  x0, -h, z0,
		  x1,  h, z1,
		  x1, -h, z1
		);
	}
  
  
	// Build bottom cap
	for (let i = 0; i < radialSegments; i++) {
		const theta0 = i * angleStep;
		const theta1 = (i + 1) * angleStep;
		
		const x0 = r * Math.cos(theta0);
		const z0 = r * Math.sin(theta0);
		const x1 = r * Math.cos(theta1);
		const z1 = r * Math.sin(theta1);
		
		vertices.push(
			0,  -h, 0,
			x0, -h, z0,
			x1, -h, z1
		);
	}
	  
	// Build top cap
	for (let i = 0; i < radialSegments; i++) {
		const theta0 = i * angleStep;
		const theta1 = (i + 1) * angleStep;
		
		const x0 = r * Math.cos(theta0);
		const z0 = r * Math.sin(theta0);
		const x1 = r * Math.cos(theta1);
		const z1 = r * Math.sin(theta1);
		
		vertices.push(
			0,  h, 0,
			x1, h, z1,
			x0, h, z0
		);
	}
	  
	return vertices;
}


const cylinderVerts = makeUnitCylinder(8);

const CUBE_OFFSET = 0;
const CYLINDER_OFFSET = 33;
const SPHERE_OFFSET = 33 + (cylinderVerts.length / 3);
const shapeArray = [
	// Cube (+Z, -Z, -X, +X, +Y, -Y)
	-0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,   -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,   -0.5,  0.5,  0.5,
	0.5, -0.5, -0.5,   -0.5, -0.5, -0.5,   -0.5,  0.5, -0.5,   0.5, -0.5, -0.5,   -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
	-0.5, -0.5, -0.5,   -0.5, -0.5,  0.5,   -0.5,  0.5,  0.5,   -0.5, -0.5, -0.5,   -0.5,  0.5,  0.5,   -0.5,  0.5, -0.5,
	0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5,  0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
	-0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,   -0.5,  0.5,  0.5,   0.5,  0.5, -0.5,   -0.5,  0.5, -0.5,
	-0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,   -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,   -0.5, -0.5,  0.5
];
shapeArray.push(...cylinderVerts);


// shape interface
export default class Shape {
	static vBuffer = null;
	static vertexData = null;
	static vertexCount = 0;
	static vertexOffset = 0;

	static initSharedBuffer() {
		if (this.vBuffer) return;
		if (!this.vertexData)
			throw new Error(`${this.name}: vertexData not defined`);

		const GL = window.gl;
		this.vBuffer = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuffer);
		GL.bufferData(
			GL.ARRAY_BUFFER,
			new Float32Array(this.vertexData),
			GL.STATIC_DRAW
		);
	}

	/**
	 * @param {Transform} transform
	 * @param {Array<number>} colour - RGBA color
	 */
	constructor(transform, colour) {
		this.transform = transform;
		this.colour = colour;
		this.constructor.initSharedBuffer();
	}

	setColour() {
		const [r, g, b, a] = this.colour;
		window.gl.uniform4f(window.u_FragColor, r, g, b, a);
	}

	render() {
		this.setColour();
		const GL = window.gl;
		const C = this.constructor;

		GL.uniformMatrix4fv(
			window.u_ModelMatrix,
			false,
			this.transform.worldMatrix.elements
		);

		GL.bindBuffer(GL.ARRAY_BUFFER, C.vBuffer);
		GL.vertexAttribPointer(window.a_Position, 3, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		GL.drawArrays(GL.TRIANGLES, C.vertexOffset, C.vertexCount);
	}
}

export class Cube extends Shape {
	static vertexData = shapeArray;
	static vertexCount = 36;
	static vertexOffset = CUBE_OFFSET;
}

export class Cylinder extends Shape {
	static vertexData = shapeArray;
	static vertexCount = (cylinderVerts.length / 3);
	static vertexOffset = CUBE_OFFSET + Cube.vertexCount;
}
