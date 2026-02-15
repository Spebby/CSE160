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
  
	// build sides
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
  
	// bottom cap
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
	  
	// top cap
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

// Generates a UV mapping that matches blender's default Cylinder unwrap.
function makeUnitCylinderUV(radialSegments = 8) {
	const uvs = [];
	const capRadius = 0.24;

	const offset = -0.25;  // This matches Blender
	
	for (let i = 0; i < radialSegments; i++) {
		// No modulo - UVs will range from 1.25 to 0.25
		const u0 = 1.0 - (i / radialSegments) + offset;
		const u1 = 1.0 - ((i + 1) / radialSegments) + offset;
		
		uvs.push(
			u0, 0.5,
			u0, 0.0,
			u1, 0.0
		);
		
		uvs.push(
			u0, 0.5,
			u1, 0.0,
			u1, 0.5
		);
	}


	
	// Bottom cap - RIGHT circle
	for (let i = 0; i < radialSegments; i++) {
		const theta0 = (i / radialSegments) * Math.PI * 2;
		const theta1 = ((i + 1) / radialSegments) * Math.PI * 2;
		
		const u0 = 0.75 + capRadius * Math.cos(theta0);
		const v0 = 0.75 + capRadius * Math.sin(theta0);
		const u1 = 0.75 + capRadius * Math.cos(theta1);
		const v1 = 0.75 + capRadius * Math.sin(theta1);
		
		uvs.push(
			0.75, 0.75,
			u0, v0,
			u1, v1
		);
	}
	
	// Top cap - LEFT circle
	for (let i = 0; i < radialSegments; i++) {
		const theta0 = (i / radialSegments) * Math.PI * 2;
		const theta1 = ((i + 1) / radialSegments) * Math.PI * 2;
		
		const u0 = 0.25 + capRadius * Math.cos(theta0);
		const v0 = 0.75 + capRadius * Math.sin(theta0);
		const u1 = 0.25 + capRadius * Math.cos(theta1);
		const v1 = 0.75 + capRadius * Math.sin(theta1);
		
		uvs.push(
			0.25, 0.75,
			u1, v1,
			u0, v0
		);
	}
	
	return uvs;
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
	// Plane
	-0.5, 0.0, -0.5,  0.5, 0.0,  0.5,  0.5, 0.0, -0.5,   -0.5, 0.0, -0.5, -0.5, 0.0,  0.5,  0.5, 0.0,  0.5,

	 // Cube (+X, -X, +Y, -Y, +Z, -Z)
	 0.5,-0.5,-0.5,0.5,-0.5,0.5,-0.5,-0.5,0.5,0.5,0.5,-0.5,0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,0.5,0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,0.5,0.5,0.5,0.5,-0.5,0.5,0.5,0.5,0.5,0.5,0.5,-0.5,-0.5,0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,0.5,0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,-0.5,0.5,0.5,0.5,-0.5,0.5,-0.5,-0.5,0.5,0.5,0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,-0.5,0.5,0.5,0.5,-0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,0.5,0.5,-0.5,0.5,0.5,

	// Slanted cube (+X, -X, +Y, -Y, +Z, -Z)
	-0.5,0.125,0.5,0.5,-0.375,-0.5,0.5,0.125,0.5,0.5,0.125,0.5,0.5,0.625,-0.5,0.5,0.625,0.5,-0.5,0.625,-0.5,-0.5,0.125,0.5,-0.5,0.625,0.5,0.5,0.625,-0.5,-0.5,0.625,0.5,0.5,0.625,0.5,-0.5,0.625,0.5,0.5,0.125,0.5,0.5,0.625,0.5,0.5,-0.375,-0.5,-0.5,0.625,-0.5,0.5,0.625,-0.5,-0.5,0.125,0.5,-0.5,-0.375,-0.5,0.5,-0.375,-0.5,0.5,0.125,0.5,0.5,-0.375,-0.5,0.5,0.625,-0.5,-0.5,0.625,-0.5,-0.5,-0.375,-0.5,-0.5,0.125,0.5,0.5,0.625,-0.5,-0.5,0.625,-0.5,-0.5,0.625,0.5,-0.5,0.625,0.5,-0.5,0.125,0.5,0.5,0.125,0.5,0.5,-0.375,-0.5,-0.5,-0.375,-0.5,-0.5,0.625,-0.5,

	// Ramp (+X, -X, +Y, -Y, +Z, -Z)
	0.5,-0.375,-0.5,0.5,0.625,0.5,0.5,0.125,0.5,0.5,-0.375,-0.5,0.5,0.125,-0.5,0.5,0.625,0.5,-0.5,-0.375,-0.5,-0.5,0.125,0.5,-0.5,0.625,0.5,-0.5,-0.375,-0.5,-0.5,0.625,0.5,-0.5,0.125,-0.5,-0.5,0.125,-0.5,-0.5,0.625,0.5,0.5,0.625,0.5,-0.5,0.125,-0.5,0.5,0.625,0.5,0.5,0.125,-0.5,-0.5,-0.375,-0.5,0.5,-0.375,-0.5,0.5,0.125,0.5,-0.5,-0.375,-0.5,0.5,0.125,0.5,-0.5,0.125,0.5,-0.5,0.125,0.5,0.5,0.125,0.5,0.5,0.625,0.5,-0.5,0.125,0.5,0.5,0.625,0.5,-0.5,0.625,0.5,-0.5,-0.375,-0.5,-0.5,0.125,-0.5,0.5,0.125,-0.5,-0.5,-0.375,-0.5,0.5,0.125,-0.5,0.5,-0.375,-0.5
];

