/// <reference types="stats.js" />

import Shape, { Plane, Cube, Prism, Mesh, Cylinder16, MaterialProperties } from '../../assets/lib/shapes.js';
import Transform from '../../assets/lib/transform.js';
import Camera, { CameraMode } from '../../assets/lib/camera.js';
import LoadOBJ from '../../assets/lib/objloader.js';
import Tween from '../../assets/lib/tween.js';
import Anteater from './anteater.js';

const WORLD_EDGE: number = 128.0;
const skyColor: [number, number, number] = [0.05, 0.05, 0.05];

const VSHADER_SOURCE = `
	precision mediump float;
	attribute vec4 a_Position;
	attribute vec4 a_Normal;
	attribute vec2 a_TexCoord;

	uniform mat4 u_ModelMatrix;
	uniform mat4 u_GlobalRotation;
	uniform mat4 u_ProjectionMatrix;
	uniform vec2 u_UVScale;
	uniform vec3 u_LightPos0;
	uniform vec3 u_LightPos1;

	varying vec3 v_Normal;
	varying vec3 v_VertexPos;
	varying vec3 v_LightPosOut0;
	varying vec3 v_LightPosOut1;
	varying vec2 v_TexCoord;

	void main() {
		vec4 worldPos = u_ModelMatrix * a_Position;
		v_VertexPos = worldPos.xyz;
		v_Normal = normalize(mat3(u_ModelMatrix) * a_Normal.xyz);
		v_LightPosOut0 = u_LightPos0 - v_VertexPos;
		v_LightPosOut1 = u_LightPos1 - v_VertexPos;
		v_TexCoord = a_TexCoord * u_UVScale;
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * worldPos;
	}`;

const FSHADER_SOURCE = `
	precision mediump float;
	varying vec3 v_Normal;
	varying vec3 v_VertexPos;
	varying vec3 v_LightPosOut0;
	varying vec3 v_LightPosOut1;
	varying vec2 v_TexCoord;

	uniform vec4 u_FragColor;
	uniform vec3 u_CameraPos;

	// lights
	uniform vec3 u_LightColor0;
	uniform vec3 u_LightColor1;
	uniform vec3 u_SpotDirection;
	uniform float u_SpotRadius;
	uniform float u_SpotIntensity;
	uniform float u_PointRadius;
	uniform float u_PointIntensity;

	// material
	uniform float u_Shininess;
	uniform float u_SpecularStrength;
	uniform float u_RimStrength;

	// texture
	uniform sampler2D u_Sampler;
	uniform int u_UseTexture;
	uniform float u_AlphaCutout;

	// fog
	uniform vec3 u_FogColor;
	uniform float u_FogStart;
	uniform float u_FogEnd;

	// display mode
	uniform float u_LightMode;

	const vec3 skyAmbient    = vec3(0.1, 0.1, 0.1);
	const vec3 groundAmbient = vec3(0.05, 0.02, 0.01);
	const float screenGamma  = 2.2;
	const float rimPower     = 3.0;
	const vec3 rimColor      = vec3(0.5, 0.6, 0.8);

	void main() {
		vec3 normal = normalize(v_Normal);

		// normal debug view
		if (u_LightMode == 1.0) {
			gl_FragColor = vec4(normal, 1.0);
			return;
		}

		// base color from texture or uniform
		vec4 baseColor = u_FragColor;
		if (u_UseTexture == 1) {
			baseColor *= texture2D(u_Sampler, v_TexCoord);
		}
		if (baseColor.a < u_AlphaCutout) discard;

		// flat color view
		if (u_LightMode == 2.0) {
			gl_FragColor = baseColor;
			return;
		}

		// hemisphere ambient
		float up = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
		vec3 ambient = mix(groundAmbient, skyAmbient, up) * baseColor.rgb;

		vec3 viewDir   = normalize(u_CameraPos - v_VertexPos);
		vec3 lightDir0  = normalize(v_LightPosOut0);
		vec3 lightDir1 = normalize(v_LightPosOut1);

		// diffuse
		vec3 diffuse0 = u_LightColor0 * max(0.0, dot(normal, lightDir0));
		vec3 diffuse1 = u_LightColor1 * max(0.0, dot(normal, lightDir1));

		// specular
		vec3 halfDir0  = normalize(lightDir0 + viewDir);
		vec3 halfDir1  = normalize(lightDir1 + viewDir);
		vec3 specular0 = u_LightColor0 * pow(max(0.0, dot(normal, halfDir0)), u_Shininess) * u_SpecularStrength;
		vec3 specular1 = u_LightColor1 * pow(max(0.0, dot(normal, halfDir1)), u_Shininess) * u_SpecularStrength;

		// spotlight attenuation on light0
		float theta     = dot(-normalize(v_LightPosOut0), normalize(u_SpotDirection));
		float spotMask  = smoothstep(u_SpotRadius - 0.05, u_SpotRadius + 0.05, theta);
		diffuse0  *= spotMask * u_SpotIntensity;
		specular0 *= spotMask * u_SpotIntensity;

		// omni falloff on light1
		float dist1      = length(v_LightPosOut1);
		float falloff    = clamp(1.0 - (dist1 / u_PointRadius), 0.0, 1.0);
		falloff          = falloff * falloff; // squared for more physical falloff
		diffuse1  *= falloff * u_PointIntensity;
		specular1 *= falloff * u_PointIntensity;


		// rim
		float rim = pow(1.0 - max(dot(viewDir, normal), 0.0), rimPower) * u_RimStrength;
		vec3 rimLight = rimColor * rim;

		vec3 lighting  = ambient + (diffuse0 + diffuse1 + specular0 + specular1) * 0.75 + rimLight;
		vec3 litColor  = pow(clamp(lighting, 0.0, 1.0), vec3(1.0 / screenGamma));

		// fog
		float dist      = length(u_CameraPos - v_VertexPos);
		float fogFactor = clamp((u_FogEnd - dist) / (u_FogEnd - u_FogStart), 0.0, 1.0);
		vec3 finalColor = mix(u_FogColor, litColor, fogFactor);

		gl_FragColor = vec4(finalColor, baseColor.a);
	}`;

