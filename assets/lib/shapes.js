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

	static uvBuffer = null;
	static uvData = null;

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

		// UV coordinates (if available)
		if (this.uvData) {
			this.uvBuffer = GL.createBuffer();
			GL.bindBuffer(GL.ARRAY_BUFFER, this.uvBuffer);
			GL.bufferData(
				GL.ARRAY_BUFFER,
				new Float32Array(this.uvData),
				GL.STATIC_DRAW
			);
		}
	}

	/**
	 * @param {Transform} transform
	 * @param {Array<number>} tint - RGBA color
	 * @param {string|null} texturePath - Optional texture path
	 */
	constructor(transform, tint, texturePath = null) {
		this.transform = transform;
		if (!transform) {
			this.transform = new Transform();
		}
		this.tint = tint;
		this.texture = null;
		this.textureLoaded = false;
		
		this.constructor.initSharedBuffer();
		
		if (texturePath) {
			this.loadTexture(texturePath);
		}
	}

	setTint() {
		const [r, g, b, a] = this.tint;
		window.GL.uniform4f(window.u_FragColor, r, g, b, a);
	}

	/**
	 * Load a texture from an image file
	 * @param {string} path - Path to image file
	 */
	loadTexture(path) {
		const GL = window.GL;
		this.texture = GL.createTexture();
		
		// Create a 1x1 placeholder pixel until image loads
		GL.bindTexture(GL.TEXTURE_2D, this.texture);
		GL.texImage2D(
			GL.TEXTURE_2D,
			0,
			GL.RGBA,
			1, 1, 0,
			GL.RGBA,
			GL.UNSIGNED_BYTE,
			new Uint8Array([255, 0, 255, 255]) // Magenta placeholder
		);
		
		const image = new Image();
		image.onload = () => {
			GL.bindTexture(GL.TEXTURE_2D, this.texture);
			GL.texImage2D(
				GL.TEXTURE_2D,
				0,
				GL.RGBA,
				GL.RGBA,
				GL.UNSIGNED_BYTE,
				image
			);
			
			// Check if image is power of 2
			if (this.isPowerOf2(image.width) && this.isPowerOf2(image.height)) {
				GL.generateMipmap(GL.TEXTURE_2D);
			} else {
				GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
				GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
				GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
			}
			
			this.textureLoaded = true;
		};
		image.onerror = () => {
			console.error(`Failed to load texture: ${path}`);
		};
		image.src = path;
	}

	isPowerOf2(value) {
		return (value & (value - 1)) === 0;
	}

	render() {
		this.setTint();
		const GL = window.GL;
		const C = this.constructor;
		
		// Use instance properties if they exist (Mesh), otherwise use static (Cube, etc.)
		const vBuffer = this.vBuffer ?? C.vBuffer;
		const nBuffer = this.nBuffer ?? C.nBuffer;
		const uvBuffer = this.uvBuffer ?? C.uvBuffer;
		const vertexCount = this.vertexCount ?? C.vertexCount;
		const vertexOffset = this.vertexOffset ?? C.vertexOffset;
		
		GL.uniformMatrix4fv(
			window.u_ModelMatrix,
			false,
			this.transform.worldMatrix.elements
		);
		
		// Bind vertex positions
		GL.bindBuffer(GL.ARRAY_BUFFER, vBuffer);
		GL.vertexAttribPointer(window.a_Position, 3, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		
		// Bind normals
		GL.bindBuffer(GL.ARRAY_BUFFER, nBuffer);
		GL.vertexAttribPointer(window.a_Normal, 3, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Normal);
		
		// Bind texture if available
		if (this.texture && this.textureLoaded && uvBuffer) {
			GL.activeTexture(GL.TEXTURE0);
			GL.bindTexture(GL.TEXTURE_2D, this.texture);
			GL.uniform1i(window.u_Sampler, 0);
			GL.uniform1i(window.u_UseTexture, 1);
			
			GL.bindBuffer(GL.ARRAY_BUFFER, uvBuffer);
			GL.vertexAttribPointer(window.a_TexCoord, 2, GL.FLOAT, false, 0, 0);
			GL.enableVertexAttribArray(window.a_TexCoord);
		} else {
			GL.uniform1i(window.u_UseTexture, 0);
		}
		
		GL.drawArrays(GL.TRIANGLES, vertexOffset, vertexCount);
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

export class Mesh extends Shape {
	// Override static properties - Mesh doesn't use shared buffers
	static initSharedBuffer() {
		// No-op for Mesh - it uses instance buffers
	}
	
	/**
	 * @param {Transform|null} transform
	 * @param {Array<number>} colour
	 * @param {Float32Array|Array} vertexData - Vertex positions [x,y,z, x,y,z, ...]
	 * @param {Float32Array|Array} normalData - Normals [x,y,z, x,y,z, ...]
	 * @param {Float32Array|Array|null} uvData - UV coords [u,v, u,v, ...] (optional)
	 * @param {string|null} texturePath - Optional texture path
	 */
	constructor(transform, colour, vertexData, normalData, uvData = null, texturePath = null) {
		super(transform, colour, texturePath);
		this.vertexCount = vertexData.length / 3;
		
		const GL = window.GL;
		
		// Create vertex buffer
		this.vBuffer = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuffer);
		GL.bufferData(
			GL.ARRAY_BUFFER,
			new Float32Array(vertexData),
			GL.STATIC_DRAW
		);
		
		// Create normal buffer
		this.nBuffer = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.nBuffer);
		GL.bufferData(
			GL.ARRAY_BUFFER,
			new Float32Array(normalData),
			GL.STATIC_DRAW
		);
		
		// Create UV buffer if provided
		if (uvData) {
			this.uvBuffer = GL.createBuffer();
			GL.bindBuffer(GL.ARRAY_BUFFER, this.uvBuffer);
			GL.bufferData(
				GL.ARRAY_BUFFER,
				new Float32Array(uvData),
				GL.STATIC_DRAW
			);
		}
	}

	// Cleanup method for when mesh is destroyed
	destroy() {
		const GL = window.GL;
		if (this.vBuffer) GL.deleteBuffer(this.vBuffer);
		if (this.nBuffer) GL.deleteBuffer(this.nBuffer);
		if (this.uvBuffer) GL.deleteBuffer(this.uvBuffer);
		if (this.texture) GL.deleteTexture(this.texture);
	}
}