let uvArray= [
	// Plane
	1.0, 1.0,  0.0, 0.0,  0.0, 1.0,
	1.0, 1.0,  1.0, 0.0,  0.0, 0.0,

	// Cube (+X, -X, +Y, -Y, +Z, -Z)
	0.625,0.5,0.625,0.25,0.375,0.25,0.625,0.75,0.625,0.5,0.375,0.5,0.375,0.5,0.125,0.25,0.125,0.5,0.875,0.5,0.875,0.25,0.625,0.25,0.625,1,0.625,0.75,0.375,0.75,0.375,0.5,0.375,0.25,0.125,0.25,0.875,0.5,0.625,0.25,0.625,0.5,0.625,1,0.375,0.75,0.375,1,0.625,0.25,0.375,0,0.375,0.25,0.625,0.75,0.375,0.5,0.375,0.75,0.625,0.5,0.375,0.25,0.375,0.5,0.625,0.25,0.625,0,0.375,0,

	// Slant (+X, -X, +Y, -Y, +Z, -Z)
	0.650503,0.999033,0.37631,0.689513,0.374837,0.997716,0.24111,0.13752299999999995,0.377626,0.41384699999999996,0.378943,0.138181,0.653292,0.415164,0.792441,0.14015599999999995,0.654609,0.139498,0.377626,0.41384699999999996,0.654609,0.139498,0.378943,0.138181,0.654609,0.139498,0.379601,0.00034800000000001496,0.378943,0.138181,0.37631,0.689513,0.653292,0.415164,0.377626,0.41384699999999996,0.650503,0.999033,0.651975,0.690829,0.37631,0.689513,0.24111,0.13752299999999995,0.101961,0.41252999999999995,0.377626,0.41384699999999996,0.653292,0.415164,0.928958,0.41647999999999996,0.792441,0.14015599999999995,0.377626,0.41384699999999996,0.653292,0.415164,0.654609,0.139498,0.654609,0.139498,0.655267,0.0016650000000000276,0.379601,0.00034800000000001496,0.37631,0.689513,0.651975,0.690829,0.653292,0.415164,

	// Ramp (+X, -X, +Y, -Y, +Z, -Z)1
	0.207364,0.569088,0.345539,0.15456099999999995,0.207363,0.223649,0.207364,0.569088,0.345539,0.5,0.345539,0.15456099999999995,0.792684,0.569088,0.792684,0.223649,0.654509,0.15456099999999995,0.792684,0.569088,0.654509,0.15456099999999995,0.654509,0.5,0.654509,0.5,0.654509,0.15456099999999995,0.345539,0.15456099999999995,0.654509,0.5,0.345539,0.15456099999999995,0.345539,0.5,0.654509,0.654485,0.345539,0.654485,0.345539,0.999923,0.654509,0.654485,0.345539,0.999923,0.654509,0.999923,0.654509,0.00007699999999999374,0.345539,0.00007699999999999374,0.345539,0.15456099999999995,0.654509,0.00007699999999999374,0.345539,0.15456099999999995,0.654509,0.15456099999999995,0.654509,0.654485,0.654509,0.5,0.345539,0.5,0.654509,0.654485,0.345539,0.5,0.345539,0.654485
];

const cylinderVerts = makeUnitCylinder(8);
const cylinder16Verts = makeUnitCylinder(16);

const PLANE_OFFSET = 0;
const CUBE_OFFSET = 6 + PLANE_OFFSET;
const SLANT_OFFSET = 36 + CUBE_OFFSET;
const RAMP_OFFSET = 36 + SLANT_OFFSET;
const CYLINDER_OFFSET = (shapeArray.length / 3);
shapeArray.push(...cylinderVerts);
const CYLINDER16_OFFSET = (shapeArray.length / 3);
shapeArray.push(...cylinder16Verts);

