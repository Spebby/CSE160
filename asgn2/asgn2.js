// Asgn2.js
import { Cube, Cylinder16 } from '../assets/lib/shapes.js';
import { AnimMan } from '../assets/lib/animation.js';
import Transform from '../assets/lib/transform.js';
import Camera, { CameraMode } from '../assets/lib/camera.js';
import Anteater from './anteater.js';

// Lighting model is based loosely on Blinn Phong.
// I was inspired to implement lighting after seeing 
// Lighting is a bit beyond me so I enlisted Gen AI to adapt
// asgn1's rendering code.

// Vertex shader program
var VSHADER_SOURCE =
	`attribute vec4 a_Position;
	attribute vec4 a_Normal;

	uniform mat4 u_ModelMatrix;
	uniform mat4 u_GlobalRotation;
	uniform mat4 u_ProjectionMatrix;

	varying vec3 v_Normal;
	varying vec3 v_FragPos;

	// consider normal stuff for lighting
	void main() {
		vec4 worldPos = u_ModelMatrix * a_Position;
		v_FragPos = worldPos.xyz;
		v_Normal = mat3(u_ModelMatrix) * a_Normal.xyz;
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * worldPos;
	}`;

// Fragment shader program
var FSHADER_SOURCE = `
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

		// Lambertian diffuse with no distance attenuation
		float lambertian = max(dot(normal, lightDir), 0.0);
		vec3 colourLinear = ambientColor + diffuseColor * lambertian;

		// Gamma correction
		vec3 colourGammaCorrected = pow(colourLinear, vec3(1.0 / screenGamma));
		gl_FragColor = vec4(colourGammaCorrected * u_FragColor.rgb, 1.0);
	}`;


var canvas;
var GL;
var ANTEATER;
var DEBUG;
var ANT_ANIM;
var CAMERA;

var W;
var H;
var HW;
var HH;
var START_TIME = performance.now() / 1000.0;

var FOV;
var IS_PAUSED;
var RES_MULT;
var MAX_MOVE_SPEED = 0.1;

async function main() {
	setupWebGL();
	connectVariablesToGLSL();

	const response = await fetch('../assets/data/animation.json');
	const animations = await response.json();

	ANTEATER = new Anteater();
	ANT_ANIM = new AnimMan(ANTEATER, animations);

	// Initialize camera with Transforms
	const cameraTransform = new Transform([0, 0, 0], [0, 0, 0], [1, 1, 1]);
	const cameraMode = CameraMode[document.querySelector('#camMode input[name="mode"]:checked').value];
	CAMERA = new Camera(cameraTransform, ANTEATER.cameraFocus, cameraMode);
	CAMERA.distance = 6;
	CAMERA.angleX = 15;
	CAMERA.angleY = 30;
	CAMERA.moveSpeed = parseFloat(document.getElementById('MOVE_SPEED').value);
	CAMERA.invertX = document.getElementById('invX').checked;
	CAMERA.invertY = document.getElementById('invY').checked;

	setupListeners();

	ANT_ANIM.queueAnim('walk');

	GL.clearColor(0.0, 0.0, 0.0, 1.0);
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

	FOV = document.getElementById('FOV').value;
	RES_MULT = document.getElementById('RES_MULT').value;
	IS_PAUSED = document.getElementById('mPause').textContent !== 'Pause';
	MAX_MOVE_SPEED = parseFloat(document.getElementById('MOVE_SPEED').max);

	DEBUG = document.getElementById('mDebug').checked;

	resizeCanvas();
	requestAnimationFrame(tick);
}

function setupWebGL() {
	canvas = document.getElementById('webgl');
	if (!canvas) {
		console.log('Failed to retrieve the <canvas> element');
		return;
	}

	GL = canvas.getContext("webgl", { preserveDrawingBuffer: true});
	if (!GL) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	GL.enable(GL.CULL_FACE);
	GL.cullFace(GL.BACK);
    GL.enable(GL.DEPTH_TEST);
	GL.enable(GL.BLEND);
	GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);

	lineBuffer = GL.createBuffer();

	window.GL = GL;
	window.addEventListener('resize', resizeCanvas);
}

