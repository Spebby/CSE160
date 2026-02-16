/// <reference types="stats.js" />

import Shape, { Plane, Cube, Prism, Mesh, MaterialProperties } from '../../assets/lib/shapes.js';
import Transform from '../../assets/lib/transform.js';
import Camera, { CameraMode } from '../../assets/lib/camera.js';
import Anteater from './anteater.js';
import LoadOBJ from './objloader.js';
import GameGrid from './gamegrid.js';
import MushroomMan from './mushroomman.js';
import Tween from './tween.js';

const WORLD_EDGE: number = 128.0;

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
	uniform vec2 u_UVScale;
	
	void main() {
		vec4 worldPos = u_ModelMatrix * a_Position;
		v_FragPos = worldPos.xyz;
		v_Normal = mat3(u_ModelMatrix) * a_Normal.xyz;
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * worldPos;
		v_TexCoord = a_TexCoord * u_UVScale;
	}`;

const skyColor: [number, number, number] = [0.388, 0.753, 0.925];

// Fragment shader program
const FSHADER_SOURCE = `
	precision mediump float;
	varying vec3 v_Normal;
	varying vec3 v_FragPos;
	varying vec2 v_TexCoord;
	
	uniform vec4 u_FragColor;
	uniform sampler2D u_Sampler;
	uniform int u_UseTexture;
	uniform float u_AlphaCutout;
	uniform vec3 u_CameraPos;
	
	// material properties
	uniform float u_Shininess;
	uniform float u_SpecularStrength;
	uniform float u_RimStrength;

	// fog
	uniform vec3 u_FogColor;
	uniform float u_FogStart;
	uniform float u_FogEnd;
	
	const vec3 sunDir = normalize(vec3(10.0, 20.0, 10.0));
	const vec3 sunColor = vec3(1.0, 0.98, 0.95);
	const float sunStrength = 0.95;
	const vec3 skyAmbient = vec3(0.2, 0.3, 0.4);
	const vec3 groundAmbient = vec3(0.15, 0.12, 0.1);
	const float screenGamma = 2.2;
	const float rimPower = 3.0;
	const vec3 rimColor = vec3(0.5, 0.6, 0.8);
	
	void main() {
		vec4 baseColor = u_FragColor;
		
		if (u_UseTexture == 1) {
			baseColor *= texture2D(u_Sampler, v_TexCoord);
		}
		
		if (baseColor.a < u_AlphaCutout) {
			discard;
		}
		
		vec3 normal = normalize(v_Normal);
		float up = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
		vec3 ambient = mix(groundAmbient, skyAmbient, up);
		
		float lambertian = max(dot(normal, sunDir), 0.0);
		vec3 diffuse = sunColor * sunStrength * lambertian;
		
		vec3 viewDir = normalize(u_CameraPos - v_FragPos);
		vec3 halfDir = normalize(sunDir + viewDir);
		float NdotH = max(dot(normal, halfDir), 0.0);
		float specular = pow(NdotH, u_Shininess) * u_SpecularStrength * lambertian;
		vec3 specularLight = sunColor * specular;
		
		float rim = 1.0 - max(dot(viewDir, normal), 0.0);
		rim = pow(rim, rimPower) * u_RimStrength;
		vec3 rimLight = rimColor * rim;
		
		vec3 lighting = ambient + diffuse + specularLight + rimLight;
		vec3 litColor = pow(lighting * baseColor.rgb, vec3(1.0 / screenGamma));

		float distance = length(u_CameraPos - v_FragPos);
		float fogFactor = clamp((u_FogEnd - distance) / (u_FogEnd - u_FogStart), 0.0, 1.0);
		vec3 finalColor = mix(u_FogColor, litColor, fogFactor);

		gl_FragColor = vec4(finalColor, baseColor.a);
	}`;

let canvas: HTMLCanvasElement;
let GL: WebGLRenderingContext;
let W: number, H: number, HW: number, HH: number;
let START_TIME = performance.now() / 1000.0;
let CAMERA: Camera;
let DEBUG: boolean;
let stats = new Stats();
stats.dom.style.left = "auto";
stats.dom.style.right = "0";
stats.showPanel(0);
document.body.appendChild(stats.dom);

let treeMesh: Mesh;
let treeFoliage: Mesh;
let meshes: Shape[] = [];
let anteaters: Anteater[] = [];
const GRID = new GameGrid(4.0);
let MUSH_MAN: MushroomMan;
const TWEENS: Tween[] = [];
let ANTEATER_ANIMS: any;

async function main(): Promise<void> {
	setupWebGL();
	connectVariablesToGLSL();
	
	const treeRoot = new Transform();
	const treeMeshPromise = LoadOBJ('./models/maple.obj', './models/maple.png', treeRoot);
	const treeFoliagePromise = LoadOBJ('./models/maple_foliage.obj', './models/maple_foliage.png', treeRoot);
	const animPromise = fetch('../assets/data/animation.json').then(r => r.json()); // Reminder: from perspective of index.html since runtime
	const mushroomsPromise = initMushrooms();

	// get sync over with
	setupListeners();
	GL.clearColor(...skyColor, 1.0);
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
	resizeCanvas();
	
	const cameraTransform = new Transform([0, 2, -8], [0, 0, 0], [1, 1, 1]);
	CAMERA = new Camera(cameraTransform, null, CameraMode.FP);
	CAMERA.distance = 6;
	CAMERA.moveSpeed = 10;
	DEBUG = false;
	
	// Init world
	let ground = new Plane(new Transform([0,0,0], [0,0,0], [WORLD_EDGE * 3, 1, WORLD_EDGE * 3]), [117 / 255, 167 / 255, 67 / 255, 1.0], 0.0, './noise.png', {
		shininess: 0.0, 
		specularStrength: 0.0, 
		rimStrength: 0.0,
		UVScale: [4.0, 4.0],
	});
	let skyBox = new Cube(new Transform([0,0,0],[0,0,0],[-WORLD_EDGE * 3, -WORLD_EDGE * 3, -WORLD_EDGE * 3]), [...skyColor, 1.0], 0.0, null, {
		shininess: 0,
		specularStrength: 0,
		rimStrength: 0
	});
	meshes.push(skyBox);
	meshes.push(ground);
	
	
	// Sync Barrier
	const [loadedTreeMesh, loadedTreeFoliage, animations] = await Promise.all([
		treeMeshPromise,
		treeFoliagePromise,
		animPromise,
		mushroomsPromise
	]);
	GL.finish();

	ANTEATER_ANIMS = animations;
	treeMesh = loadedTreeMesh;
	treeFoliage = loadedTreeFoliage;
	treeFoliage.alphaCutout = 0.6;
	treeFoliage.setMaterial({ 
		shininess: 0.0, 
		specularStrength: 0.0, 
		rimStrength: 0.0 
	});
	treeFoliage.setGLState({
		cullFace: false,
		blend: false,
		blendSrc: GL.ONE,
		blendDst: GL.ZERO
	});

	spawnAnteater(5, 0);
	GRID.block( 0,  0);
	GRID.block( 0,  1);
	GRID.block( 0, -1);
	GRID.block( 1,  0);
	GRID.block( 1,  1);
	GRID.block( 1, -1);
	GRID.block(-1,  0);
	GRID.block(-1,  1);
	GRID.block(-1, -1);

	const treePoints = generatePoints({
		spawnRadius: 32,
		centerExclusionRadius: 5,
		minDistance: 2,
		targetCount: 32,
		gridSize: 1,
	});

	for (const [x, z] of treePoints) {
		placeTree(x, z);
	}

	requestAnimationFrame(tick);
}

function placeTree(x: number, z: number, scale: number = 1.0): void {
	GRID.block(x, z)
	const [worldX, worldZ] = GRID.getRandomPositionInCell(x, z);
	let point = new Transform([worldX, 0, worldZ], [0, Math.random() * 360, 0], [scale, scale, scale]);
	meshes.push(treeMesh.clone(point));
	meshes.push(treeFoliage.clone(point));
}

async function initMushrooms(): Promise<void> {
    const paths = [
        'morel',
        'black_trumpet',
        'bolete',
        'chanterelle',
        'dapperling',
        'galerina',
        'gymnopilus',
        'jackolantern',
        'panaeoleus',
        'parasol',
        'pluteus',
        'salt',
        'silly',
    ];

    const mushroomMeshes = await Promise.all(
        paths.map(name => LoadOBJ(`./models/${name}.obj`, './models/mushroom.png'))
    );

	// morel is only one that needs transparency
    mushroomMeshes[0].setGLState({
		cullFace: false,
		blend: false,
		blendSrc: GL.ONE,
		blendDst: GL.ZERO
	});
	mushroomMeshes[0].alphaCutout = 0.5;

	MUSH_MAN = new MushroomMan(mushroomMeshes, GRID);
	MUSH_MAN.placeMushroom(0, -5);


	const mushroomPoints = generatePoints({
		spawnRadius: 96,
		centerExclusionRadius: 10,
		minDistance: 5,
		targetCount: 32,
	});

	let placed = 0;
	for (const [x, z] of mushroomPoints) {
		const mushroom = MUSH_MAN.placeMushroom(x, z);
		if (mushroom) placed++;
	}

	console.log(`Placed ${placed} mushrooms (target: 32)`);
}

function spawnAnteater(x: number, z: number): Anteater {
	const worldY = 0;
	const rotation = Math.random() * 360;
	const targetScale = 0.5;
	
	const transform = new Transform(
		[x, worldY, z], 
		[0, rotation, 0], 
		[0, 0, 0]
	);
	
	const anteater = new Anteater(transform, ANTEATER_ANIMS);
	anteater.setMaxRoamDistance(64);
	anteater.setMoveSpeed(3.0);
	anteater.setWanderTiming(3.0, 0.8);

	let finScale = 0.4 + (Math.random() * 0.2);
	TWEENS.push(new Tween(
		transform, 
		'scale', 
		[0, 0, 0], 
		[finScale, finScale, finScale], 
		3.0
	));
	
	anteaters.push(anteater);
	return anteater;
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
	//GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
	GL.enable(GL.SAMPLE_ALPHA_TO_COVERAGE);

	window.GL = GL;
	window.addEventListener('resize', resizeCanvas);
}

let credits: number = 0;
let anteater_cost = 20;
function setupListeners(): void {
	window.addEventListener('keydown', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = true;
		
		if (env.key === 'Escape') {
			CAMERA.isDragging = false;
			// Exit pointer lock
			if (document.pointerLockElement === canvas) {
				document.exitPointerLock();
			}
		}

		const [worldX, , worldZ] = CAMERA.transform.getWorldPosition();
		const [x, z] = GRID.worldToGrid(worldX, worldZ);
		if (env.key === 'z') {
			// if in range of altar
			if (Math.abs(x) < 3 && Math.abs(z) < 3) {
				if (anteater_cost < credits) {
					credits -= anteater_cost;
					spawnAnteater(0, 0);
				}
			} else { // plant mushroom instead
				// mush man should handle case of growing a mushroom if already there
				MUSH_MAN.placeMushroom(worldX, worldZ);
			}
		} else if (env.key === 'x') {
			credits += MUSH_MAN.pickMushroom(worldX, worldZ);
		}
	});
	
	window.addEventListener('keyup', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = false;
	});

	canvas.addEventListener('mousedown', function(env) {
		canvas.focus();
		
		// Request pointer lock if not already locked
		if (!document.pointerLockElement) {
			canvas.requestPointerLock();
		}
		
		CAMERA.isDragging = true;
		CAMERA.lastMouseX = env.clientX;
		CAMERA.lastMouseY = env.clientY;
	});

	document.addEventListener('pointerlockchange', function() {
		if (document.pointerLockElement === canvas) {
			CAMERA.isDragging = true;
		} else {
			CAMERA.isDragging = false;
		}
	});

	canvas.addEventListener('mouseleave', function(env) { 
		if (!document.pointerLockElement) {
			CAMERA.isDragging = false;
		}
	});

	canvas.addEventListener('mousemove', function(env) {
		if (!CAMERA.isDragging) return;
		
		// Use movementX/Y when pointer locked
		if (document.pointerLockElement === canvas) {
			CAMERA.handleMouseDrag(env.movementX, env.movementY);
		} else {
			// Fallback to delta calculation
			const deltaX = env.clientX - CAMERA.lastMouseX;
			const deltaY = env.clientY - CAMERA.lastMouseY;
			CAMERA.handleMouseDrag(deltaX, deltaY);
			CAMERA.lastMouseX = env.clientX;
			CAMERA.lastMouseY = env.clientY;
		}
	});

	// Exit pointer lock on mouse wheel
	canvas.addEventListener('wheel', function(env) {
		if (document.pointerLockElement === canvas) {
			document.exitPointerLock();
		}
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

	// helper for attributes
	const getAttrib = (name: string, optional = false) => {
		const loc = GL.getAttribLocation(GL.program!, name);
		if (loc < 0 && !optional) console.log(`Failed to get location of ${name}`);
		return loc;
	};

	// helper for uniforms
	const getUniform = (name: string, optional = false) => {
		const loc = GL.getUniformLocation(GL.program!, name);
		if (!loc && !optional) console.log(`Failed to get location of ${name}`);
		return loc;
	};

	// attributes
	window.a_Position = getAttrib('a_Position');
	window.a_Normal   = getAttrib('a_Normal');
	window.a_TexCoord = getAttrib('a_TexCoord', true); // optional

	// uniforms
	window.u_FragColor       = getUniform('u_FragColor')!;
	window.u_Sampler         = getUniform('u_Sampler', true);
	window.u_UseTexture      = getUniform('u_UseTexture', true);
	GL.uniform1i(window.u_UseTexture, 0);

	window.u_AlphaCutout     = getUniform('u_AlphaCutout', true);
	GL.uniform1f(window.u_AlphaCutout, 0.0);

	window.u_ModelMatrix     = getUniform('u_ModelMatrix')!;
	GL.uniformMatrix4fv(window.u_ModelMatrix, false, new Matrix4().elements);

	window.u_GlobalRotation  = getUniform('u_GlobalRotation')!;
	const globalRotation = new Matrix4();
	globalRotation.setIdentity();
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, globalRotation.elements);

	window.u_ProjectionMatrix = getUniform('u_ProjectionMatrix')!;
	window.u_CameraPos        = getUniform('u_CameraPos')!;

	const setUniform1f = (name: string, value: number) => {
		const loc = getUniform(name);
		if (loc) GL.uniform1f(loc, value);
		return loc;
	};

	window.u_Shininess        = setUniform1f('u_Shininess', 32.0)!;
	window.u_SpecularStrength = setUniform1f('u_SpecularStrength', 0.3)!;
	window.u_RimStrength      = setUniform1f('u_RimStrength', 0.2)!;
	window.u_UVScale = getUniform('u_UVScale')!;
	GL.uniform2f(window.u_UVScale, 1.0, 1.0);

	u_FogColor = getUniform('u_FogColor')!;
	GL.uniform3f(u_FogColor, ...skyColor);
	u_FogStart = getUniform('u_FogStart')!;
	GL.uniform1f(u_FogStart, 64.0);
	u_FogEnd = getUniform('u_FogEnd')!;
	GL.uniform1f(u_FogEnd, WORLD_EDGE);
}

let u_FogColor: WebGLUniformLocation;
let u_FogStart: WebGLUniformLocation;
let u_FogEnd: WebGLUniformLocation;


function tick(): void {
	const now = performance.now();
	const dt = (now - START_TIME) / 1000;
	START_TIME = now;

	stats.begin();

	CAMERA.update(dt);
	const [camX, camY, camZ] = CAMERA.transform.getWorldPosition();
	GL.uniform3f(window.u_CameraPos, camX, camY, camZ);

	const viewMatrix = CAMERA.getViewMatrix();
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, viewMatrix.elements);

	MUSH_MAN.update(dt);
	dispatchAnimations(dt);
	renderAllShapes(dt);

	stats.end();
	requestAnimationFrame(tick);
}

function dispatchAnimations(dt: number): void {
	updateTweens(dt);
	for (const anteater of anteaters) {
		anteater.update(dt);
	}
}

function updateTweens(dt: number) {
	for (let i = TWEENS.length - 1; i >= 0; i--) {
		if (TWEENS[i].update(dt)) {
			TWEENS.splice(i, 1);
		}
	}
}

let altarSpinTime: number = 0.0;
function renderAllShapes(dt: number): void {
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
	
	for (const anteater of anteaters) {
		anteater.render();
	}
	MUSH_MAN.render();

	for (const mesh of meshes) {
		mesh.render();
	}

	// this is bad to create these here but I really don't care that much about 3 meshes being created each frame that are batched.
	// the anteaters are the bigger bottleneck anyway
	altarSpinTime += dt;
	let base = new Cube(new Transform([0, 0, 0], [0,0,0], [5, 1, 5]), [1.0, 0.84, 0, 1.0], 0.0, null, {
		shininess: 32.0,
		specularStrength: 0.5
	});
	let platform = new Plane(new Transform([0, 0.505, 0], [0, 0, 0], [5 * 0.95, 1, 5 * 0.955]), [0.7, 0.7, 0.7, 1.0], 0.0, null, {
		shininess: 32.0,
		specularStrength: 0.25
	});

	const bobAmount = 0.15;
	const bobSpeed = 0.25;
	const yOffset = 3 + Math.sin(altarSpinTime * bobSpeed * Math.PI * 2) * bobAmount;
	
	const rotationSpeed = 20; // degrees per second
	const yRotation = (altarSpinTime * rotationSpeed) % 360;
	let bigPrism = new Prism(new Transform([0, yOffset, 0], [0, yRotation, 0], [1.5, 2, 1.5]), [1.0, 0.84, 0, 1.0], 0.0, null, {
		shininess: 32.0,
		specularStrength: 0.5
	});

	base.render();
	platform.render();
	bigPrism.render();
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
	projMatrix.setPerspective(70, aspect, 0.05, WORLD_EDGE);
	GL.uniformMatrix4fv(window.u_ProjectionMatrix, false, projMatrix.elements);
}

// Start the application
main();


// Tree & Mushroom placement helpers
type SamplePoint = [number, number];
interface PlacementOptions {
	spawnRadius: number;
	centerExclusionRadius?: number;
	minDistance: number;
	targetCount: number;
	gridSize?: number;
}

/**
 * Generate points in an annulus with a minimum distance constraint
 */
function generatePoints(options: PlacementOptions): SamplePoint[] {
	const {
		spawnRadius,
		centerExclusionRadius = 0,
		minDistance,
		targetCount,
		gridSize,
	} = options;

	const samples: SamplePoint[] = [];
	const occupiedGrid = new Set<string>();

	const maxAttempts = targetCount * 10;

	for (let attempt = 0; attempt < maxAttempts && samples.length < targetCount; attempt++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = centerExclusionRadius + Math.random() * (spawnRadius - centerExclusionRadius);
		let x = Math.cos(angle) * radius;
		let z = Math.sin(angle) * radius;

		// If using a grid, snap point and check occupancy
		if (gridSize) {
			const gx = Math.round(x / gridSize);
			const gz = Math.round(z / gridSize);
			const key = `${gx},${gz}`;
			if (occupiedGrid.has(key)) continue;

			occupiedGrid.add(key);
			x = gx * gridSize;
			z = gz * gridSize;
		}

		// Check minimum distance from previous samples
		let valid = true;
		for (const [sx, sz] of samples) {
			const dx = x - sx;
			const dz = z - sz;
			if (Math.sqrt(dx * dx + dz * dz) < minDistance) {
				valid = false;
				break;
			}
		}

		if (valid) {
			samples.push([x, z]);
		}
	}

	return samples;
}
