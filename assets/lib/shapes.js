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

function generateNormals(vertices) {
	const normals = [];
	
	// Process vertices in groups of 3 (triangles)
	for (let i = 0; i < vertices.length; i += 9) {
		const v0 = [vertices[i], vertices[i+1], vertices[i+2]];
		const v1 = [vertices[i+3], vertices[i+4], vertices[i+5]];
		const v2 = [vertices[i+6], vertices[i+7], vertices[i+8]];
		
		const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
		const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
		
		// cross product & normalise
		const nx = edge1[1] * edge2[2] - edge1[2] * edge2[1];
		const ny = edge1[2] * edge2[0] - edge1[0] * edge2[2];
		const nz = edge1[0] * edge2[1] - edge1[1] * edge2[0];
		
		const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
		const normal = len > 0 ? [nx/len, ny/len, nz/len] : [0, 1, 0];
		
		// flat shading is acceptable
		normals.push(...normal, ...normal, ...normal);
	}
	
	return normals;
}

const shapeArray = [
	 // Cube (+X, -X, +Y, -Y, +Z, -Z)
	 0.5, -0.5,  0.5,    0.5, -0.5, -0.5,    0.5,  0.5, -0.5,    0.5, -0.5,  0.5,    0.5,  0.5, -0.5,    0.5,  0.5,  0.5,
	-0.5, -0.5, -0.5,   -0.5, -0.5,  0.5,   -0.5,  0.5,  0.5,   -0.5, -0.5, -0.5,   -0.5,  0.5,  0.5,   -0.5,  0.5, -0.5,
	-0.5,  0.5,  0.5,    0.5,  0.5,  0.5,    0.5,  0.5, -0.5,   -0.5,  0.5,  0.5,    0.5,  0.5, -0.5,   -0.5,  0.5, -0.5,
	-0.5, -0.5, -0.5,    0.5, -0.5, -0.5,    0.5, -0.5,  0.5,   -0.5, -0.5, -0.5,    0.5, -0.5,  0.5,   -0.5, -0.5,  0.5,
	-0.5, -0.5,  0.5,    0.5, -0.5,  0.5,    0.5,  0.5,  0.5,   -0.5, -0.5,  0.5,    0.5,  0.5,  0.5,   -0.5,  0.5,  0.5,
	 0.5, -0.5, -0.5,   -0.5, -0.5, -0.5,   -0.5,  0.5, -0.5,    0.5, -0.5, -0.5,   -0.5,  0.5, -0.5,    0.5,  0.5, -0.5,

	 // Slanted cube (+X, -X, +Y, -Y, +Z, -Z)
	 0.5, -0.375, -0.5,    0.5,  0.625, -0.5,    0.5,  0.625,  0.5,    0.5, -0.375, -0.5,    0.5,  0.625,  0.5,    0.5,  0.125,  0.5,
	-0.5, -0.375, -0.5,   -0.5,  0.125,  0.5,   -0.5,  0.625,  0.5,   -0.5, -0.375, -0.5,   -0.5,  0.625,  0.5,   -0.5,  0.625, -0.5,
	-0.5,  0.625, -0.5,   -0.5,  0.625,  0.5,    0.5,  0.625,  0.5,   -0.5,  0.625, -0.5,    0.5,  0.625,  0.5,    0.5,  0.625, -0.5,
	-0.5, -0.375, -0.5,    0.5, -0.375, -0.5,    0.5,  0.125,  0.5,   -0.5, -0.375, -0.5,    0.5,  0.125,  0.5,   -0.5,  0.125,  0.5,
	-0.5,  0.125,  0.5,    0.5,  0.125,  0.5,    0.5,  0.625,  0.5,   -0.5,  0.125,  0.5,    0.5,  0.625,  0.5,   -0.5,  0.625,  0.5,
	-0.5, -0.375, -0.5,   -0.5,  0.625, -0.5,    0.5,  0.625, -0.5,   -0.5, -0.375, -0.5,    0.5,  0.625, -0.5,    0.5, -0.375, -0.5,

	 // Slanted cube (+X, -X, +Y, -Y, +Z, -Z)
	 0.5, -0.375, -0.5,    0.5,  0.625,  0.5,    0.5,  0.125,  0.5,    0.5, -0.375, -0.5,    0.5,  0.125, -0.5,    0.5,  0.625,  0.5,
	-0.5, -0.375, -0.5,   -0.5,  0.125,  0.5,   -0.5,  0.625,  0.5,   -0.5, -0.375, -0.5,   -0.5,  0.625,  0.5,   -0.5,  0.125, -0.5,
	-0.5,  0.125, -0.5,   -0.5,  0.625,  0.5,    0.5,  0.625,  0.5,   -0.5,  0.125, -0.5,    0.5,  0.625,  0.5,    0.5,  0.125, -0.5,
	-0.5, -0.375, -0.5,    0.5, -0.375, -0.5,    0.5,  0.125,  0.5,   -0.5, -0.375, -0.5,    0.5,  0.125,  0.5,   -0.5,  0.125,  0.5, 
	-0.5,  0.125,  0.5,    0.5,  0.125,  0.5,    0.5,  0.625,  0.5,   -0.5,  0.125,  0.5,    0.5,  0.625,  0.5,   -0.5,  0.625,  0.5, 
	-0.5, -0.375, -0.5,   -0.5,  0.125, -0.5,    0.5,  0.125, -0.5,   -0.5, -0.375, -0.5,    0.5,  0.125, -0.5,    0.5, -0.375, -0.5 
];