uvArray.push(...makeUnitCylinderUV(8));
uvArray.push(...makeUnitCylinderUV(16));

const normalArray = generateNormals(shapeArray);

// shape interface
export default class Shape {
	static vBuffer = null;
	static vertexData = null;
	static vertexCount = 0;
	static vertexOffset = 0;

	static nBuffer = null;
	static normalData = null;

	static uvBuffer = null;
	static uvData = null;

	alphaCutout = 0.0;

	// global state tracking for overrides
	static glState = {
		cullFace: true,
		cullFaceMode: window.GL?.BACK,
		depthTest: true,
		depthMask: true,
		blend: true,
		blendSrc: window.GL?.SRC_ALPHA,
		blendDst: window.GL?.ONE_MINUS_SRC_ALPHA,
	};

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
	 * @param {boolean} clipAlpha - Should rendering use alpha clipping?
	 * @param {string|null} texturePath - Optional texture path
	 * @param {MaterialProperties} material - Material settings
	 */
	constructor(transform, tint, clipAlpha = false, texturePath = null, material = null) {
		this.transform = transform;
		if (!transform) {
			this.transform = new Transform();
		}
		this.tint = tint;
		this.texture = null;
		this.textureLoaded = false;
		this.alphaCutout = clipAlpha;
	
		// Per-instance GL state overrides (null = use current state)
		this.glStateOverrides = {
			cullFace: null,
			cullFaceMode: null,
			depthTest: null,
			depthMask: null,
			blend: null,
			blendSrc: null,
			blendDst: null,
		};

		this.shininess = 32.0;
		this.specularStrength = 0.3;
		this.rimStrength = 0.2;
		this.UVScale = [1.0, 1.0];
		this.setMaterial(material);

		this.constructor.initSharedBuffer();
		
		if (texturePath) {
			this.loadTexture(texturePath);
		}
	}

	setTint() {
		const [r, g, b, a] = this.tint;
		window.GL.uniform4f(window.u_FragColor, r, g, b, a);
	}

	setMaterial(props) {
		if (!props) return this;
		if (props.shininess !== undefined) this.shininess = props.shininess;
		if (props.specularStrength !== undefined) this.specularStrength = props.specularStrength;
		if (props.rimStrength !== undefined) this.rimStrength = props.rimStrength;
		if (props.UVScale !== undefined) this.UVScale = props.UVScale;
		return this;
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
		const prevState = this._applyGLState();
		this.setTint();
		const GL = window.GL;
		const C = this.constructor;

		GL.uniform1f(window.u_Shininess, this.shininess);
		GL.uniform1f(window.u_SpecularStrength, this.specularStrength);
		GL.uniform1f(window.u_RimStrength, this.rimStrength);
		GL.uniform2f(window.u_UVScale, ...this.UVScale);
		
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
		GL.uniform1i(window.u_AlphaCutout, this.alphaCutout);
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
		this._restoreGLState(prevState);
	}

	setGLState(overrides) {
		Object.assign(this.glStateOverrides, overrides);
		return this;
	}

	_applyGLState() {
		const GL = window.GL;
		const S = Shape.glState;
		const O = this.glStateOverrides;
		const prev = {};

		if (O.cullFace !== null && O.cullFace !== S.cullFace) {
			prev.cullFace = S.cullFace;
			O.cullFace ? GL.enable(GL.CULL_FACE) : GL.disable(GL.CULL_FACE);
			S.cullFace = O.cullFace;
		}

		if (O.cullFaceMode !== null && O.cullFaceMode !== S.cullFaceMode) {
			prev.cullFaceMode = S.cullFaceMode;
			GL.cullFace(O.cullFaceMode);
			S.cullFaceMode = O.cullFaceMode;
		}

		if (O.depthTest !== null && O.depthTest !== S.depthTest) {
			prev.depthTest = S.depthTest;
			O.depthTest ? GL.enable(GL.DEPTH_TEST) : GL.disable(GL.DEPTH_TEST);
			S.depthTest = O.depthTest;
		}

		if (O.depthMask !== null && O.depthMask !== S.depthMask) {
			prev.depthMask = S.depthMask;
			GL.depthMask(O.depthMask);
			S.depthMask = O.depthMask;
		}

		if (O.blend !== null && O.blend !== S.blend) {
			prev.blend = S.blend;
			O.blend ? GL.enable(GL.BLEND) : GL.disable(GL.BLEND);
			S.blend = O.blend;
		}

		if (O.blendSrc !== null && O.blendDst !== null && 
		    (O.blendSrc !== S.blendSrc || O.blendDst !== S.blendDst)) {
			prev.blendSrc = S.blendSrc;
			prev.blendDst = S.blendDst;
			GL.blendFunc(O.blendSrc, O.blendDst);
			S.blendSrc = O.blendSrc;
			S.blendDst = O.blendDst;
		}

		return prev;
	}