function setupListeners() {
	setupAnimationListeners();
	document.getElementById('FOV').addEventListener('input', function() { FOV = this.value; updateProjMatrix(); });
	document.getElementById('RES_MULT').addEventListener('input', function() { RES_MULT = this.value; resizeCanvas(); });
	document.getElementById('invX').addEventListener('change', function() { CAMERA.invertX = this.checked; })
	document.getElementById('invY').addEventListener('change', function() { CAMERA.invertY = this.checked; })
	document.getElementById('mDebug').addEventListener('change', function() { 
		DEBUG = this.checked;
		const debugEl = document.getElementById("debugPanel");
		debugEl.style.display = DEBUG ? "block" : "none";
	})

	let pauseButton = document.getElementById('mPause');
	pauseButton.addEventListener('click', function() {
		IS_PAUSED = !IS_PAUSED;
		pauseButton.textContent = IS_PAUSED ? 'Unpause' : 'Pause';
		pauseButton.classList.remove('btn-warning');
		if (IS_PAUSED) {
			pauseButton.classList.add('btn-warning');
		}
	});

	// camera controls
	document.getElementById('MOVE_SPEED').addEventListener('input', function() { CAMERA.moveSpeed = parseFloat(this.value); });

	window.addEventListener('keydown', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = true;
	});
	
	window.addEventListener('keyup', function(env) {
		CAMERA.keyStates[env.key.toLowerCase()] = false;
	});

	const modeRadios = document.querySelectorAll('#camMode input[name="mode"]');
	modeRadios.forEach(radio => {
		radio.addEventListener('change', function() {
			CAMERA.setMode(CameraMode[this.value]);
		});
	});

	canvas.addEventListener('mousedown', function(env) {
		CAMERA.isDragging = true;
		CAMERA.lastMouseX = env.clientX;
		CAMERA.lastMouseY = env.clientY;

		if (env.shiftKey) {
			// trigger "poke" animation
			// if i add a couple animations, then do that ig

			// Personally, I dislike quing multiple of the same anim
			// with a double click. this is a blocker here, instead
			// of in the anim system. There's technically nothing wrong
			// with quing it twice
			const aKey = ANT_ANIM.getActiveAnimation();
			if (aKey === 'guard') return;
			ANT_ANIM.interruptAnimQueue('guard');
			ANT_ANIM.queueAnim('idle');
			ANT_ANIM.queueAnim('walk');
		}
	});

	canvas.addEventListener('mousemove', function(env) {
		if (!CAMERA.isDragging) return;
		
		const deltaX = env.clientX - CAMERA.lastMouseX;
		const deltaY = env.clientY - CAMERA.lastMouseY;
		
		CAMERA.handleMouseDrag(deltaX, deltaY);
		
		CAMERA.lastMouseX = env.clientX;
		CAMERA.lastMouseY = env.clientY;
	});

    canvas.addEventListener('mouseup', function(env) { CAMERA.isDragging = false; });
    canvas.addEventListener('mouseleave', function(env) { CAMERA.isDragging = false; });

	canvas.addEventListener('wheel', function(env) {
		env.preventDefault();
		
		const step = parseFloat(document.getElementById('MOVE_SPEED').step);
		CAMERA.handleMouseWheel(env.deltaY, MAX_MOVE_SPEED, step);
		
		if (CAMERA.mode !== CameraMode.ORBIT) {
			document.getElementById('MOVE_SPEED').value = CAMERA.moveSpeed;
		}
	});

    canvas.addEventListener('contextmenu', function(env) {
        env.preventDefault();
    });
}

function writeToHTML(str, id, isHTML = false) {
	const element = document.getElementById(id);
	if (!isHTML) {
		element.textContent = str;
	} else {
		element.innerHTML = str;
	}

	if (str === "") {
		element.classList.add('hidden');
		return;
	}

	element.classList.remove('hidden');
}



function screenSpaceToCanvasSpace(env) {
	var x = env.clientX;
	var y = env.clientY;
	var rect = env.target.getBoundingClientRect();
	x = ((x - rect.left) - HW) / (HW);
	y = (HH - (y - rect.top)) / HH;

	return [x, y];
}