let canvas: HTMLCanvasElement;
let GL: WebGLRenderingContext;
let W: number, H: number, HW: number, HH: number;
let START_TIME = performance.now() / 1000.0;
let CAMERA: Camera;
let FOV: number = 70;
let stats = new Stats();
stats.dom.style.left = "auto";
stats.dom.style.right = "0";
stats.showPanel(0);
document.body.appendChild(stats.dom);

let meshes: Shape[] = [];
let ANTEATER: Anteater;
const TWEENS: Tween[] = [];

let SPOTLIGHT_MESH: Shape;
let POINT_MESH: Shape;
let pointOrbitAngle: number = 0;
const POINT_ORBIT_RADIUS = 6;
const POINT_ORBIT_CENTER: [number, number, number] = [0, 2, 0];


let pointAnimating: boolean = true;
let pointLightColor: [number, number, number, number] = [1, 1, 1, 1];
let spotLightColor:  [number, number, number, number] = [1, 1, 1, 1];
let spotLightPos: [number, number, number] = [5, 10, 8];
let spotDir:      [number, number, number] = [-5, -5, -5];
let spotLightIntensity: number = 0.25;
async function main(): Promise<void> {
	setupWebGL();
	connectVariablesToGLSL();

	const ballTransform = new Transform();
	const ballMeshPromise = LoadOBJ('./ball.obj', './ball.png', ballTransform);
	const animPromise = fetch('../assets/data/animation.json').then(r => r.json()); // Reminder: from perspective of index.html since runtime

	// get sync over with
	setupListeners();
	GL.clearColor(...skyColor, 1.0);
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
	resizeCanvas();

	FOV = parseFloat((document.getElementById('FOV') as HTMLInputElement).value);

	const cameraTransform = new Transform([0, 5, -8], [15, 0, 0], [1, 1, 1]);
	CAMERA = new Camera(cameraTransform, null, CameraMode.ORBIT);
	CAMERA.distance = 6;

	// Sync Barrier
	const [loadedBallMesh, animations] = await Promise.all([
		ballMeshPromise,
		animPromise
	]);
	GL.finish();

	loadedBallMesh.setMaterial({
		shininess: 128.0,
		specularStrength: 0.75,
		rimStrength: 0.5,
	});
	meshes.push(loadedBallMesh);

	const pointLightTransform = new Transform(
		[POINT_ORBIT_CENTER[0] + POINT_ORBIT_RADIUS, POINT_ORBIT_CENTER[1], POINT_ORBIT_CENTER[2]],
		[0, 0, 0],
		[1, 1, 1]
	);

	POINT_MESH = new Cube(pointLightTransform, [1.0, 1.0, 1.0, 1.0], 0.0, null, {
		shininess: 64.0,
		specularStrength: 0.5,
		rimStrength: 0.3,
	});
	meshes.push(POINT_MESH);

	SPOTLIGHT_MESH = new Cube(new Transform(spotLightPos), [1.0, 1.0, 1.0, 1.0], 0.0, null, {
		shininess: 64.0,
		specularStrength: 1.0,
		rimStrength: 0.5,
	});
	meshes.push(SPOTLIGHT_MESH);

	let ground = new Plane(new Transform([0, -1, 0], [0, 0, 0], [500, 500, 500]), [0.8, 0.8, 0.8, 1.0], 0.0, null, {
		shininess: 8.0,
		specularStrength: 0.1,
		rimStrength: 0.0,
	});
	meshes.push(ground);

	let antTransform = new Transform([0, 2, 0.75], [0, 0, 0], [1, 1, 1], ballTransform);
	ANTEATER = new Anteater(antTransform, animations);
	ANTEATER.queueAnim("ball_balance");
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
	//GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
	//GL.enable(GL.SAMPLE_ALPHA_TO_COVERAGE);

	window.GL = GL;
	window.addEventListener('resize', resizeCanvas);
}