const cylinderVerts = makeUnitCylinder(8);
const cylinder16Verts = makeUnitCylinder(16);

const CUBE_OFFSET = 0;
const SLANT_OFFSET = 36;
const RAMP_OFFSET = 72;
const CYLINDER_OFFSET = (shapeArray.length / 3);
shapeArray.push(...cylinderVerts);
const CYLINDER16_OFFSET = (shapeArray.length / 3);
shapeArray.push(...cylinder16Verts);

const normalArray = generateNormals(shapeArray);

// shape interface
export default class Shape {
	static vBuffer = null;
	static vertexData = shapeArray;
	static vertexCount = 0;
	static vertexOffset = 0;

	static nBuffer = null;
	static normalData = normalArray;

	static initSharedBuffer() {
		if (this.vBuffer) return;
		if (!this.vertexData)
			throw new Error(`${this.name}: vertexData not defined`);

		const GL = window.GL;
		this.vBuffer = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuffer);
		GL.bufferData(
			GL.ARRAY_BUFFER,
			new Float32Array(this.vertexData),
			GL.STATIC_DRAW
		);

		this.nBuffer = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.nBuffer);
		GL.bufferData(
			GL.ARRAY_BUFFER,
			new Float32Array(this.normalData),
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
		window.GL.uniform4f(window.u_FragColor, r, g, b, a);
	}

	render() {
		this.setColour();
		const GL = window.GL;
		const C = this.constructor;

		GL.uniformMatrix4fv(
			window.u_ModelMatrix,
			false,
			this.transform.worldMatrix.elements
		);

		GL.bindBuffer(GL.ARRAY_BUFFER, C.vBuffer);
		GL.vertexAttribPointer(window.a_Position, 3, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);

		GL.bindBuffer(GL.ARRAY_BUFFER, C.nBuffer);
		GL.vertexAttribPointer(window.a_Normal, 3, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Normal);

		GL.drawArrays(GL.TRIANGLES, C.vertexOffset, C.vertexCount);
	}
}

export class Cube extends Shape {
	static vertexCount = 36;
	static vertexOffset = CUBE_OFFSET;
}

export class SlantedCube extends Cube {
	static vertexOffset = SLANT_OFFSET;
}

export class Ramp extends Cube {
	static vertexOffset = RAMP_OFFSET;
}

export class Cylinder extends Shape {
	static vertexCount = (cylinderVerts.length / 3);
	static vertexOffset = CYLINDER_OFFSET;
}

export class Cylinder16 extends Cylinder {
	static vertexCount = (cylinder16Verts.length / 3);
	static vertexOffset = CYLINDER16_OFFSET;
}