function connectVariablesToGLSL() {
	if (!initShaders(GL, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to init shaders.');
		return;
	}

	let tPos = GL.getAttribLocation(GL.program, 'a_Position');
	if (tPos < 0) {
		console.log('Failed to get storage location of a_Position');
		return;
	}
	window.a_Position = tPos;

	let tNor = GL.getAttribLocation(GL.program, 'a_Normal');
	if (tNor < 0) {
		console.log('Failed to get storage location of a_Normal');
		return;
	}
	window.a_Normal = tNor;

	let tCol = GL.getUniformLocation(GL.program, 'u_FragColor');
	if (!tCol) {
		console.log('Failed to get storage location of u_FragColor');
		return;
	}
	window.u_FragColor = tCol;

	let tMod = GL.getUniformLocation(GL.program, 'u_ModelMatrix');
	if (!tMod) {
		console.log('Failed to get storage location of u_ModelMatrix');
		return;
	}
	window.u_ModelMatrix = tMod;
	var identityMatrix = new Matrix4();
	GL.uniformMatrix4fv(window.u_ModelMatrix, false, identityMatrix.elements);

	let tGol = GL.getUniformLocation(GL.program, 'u_GlobalRotation');
	if (!tGol) {
		console.log('Failed to get storage location of u_GlobalRotation');
		return;
	}
	window.u_GlobalRotation = tGol;
	var globalRotation = new Matrix4();
	globalRotation.setIdentity();
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, globalRotation.elements);

	let tProj = GL.getUniformLocation(GL.program, 'u_ProjectionMatrix');
	if (!tProj) {
		console.log('Failed to get storage location of u_ProjectionMatrix');
		return;
	}
	window.u_ProjectionMatrix = tProj;
	
	// Get other uniforms if they exist
	window.u_Shininess = GL.getUniformLocation(GL.program, 'u_Shininess');
	window.u_SpecularStrength = GL.getUniformLocation(GL.program, 'u_SpecularStrength');
	window.u_RimStrength = GL.getUniformLocation(GL.program, 'u_RimStrength');
	window.u_UVScale = GL.getUniformLocation(GL.program, 'u_UVScale');
	window.u_AlphaCutout = GL.getUniformLocation(GL.program, 'u_AlphaCutout');
	window.u_Sampler = GL.getUniformLocation(GL.program, 'u_Sampler');
	window.u_UseTexture = GL.getUniformLocation(GL.program, 'u_UseTexture');
	window.a_TexCoord = GL.getAttribLocation(GL.program, 'a_TexCoord');
}

function tick() {
	const now = performance.now();
	const nowSeconds = now / 1000;
	const dt = (now - START_TIME) / 1000;

	writeToHTML(`ms: ${(1000 * dt).toFixed(2)} fps: ${(1000/(1000 * dt)).toFixed(2)}`, "profMeasure");
	START_TIME = now;

	updateCamera(dt);
	dispatchAnimations(dt);
	renderAllShapes(dt);
	requestAnimationFrame(tick);

	if (DEBUG) {
		renderBonesDebug();
		displayAnimQueue();
		displayRigDebugInfo();
	}
}

function dispatchAnimations(dt) {
	// accept user input & tweak the rig accordingly

	if (IS_PAUSED) return;
	// dispatch dedicated animation calls. The animator handles this.
	
	ANT_ANIM.update(dt);
}

var lineBuffer;
const lineData = new Float32Array(6);
function renderAllShapes(dt) {
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
	ANTEATER.render();
	
	var ground = new Cylinder16(new Transform([0, -0.05, 0], [0, 0, 0], [5, 0.1, 5]), [0.3, 0.3, 0.3, 0.5].slice(), null);
	ground.render();
}

// handles updating canvas size when window is resize
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const scaledWidth = rect.width * dpr * RES_MULT;
    const scaledHeight = rect.height * dpr * RES_MULT;

    canvas.width = Math.round(scaledWidth);
    canvas.height = Math.round(scaledHeight);

    W = canvas.width;
    H = canvas.height;
    HW = W / 2;
    HH = H / 2;

    GL.viewport(0, 0, W, H);

    updateProjMatrix();
    writeToHTML(`${W}x${H}, DPR: ${dpr}, Multiplier: ${RES_MULT}`, "resMeasure");
}

function updateProjMatrix() {
	var projMatrix = new Matrix4();
	var aspect = W / H;
	projMatrix.setPerspective(FOV, aspect, 0.05, 100);
	GL.uniformMatrix4fv(window.u_ProjectionMatrix, false, projMatrix.elements);
}

function updateCamera(dt) {
	CAMERA.update(dt);
	const viewMatrix = CAMERA.getViewMatrix();
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, viewMatrix.elements);
}

// call on module load
main();






function updateBulkRotation(bone, segment, offsetX = 0, offsetY = 0, offsetZ = 0) {
    const x = parseFloat(document.getElementById(`${segment}X`).value) + offsetX;
    const y = parseFloat(document.getElementById(`${segment}Y`).value) + offsetY;
    const z = parseFloat(document.getElementById(`${segment}Z`).value) + offsetZ;

    ANT_ANIM.setUserRotation(bone, [x, y, z]);
}