	_restoreGLState(prev) {
		const GL = window.GL;
		const S = Shape.glState;

		if (prev.cullFace !== undefined && prev.cullFace !== S.cullFace) {
			prev.cullFace ? GL.enable(GL.CULL_FACE) : GL.disable(GL.CULL_FACE);
			S.cullFace = prev.cullFace;
		}

		if (prev.cullFaceMode !== undefined && prev.cullFaceMode !== S.cullFaceMode) {
			GL.cullFace(prev.cullFaceMode);
			S.cullFaceMode = prev.cullFaceMode;
		}

		if (prev.depthTest !== undefined && prev.depthTest !== S.depthTest) {
			prev.depthTest ? GL.enable(GL.DEPTH_TEST) : GL.disable(GL.DEPTH_TEST);
			S.depthTest = prev.depthTest;
		}

		if (prev.depthMask !== undefined && prev.depthMask !== S.depthMask) {
			GL.depthMask(prev.depthMask);
			S.depthMask = prev.depthMask;
		}

		if (prev.blend !== undefined && prev.blend !== S.blend) {
			prev.blend ? GL.enable(GL.BLEND) : GL.disable(GL.BLEND);
			S.blend = prev.blend;
		}

		if (prev.blendSrc !== undefined && prev.blendDst !== undefined &&
		    (prev.blendSrc !== S.blendSrc || prev.blendDst !== S.blendDst)) {
			GL.blendFunc(prev.blendSrc, prev.blendDst);
			S.blendSrc = prev.blendSrc;
			S.blendDst = prev.blendDst;
		}
	}

	/**
	 * Create a clone that shares buffers but has unique transform and color
	 * @param {Transform|null} transform - New transform (or null for default)
	 * @param {Array<number>|null} colour - New color (or null to copy original)
	 * @returns {Shape}
	 */
	clone(transform = null, colour = null) {
		const clone = Object.create(Shape.prototype);
		
		// unique properties
		clone.transform = transform || this.transform.clone();
		clone.tint = colour || this.tint.slice();
		clone.shininess = this.shininess;
		clone.specularStrength = this.specularStrength;
		clone.rimStrength = this.rimStrength;
		clone.UVScale = this.UVScale;
		clone.isClone = true;
		
		// share buffers
		clone.vBuffer = this.vBuffer;
		clone.nBuffer = this.nBuffer;
		clone.uvBuffer = this.uvBuffer;
		clone.vertexCount = this.vertexCount;
		clone.vertexOffset = this.vertexOffset || 0;
		clone.texture = this.texture;
		clone.textureLoaded = this.textureLoaded;
		clone.glStateOverrides = this.glStateOverrides;
		
		return clone;
	}

	destroy() {
		// clones don't own the buffers
		if (this.isClone) return;
		
		const GL = window.GL;
		if (this.vBuffer)  GL.deleteBuffer(this.vBuffer);
		if (this.nBuffer)  GL.deleteBuffer(this.nBuffer);
		if (this.uvBuffer) GL.deleteBuffer(this.uvBuffer);
		if (this.texture)  GL.deleteTexture(this.texture);
	}
}

export class Plane extends Shape {
	static vertexData = shapeArray;
	static vertexCount = 6;
	static vertexOffset = PLANE_OFFSET;
	static normalData = normalArray;
	static uvData = uvArray;
}

export class Cube extends Shape {
	static vertexData = shapeArray;
	static vertexCount = 36;
	static vertexOffset = CUBE_OFFSET;
	static normalData = normalArray;
	static uvData = uvArray;
}

export class SlantedCube extends Cube {
	static vertexOffset = SLANT_OFFSET;
}

export class Ramp extends Cube {
	static vertexOffset = RAMP_OFFSET;
}

export class Cylinder extends Shape {
	static vertexData = shapeArray;
	static vertexCount = (cylinderVerts.length / 3);
	static vertexOffset = CYLINDER_OFFSET;
	static normalData = normalArray;
	static uvData = uvArray;
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
	 * @param {boolean} clipAlpha
	 * @param {Float32Array|Array} vertexData - Vertex positions [x,y,z, x,y,z, ...]
	 * @param {Float32Array|Array} normalData - Normals [x,y,z, x,y,z, ...]
	 * @param {Float32Array|Array|null} uvData - UV coords [u,v, u,v, ...] (optional)
	 * @param {string|null} texturePath - Optional texture path
	 */
	constructor(transform, colour, clipAlpha, vertexData, normalData, uvData = null, texturePath = null) {
		super(transform, colour, clipAlpha, texturePath);
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
}