let credits: number = 0;
let anteater_cost = 20;
function setupListeners(): void {
	const modeRadios = document.querySelectorAll('#lightMode input[name="mode"]');
	modeRadios.forEach(radio => {
		radio.addEventListener('change', () => {
			const input = radio as HTMLInputElement;
			if (!input.checked) return;
			let modeNum: number;
			switch (input.value) {
				case 'LIT':   modeNum = 0; break;
				case 'NORMAL': modeNum = 1; break;
				case 'UNLIT':  modeNum = 2; break;
				default:
					console.warn(`Unknown mode: ${input.value}`);
					return;
			}
			GL.uniform1f(lightMode, modeNum);
		});
	});

	document.getElementById('FOV')!.addEventListener('input', function() { 
		FOV = parseFloat((this as HTMLInputElement).value); 
		updateProjMatrix(); 
	});


	window.addEventListener('keydown', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = true;
		
		if (env.key === 'Escape') {
			CAMERA.isDragging = false;
			// Exit pointer lock
			if (document.pointerLockElement === canvas) {
				document.exitPointerLock();
			}
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
		if (document.pointerLockElement !== canvas) return;

		env.preventDefault();
		CAMERA.handleMouseWheel(env.deltaY, 50, 0.5);
	});

	canvas.addEventListener('contextmenu', function(env) {
		env.preventDefault();
	});

	const getVal  = (id: string) => parseFloat((document.getElementById(id) as HTMLInputElement).value);
	const onInput = (id: string, fn: (v: number) => void) =>
		document.getElementById(id)!.addEventListener('input', function() { fn(parseFloat((this as HTMLInputElement).value)); });

	// point light toggles animation
	document.getElementById('togglePointAnim')!.addEventListener('click', function() {
		pointAnimating = !pointAnimating;
		(this as HTMLButtonElement).textContent = `Animating: ${pointAnimating ? 'ON' : 'OFF'}`;
	});

	// point light colour — only applied when not animating
	onInput('c0R', v => { pointLightColor[0] = v / 255; });
	onInput('c0G', v => { pointLightColor[1] = v / 255; });
	onInput('c0B', v => { pointLightColor[2] = v / 255; });
	onInput('c0X', v => { POINT_ORBIT_CENTER[0] = v; });
	onInput('c0Y', v => { POINT_ORBIT_CENTER[1] = v; });
	onInput('c0Z', v => { POINT_ORBIT_CENTER[2] = v; });
	onInput('c0Radius', v => GL.uniform1f(pointRadius,    v));
	onInput('c0I',      v => GL.uniform1f(pointIntensity, v));

	// spotlight — always uses HTML values
	onInput('c1R', v => { spotLightColor[0] = v / 255; });
	onInput('c1G', v => { spotLightColor[1] = v / 255; });
	onInput('c1B', v => { spotLightColor[2] = v / 255; });
	onInput('c1X', v => { spotLightPos[0] = v; });
	onInput('c1Y', v => { spotLightPos[1] = v; });
	onInput('c1Z', v => { spotLightPos[2] = v; });
	onInput('c1DX', v => { spotDir[0] = v; });
	onInput('c1DY', v => { spotDir[1] = v; });
	onInput('c1DZ', v => { spotDir[2] = v; });
	onInput('c1Radius', v => GL.uniform1f(spotRadius,     v));
	onInput('c1I',      v => { spotLightIntensity = v;      });
}