function setupAnimationListeners() {
	document.getElementById('exportKeyframe').addEventListener('click', exportKeyframe);

	['headX', 'headY', 'headZ'].forEach(id => {
		document.getElementById(id).addEventListener('input', () => {
			updateBulkRotation('head', 'head');
		});
	});

	['tailAX', 'tailAY', 'tailAZ'].forEach(id => {
		document.getElementById(id).addEventListener('input', () => {
			updateBulkRotation('tailA', 'tailA', 0, 180, 0);
		});
	});

	['tailBX', 'tailBY', 'tailBZ'].forEach(id => {
		document.getElementById(id).addEventListener('input', () => {
			updateBulkRotation('tailB', 'tailB');
		});
	});


	document.getElementById('pivotY').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('pivot', [0, val, 0]);
	});

	document.getElementById('pelvisX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('pelvis', [val, 0, 0]);
	});

	['lBicepX', 'lBicepY', 'lBicepZ'].forEach(id => {
		document.getElementById(id).addEventListener('input', () => {
			updateBulkRotation('lBicep', 'lBicep');
		});
	});

	['rBicepX', 'rBicepY', 'rBicepZ'].forEach(id => {
		document.getElementById(id).addEventListener('input', () => {
			updateBulkRotation('rBicep', 'rBicep');
		});
	});

	document.getElementById('lForearmX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('lForearm', [val, 0, 0]);
	});

	document.getElementById('rForearmX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('rForearm', [val, 0, 0]);
	});

	document.getElementById('lHandX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('lHand', [val, 0, 0]);
	});

	document.getElementById('rHandX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('rHand', [val, 0, 0]);
	});

	document.getElementById('lThighX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('lThigh', [val, 0, 0]);
	});

	document.getElementById('rThighX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('rThigh', [val, 0, 0]);
	});

	document.getElementById('lShinX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('lShin', [val, 0, 0]);
	});

	document.getElementById('rShinX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('rShin', [val, 0, 0]);
	});

	document.getElementById('lFootX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('lFoot', [val, 0, 0]);
	});

	document.getElementById('rFootX').addEventListener('input', function() {
		const val = parseFloat(this.value);
		ANT_ANIM.setUserRotation('rFoot', [val, 0, 0]);
	});	
}

function exportKeyframe() {
	const rigInfo = ANTEATER.getRigInfo();
	
	// keyframe object template
	const keyframe = {
		time: 0.0,
		transforms: {}
	};
	
	for (const boneName in rigInfo) {
		keyframe.transforms[boneName] = {
			rotation: rigInfo[boneName]
		};
	}
	
	const jsonString = JSON.stringify(keyframe, null, '\t');
	const blob = new Blob([jsonString], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'keyframe.txt';
	link.click();
	URL.revokeObjectURL(url);
}

// a bunch of debug stuff
function renderBonesDebug() {
	GL.disable(GL.DEPTH_TEST);
	const graph = Transform.getHierarchyGraph(ANTEATER.pivot);
	const identity = new Matrix4();
	GL.uniformMatrix4fv(window.u_ModelMatrix, false, identity.elements);
	GL.bindBuffer(GL.ARRAY_BUFFER, lineBuffer);
	GL.vertexAttribPointer(window.a_Position, 3, GL.FLOAT, false, 0, 0);
	GL.enableVertexAttribArray(window.a_Position);
	
	
	// Find leaf nodes (transforms with no children)
	const leafNodes = new Set(graph.nodes.filter(n => n.transform.children.length === 0).map(n => n.transform));
	for (const edge of graph.edges) {
		lineData[0] = edge.from[0];
		lineData[1] = edge.from[1];
		lineData[2] = edge.from[2];
		lineData[3] = edge.to[0];
		lineData[4] = edge.to[1];
		lineData[5] = edge.to[2];
		
		GL.uniform4f(window.u_FragColor, 1, 1, 0, 1);
		GL.bufferData(GL.ARRAY_BUFFER, lineData, GL.DYNAMIC_DRAW);
		GL.drawArrays(GL.LINES, 0, 2);
	}
	
	const nodeCube = new Cube(new Transform([0, 0, 0], [0, 0, 0], [0.1, 0.1, 0.1]), [1, 0, 0, 1]);
	for (const node of graph.nodes) {
		nodeCube.transform.setPos(...node.position);
		// Green for leaf nodes, red for others
		nodeCube.tint = leafNodes.has(node.transform) ? [0, 1, 0, 1] : [1, 0, 0, 1];
		nodeCube.render();
	}
	GL.enable(GL.DEPTH_TEST);
}

function displayAnimQueue() {
	const current = ANT_ANIM.getActiveAnimation();
	const queueInfo = ANT_ANIM.getQueueInfo();
	
	let debugText = `Current: ${current || 'none'}`;
	if (queueInfo.length > 0) {
		debugText += `\nQueue: [${queueInfo.join(', ')}]`;
	}
	
	writeToHTML(debugText, "animDebug");
}

// generated w/ chatgpt
function displayRigDebugInfo() {
    const rigInfo = ANTEATER.getRigInfo();
    const bones = Object.keys(rigInfo);

    let debugText = '<div class="row g-2">';

    bones.forEach(name => {
        const rot = rigInfo[name];
        debugText += `
            <div class="col-auto col-sm-6 col-md-4 col-lg-2">
                <b>${name}</b>: [${rot.map(v => v.toFixed(1)).join(', ')}]
            </div>
        `;
    });

    debugText += '</div>';
    writeToHTML(debugText, "rigDebug", true);
}
