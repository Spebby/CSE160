// Asgn3.ts - TypeScript Starter
import { Cube } from '../../assets/lib/shapes.js';
import Transform from '../../assets/lib/transform.js';

// Vertex shader program
const VSHADER_SOURCE = `
	attribute vec4 a_Position;
	attribute vec4 a_Normal;

	uniform mat4 u_ModelMatrix;
	uniform mat4 u_GlobalRotation;
	uniform mat4 u_ProjectionMatrix;

	varying vec3 v_Normal;
	varying vec3 v_FragPos;

	void main() {
		vec4 worldPos = u_ModelMatrix * a_Position;
		v_FragPos = worldPos.xyz;
		v_Normal = mat3(u_ModelMatrix) * a_Normal.xyz;
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * worldPos;
	}`;

// Fragment shader program
const FSHADER_SOURCE = `
	precision mediump float;

	varying vec3 v_Normal;
	varying vec3 v_FragPos;

	uniform vec4 u_FragColor;

	const vec3 lightDir = normalize(vec3(10.0, 20.0, 10.0));
	const vec3 ambientColor = vec3(0.1, 0.1, 0.1);
	const vec3 diffuseColor = vec3(0.4, 0.4, 0.4);

	const float screenGamma = 2.2;

	void main() {
		vec3 normal = normalize(v_Normal);
		float lambertian = max(dot(normal, lightDir), 0.0);
		vec3 colorLinear = ambientColor + diffuseColor * lambertian;
		vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0 / screenGamma));
		gl_FragColor = vec4(colorGammaCorrected * u_FragColor.rgb, 1.0);
	}`;

let canvas: HTMLCanvasElement;
let GL: WebGLRenderingContext;
let W: number, H: number, HW: number, HH: number;
let START_TIME = performance.now() / 1000.0;

let FOV: number;

const MOVE_SPEED = 10;

let cameraPositionX = 0;
let cameraPositionY = 2;
let cameraPositionZ = 5;
let cameraAngleX = 0;
let cameraAngleY = 0;

let mouseSensitivity = 0.2;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

let invX = false;
let invY = false;

async function main(): Promise<void> {
	setupWebGL();
	connectVariablesToGLSL();
	
	GL.clearColor(0.0, 0.0, 0.0, 1.0);
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

	resizeCanvas();
	requestAnimationFrame(tick);
}

function setupWebGL(): void {
	canvas = document.getElementById('webgl') as HTMLCanvasElement;
	if (!canvas) {
		console.log('Failed to retrieve the <canvas> element');
		return;
	}

	GL = canvas.getContext("webgl", { preserveDrawingBuffer: true }) as WebGLRenderingContext;
	if (!GL) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	GL.enable(GL.CULL_FACE);
	GL.cullFace(GL.BACK);
	GL.enable(GL.DEPTH_TEST);
	GL.enable(GL.BLEND);
	GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);

	window.GL = GL;
	window.addEventListener('resize', resizeCanvas);
}

function connectVariablesToGLSL(): void {
	if (!initShaders(GL, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to init shaders.');
		return;
	}

	const tPos = GL.getAttribLocation(GL.program!, 'a_Position');
	if (tPos < 0) {
		console.log('Failed to get storage location of a_Position');
		return;
	}
	window.a_Position = tPos;

	const tNor = GL.getAttribLocation(GL.program!, 'a_Normal');
	if (tNor < 0) {
		console.log('Failed to get storage location of a_Normal');
		return;
	}
	window.a_Normal = tNor;

	const tCol = GL.getUniformLocation(GL.program!, 'u_FragColor');
	if (!tCol) {
		console.log('Failed to get storage location of u_FragColor');
		return;
	}
	window.u_FragColor = tCol;

	const tMod = GL.getUniformLocation(GL.program!, 'u_ModelMatrix');
	if (!tMod) {
		console.log('Failed to get storage location of u_ModelMatrix');
		return;
	}
	window.u_ModelMatrix = tMod;
	const identityMatrix = new Matrix4();
	GL.uniformMatrix4fv(window.u_ModelMatrix, false, identityMatrix.elements);

	const tGol = GL.getUniformLocation(GL.program!, 'u_GlobalRotation');
	if (!tGol) {
		console.log('Failed to get storage location of u_GlobalRotation');
		return;
	}
	window.u_GlobalRotation = tGol;
	const globalRotation = new Matrix4();
	globalRotation.setIdentity();
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, globalRotation.elements);

	const tProj = GL.getUniformLocation(GL.program!, 'u_ProjectionMatrix');
	if (!tProj) {
		console.log('Failed to get storage location of u_ProjectionMatrix');
		return;
	}
	window.u_ProjectionMatrix = tProj;
}

function tick(): void {
	const now = performance.now();
	const dt = (now - START_TIME) / 1000;
	START_TIME = now;

	renderAllShapes(dt);
	requestAnimationFrame(tick);
}

function renderAllShapes(dt: number): void {
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
	
	// Example: render a spinning cube
	const cubeTransform = new Transform([0, 0, -5], [dt * 20, dt * 30, 0], [1, 1, 1]);
	const cube = new Cube(cubeTransform, [1.0, 0.5, 0.2, 1.0]);
	cube.render();
}

function resizeCanvas(): void {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;

	canvas.width = Math.round(rect.width * dpr);
	canvas.height = Math.round(rect.height * dpr);

	W = canvas.width;
	H = canvas.height;

	GL.viewport(0, 0, W, H);
	updateProjMatrix();
}

function updateProjMatrix(): void {
	const projMatrix = new Matrix4();
	const aspect = W / H;
	projMatrix.setPerspective(70, aspect, 0.05, 100);
	GL.uniformMatrix4fv(window.u_ProjectionMatrix, false, projMatrix.elements);
}

// Start the application
main();
