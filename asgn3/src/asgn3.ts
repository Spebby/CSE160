/// <reference types="stats.js" />

import { Cube, Mesh } from '../../assets/lib/shapes.js';
import { AnimMan } from '../../assets/lib/animation.js';
import Transform from '../../assets/lib/transform.js';
import Camera, { CameraMode } from '../../assets/lib/camera.js';
import Anteater from './anteater.js';
import LoadOBJ from './objloader.js';

// Vertex shader program
const VSHADER_SOURCE = `
	attribute vec4 a_Position;
	attribute vec4 a_Normal;
	attribute vec2 a_TexCoord;
	
	uniform mat4 u_ModelMatrix;
	uniform mat4 u_GlobalRotation;
	uniform mat4 u_ProjectionMatrix;
	
	varying vec3 v_Normal;
	varying vec3 v_FragPos;
	varying vec2 v_TexCoord;
	
	void main() {
		vec4 worldPos = u_ModelMatrix * a_Position;
		v_FragPos = worldPos.xyz;
		v_Normal = mat3(u_ModelMatrix) * a_Normal.xyz;
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * worldPos;
		v_TexCoord = a_TexCoord;
	}`;

// Fragment shader program
const FSHADER_SOURCE = `
	precision mediump float;
	
	varying vec3 v_Normal;
	varying vec3 v_FragPos;
	varying vec2 v_TexCoord;
	
	uniform vec4 u_FragColor;
	uniform sampler2D u_Sampler;
	uniform int u_UseTexture;
	
	const vec3 lightDir = normalize(vec3(10.0, 20.0, 10.0));
	const vec3 ambientColor = vec3(0.1, 0.1, 0.1);
	const vec3 diffuseColor = vec3(0.4, 0.4, 0.4);
	const float screenGamma = 2.2;
	
	void main() {
		vec3 normal = normalize(v_Normal);
		float lambertian = max(dot(normal, lightDir), 0.0);
		vec3 colourLinear = ambientColor + diffuseColor * lambertian;
		vec3 colourGammaCorrected = pow(colourLinear, vec3(1.0 / screenGamma));
		
		if (u_UseTexture == 1) {
			vec4 texColor = texture2D(u_Sampler, v_TexCoord);
			gl_FragColor = texColor * vec4(colourGammaCorrected * u_FragColor.rgb, 1.0);
		} else {
			gl_FragColor = vec4(colourGammaCorrected * u_FragColor.rgb, 1.0);
		}
	}`;

let canvas: HTMLCanvasElement;
let GL: WebGLRenderingContext;
let W: number, H: number, HW: number, HH: number;
let START_TIME = performance.now() / 1000.0;
let CAMERA: Camera;
let ANTEATER: Anteater;
let ANT_ANIM: AnimMan;
let gun: Mesh;
let DEBUG: boolean;
let stats = new Stats();
stats.dom.style.left = "auto";
stats.dom.style.right = "0";
stats.showPanel(0);
document.body.appendChild(stats.dom);

async function main(): Promise<void> {
	setupWebGL();
	connectVariablesToGLSL();

	gun = await LoadOBJ('./mp5.obj', './albedo.png');
	gun.transform.setScale(1, 1, 1);
	const response = await fetch('../../assets/data/animation.json');
	const animations = await response.json();

	ANTEATER = new Anteater(new Transform([0,0,0], [0,0,0], [0.35,0.35,0.35]));
	ANT_ANIM = new AnimMan(ANTEATER.bones, animations);
	ANT_ANIM.queueAnim('idle');
	
	// Initialize camera with Transforms
	const cameraTransform = new Transform([0, 0, 0], [0, 0, 0], [1, 1, 1]);
	CAMERA = new Camera(cameraTransform, ANTEATER.cameraFocus, CameraMode.FREE);
	CAMERA.distance = 6;
	CAMERA.moveSpeed = 10;
	DEBUG = false;

	setupListeners();

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

function setupListeners(): void {
	window.addEventListener('keydown', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = true;
		if (env.key === 'Escape') {
			CAMERA.isDragging = false;
		}
	});
	
	window.addEventListener('keyup', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = false;
	});

	canvas.addEventListener('mousedown', function(env) {
		CAMERA.isDragging = true;
		CAMERA.lastMouseX = env.clientX;
		CAMERA.lastMouseY = env.clientY;


		if (env.shiftKey) {
			// idk what to do with this but maybe something
		}

		// place blocks n' stuff
		// raycast for block placement
		
	});


	canvas.addEventListener('mouseleave', function(env) { CAMERA.isDragging = false; });

	canvas.addEventListener('mousemove', function(env) {
		if (!CAMERA.isDragging) return;
		const deltaX = env.clientX - CAMERA.lastMouseX;
		const deltaY = env.clientY - CAMERA.lastMouseY;
		
		CAMERA.handleMouseDrag(deltaX, deltaY);
		CAMERA.lastMouseX = env.clientX;
		CAMERA.lastMouseY = env.clientY;
	});

	canvas.addEventListener('wheel', function(env) {
		
	});

    canvas.addEventListener('contextmenu', function(env) {
        env.preventDefault();
    });
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

	const tTexCoord = GL.getAttribLocation(GL.program!, 'a_TexCoord');
	if (tTexCoord < 0) {
		console.log('Failed to get storage location of a_TexCoord');
		// no return, textures are optional
	}
	window.a_TexCoord = tTexCoord;

	const tCol = GL.getUniformLocation(GL.program!, 'u_FragColor');
	if (!tCol) {
		console.log('Failed to get storage location of u_FragColor');
		return;
	}
	window.u_FragColor = tCol;

	const uSampler = GL.getUniformLocation(GL.program!, 'u_Sampler');
	if (!uSampler) {
		console.log('Failed to get storage location of u_Sampler');
		// no return textures are optional
	}
	window.u_Sampler = uSampler;

	const uUseTexture = GL.getUniformLocation(GL.program!, 'u_UseTexture');
	if (!uUseTexture) {
		console.log('Failed to get storage location of u_UseTexture');
		// no return - textures are optional
	}
	window.u_UseTexture = uUseTexture;
	GL.uniform1i(window.u_UseTexture, 0); // default to no texture

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

	stats.begin();

	CAMERA.update(dt);
	const viewMatrix = CAMERA.getViewMatrix();
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, viewMatrix.elements);

	dispatchAnimations(dt);
	renderAllShapes(dt);

	stats.end();
	requestAnimationFrame(tick);

	if (DEBUG) {
		//
	}
}

function dispatchAnimations(dt: number): void {
	ANT_ANIM.update(dt);
}

function renderAllShapes(dt: number): void {
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
	
	// Example: render a spinning cube
	const cubeTransform = new Transform([0, 0, -5], [dt * 20, dt * 30, 0], [1, 1, 1]);
	const cube = new Cube(cubeTransform, [1.0, 0.5, 0.2, 1.0]);
	ANTEATER.render();
	cube.render();
	gun.render();
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