let lightMode : WebGLUniformLocation;
let lightPos0 : WebGLUniformLocation;
let lightPos1 : WebGLUniformLocation;
let lightColour0 : WebGLUniformLocation;
let spotDirection : WebGLUniformLocation;
let spotRadius : WebGLUniformLocation;
let spotIntensity: WebGLUniformLocation;
let lightColour1 : WebGLUniformLocation;
let pointRadius : WebGLUniformLocation;
let pointIntensity : WebGLUniformLocation;
let u_FogColor: WebGLUniformLocation;
let u_FogStart: WebGLUniformLocation;
let u_FogEnd: WebGLUniformLocation;
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

	lightMode = getUniform('u_LightMode')!;
	lightPos0 = getUniform('u_LightPos0')!;
	lightPos1 = getUniform('u_LightPos1')!;
	lightColour0 = getUniform('u_LightColor0')!;
	spotDirection = getUniform('u_SpotDirection')!;
	spotRadius = setUniform1f('u_SpotRadius', 0.85)!;
	spotIntensity = setUniform1f('u_SpotIntensity', 0.25)!;
	lightColour1 = getUniform('u_LightColor1')!;
	pointRadius = setUniform1f('u_PointRadius', 10.0)!;
	pointIntensity = setUniform1f('u_PointIntensity', 1.0)!;


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

	dispatchAnimations(dt);
	renderAllShapes(dt);

	stats.end();
	requestAnimationFrame(tick);
}

function dispatchAnimations(dt: number): void {
	updateTweens(dt);
	ANTEATER.update(dt);
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

	// pointlight update
	const speed = 0.8;
	let px: number, py: number, pz: number;
	let tint: [number, number, number, number];

	if (pointAnimating) {
		pointOrbitAngle += speed * dt;
		px = POINT_ORBIT_CENTER[0] + Math.cos(pointOrbitAngle) * POINT_ORBIT_RADIUS;
		py = POINT_ORBIT_CENTER[1];
		pz = POINT_ORBIT_CENTER[2] + Math.sin(pointOrbitAngle) * POINT_ORBIT_RADIUS;
		tint = hsvToRgb((performance.now() / 10000) % 1.0, 0.8, 1.0);
	} else {
		px = POINT_ORBIT_CENTER[0];
		py = POINT_ORBIT_CENTER[1];
		pz = POINT_ORBIT_CENTER[2];
		tint = pointLightColor;
	}

	POINT_MESH.transform.setPos(px, py, pz);
	POINT_MESH.transform.setRot(0, -pointOrbitAngle * (180 / Math.PI), 0);
	POINT_MESH.tint = tint;
	GL.uniform3f(lightPos1, px, py, pz);
	GL.uniform3fv(lightColour1, tint.slice(0, 3));

	// spotlight
	SPOTLIGHT_MESH.transform.setPos(...spotLightPos as [number, number, number]);
	SPOTLIGHT_MESH.tint = spotLightColor;
	GL.uniform3fv(lightColour0,  spotLightColor.slice(0, 3));
	GL.uniform3fv(lightPos0,     spotLightPos);
	GL.uniform3fv(spotDirection, spotDir);
	GL.uniform1f(spotIntensity,  spotLightIntensity);

	// renda
	ANTEATER.render();
	for (const mesh of meshes) {
		mesh.render();
	}
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
	projMatrix.setPerspective(FOV, aspect, 0.05, WORLD_EDGE);
	GL.uniformMatrix4fv(window.u_ProjectionMatrix, false, projMatrix.elements);
}

// Start the application
main();

function hsvToRgb(h: number, s: number, v: number): [number, number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: return [v, t, p, 1];
        case 1: return [q, v, p, 1];
        case 2: return [p, v, t, 1];
        case 3: return [p, q, v, 1];
        case 4: return [t, p, v, 1];
        case 5: return [v, p, t, 1];
    }
    return [v, v, v, 1];
}
