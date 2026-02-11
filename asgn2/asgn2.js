// Asgn2.js
import { Cube, Cylinder16 } from '../assets/lib/shapes.js';
import { AnimMan } from '../assets/lib/animation.js';
import Transform from '../assets/lib/transform.js';
import Anteater from './anteater.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

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
		vec3 colorLinear = ambientColor + diffuseColor * lambertian;

		// Gamma correction
		vec3 colorGammaCorrected = pow(colorLinear, vec3(1.0 / screenGamma));
		gl_FragColor = vec4(colorGammaCorrected * u_FragColor.rgb, 1.0);
	}`;


var canvas;
var GL;
var ANTEATER;
var DEBUG;
var ANT_ANIM;

var W;
var H;
var HW;
var HH;
var START_TIME = performance.now() / 1000.0;

var FOV;
var IS_PAUSED;
var RES_MULT;
var invX = false;
var invY = false;



// Pitch, Yaw
const CameraMode = {
	TRACK: 0,
	FREE: 1,
	ORBIT: 2,
};
var currCamMode = 0;
var MOVE_SPEED = 0.01;
var MAX_MOVE_SPEED = 0.1;

var cameraAngleX = 0;
var cameraAngleY = 0;
var cameraDistance = 3;
const DEFAULT_DISTANCE = 6;

var isDragging = false;
var lastMouseX = 0;
var lastMouseY = 0;

var cameraPositionX = 0;
var cameraPositionY = 0;
var cameraPositionZ = 0;

var cameraTargetX = 0;
var cameraTargetY = 0;
var cameraTargetZ = 0;

var keyStates = {};

async function main() {
	setupWebGL();
	connectVariablesToGLSL();

	const response = await fetch('./animation.json');
	const animations = await response.json();

	ANTEATER = new Anteater();
	ANT_ANIM = new AnimMan(ANTEATER, animations);

	setupListeners();

	ANT_ANIM.queueAnim('walk');

	GL.clearColor(0.0, 0.0, 0.0, 1.0);
	GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

	FOV = document.getElementById('FOV').value;
	RES_MULT = document.getElementById('RES_MULT').value;
	IS_PAUSED = document.getElementById('mPause').textContent !== 'Pause';
	invX = document.getElementById('invX').checked;
	invY = document.getElementById('invY').checked;

	MOVE_SPEED = parseFloat(document.getElementById('MOVE_SPEED').value);
	MAX_MOVE_SPEED = parseFloat(document.getElementById('MOVE_SPEED').max);
	currCamMode = CameraMode[document.querySelector('#camMode input[name="mode"]:checked').value];

	DEBUG = document.getElementById('mDebug').checked;

	cameraDistance = DEFAULT_DISTANCE;
	cameraAngleX = 15;
	cameraAngleY = 30;

	[cameraTargetX, cameraTargetY, cameraTargetZ] = getCameraPivot();

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
	document.getElementById('invX').addEventListener('change', function() { invX = this.checked; })
	document.getElementById('invY').addEventListener('change', function() { invY = this.checked; })
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
	document.getElementById('MOVE_SPEED').addEventListener('input', function() { MOVE_SPEED = parseFloat(this.value); });

	window.addEventListener('keydown', function(e) {
		keyStates[e.key.toLowerCase()] = true;
	});
	
	window.addEventListener('keyup', function(e) {
		keyStates[e.key.toLowerCase()] = false;
	});

	const modeRadios = document.querySelectorAll('#camMode input[name="mode"]');
	modeRadios.forEach(radio => {
		radio.addEventListener('change', function() {
			handleModeTransition(CameraMode[this.value], currCamMode);
			currCamMode = CameraMode[this.value];
		});
	});

	canvas.addEventListener('mousedown', function(env) {
		isDragging = true;
		lastMouseX = env.clientX;
		lastMouseY = env.clientY;

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
		if (!isDragging) return;
		
		const deltaX = (env.clientX - lastMouseX) * (invX ? -1 : 1);
		const deltaY = (env.clientY - lastMouseY) * (invY ? -1 : 1);
		

		// Rotation allowed in orbit and free mode, NOT in track
		if (currCamMode !== CameraMode.TRACK) {
			cameraAngleY += deltaX * 0.2;
			cameraAngleX -= deltaY * 0.2;
			cameraAngleX = Math.max(-89, Math.min(89, cameraAngleX));
		}
		
		lastMouseX = env.clientX;
		lastMouseY = env.clientY;
	});

    canvas.addEventListener('mouseup', function(env) { isDragging = false; });
    canvas.addEventListener('mouseleave', function(env) { isDragging = false; });

	canvas.addEventListener('wheel', function(env) {
		env.preventDefault();
		
		if (currCamMode === CameraMode.ORBIT) {
			cameraDistance += env.deltaY * 0.01;
			cameraDistance = Math.max(0.1, cameraDistance);
		} else {
			MOVE_SPEED += parseFloat(document.getElementById('MOVE_SPEED').step);
			MOVE_SPEED = Math.max(0.001, Math.min(MOVE_SPEED, MAX_MOVE_SPEED));
			document.getElementById('MOVE_SPEED').value = MOVE_SPEED;
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

function getMode() {
	const checked = document.querySelector('#camMode input[name="mode"]:checked');
	return checked ? CameraMode[checked.value] : null;
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

	// Get vars we want & store them
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
}

function click(env) {
	const [x, y] = screenSpaceToCanvasSpace(env);


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

// A bunch of annoying camera math
function updateCamera(dt) {
	const MODE = getMode();
	const speed = MOVE_SPEED * dt;

	[cameraTargetX, cameraTargetY, cameraTargetZ] = MODE === CameraMode.Orbit ? getCameraPivot() : getCameraPivot();
	if (MODE === CameraMode.FREE || MODE === CameraMode.TRACK) {
		const forward = (keyStates['w'] ? 1 : 0) - (keyStates['s'] ? 1 : 0);
		const right = (keyStates['a'] ? 1 : 0) - (keyStates['d'] ? 1 : 0);
		const up = (keyStates['e'] ? 1 : 0) - (keyStates['q'] ? 1 : 0);
		
		let forwardX, forwardZ, rightX, rightZ;
		if (MODE === CameraMode.FREE) {
			({ forwardX, forwardZ, rightX, rightZ } = getMovementVectors(cameraAngleY));
		} else {
			({ forwardX, forwardZ, rightX, rightZ } = getTrackingVectors(cameraTargetX, cameraTargetZ));
		}

		
		cameraPositionX += (forwardX * forward + rightX * right) * speed;
		cameraPositionZ += (forwardZ * forward + rightZ * right) * speed;
		cameraPositionY += up * speed;
		
		if (MODE === CameraMode.FREE) {
			const lookAt = getLookAtPoint(cameraAngleX, cameraAngleY);
			setViewMatrix(cameraPositionX, cameraPositionY, cameraPositionZ, 
			              lookAt.x, lookAt.y, lookAt.z);
		} else {
			setViewMatrix(cameraPositionX, cameraPositionY, cameraPositionZ,
			              cameraTargetX, cameraTargetY, cameraTargetZ);
		}
		return;
	}

	// Orbit mode
	const pos = getOrbitPosition(cameraTargetX, cameraTargetY, cameraTargetZ,
	                             cameraDistance, cameraAngleX, cameraAngleY);
	setViewMatrix(pos.x, pos.y, pos.z,
		          cameraTargetX, cameraTargetY, cameraTargetZ);
}

// moving between camera modes is a bit of a headache because i'm stupid and probably overcomplicated it
// but orbit is a simple movement style, free cam is nice but probably not worth while
// tracking is an unholy hybrid of them since it's both in and not in cartesian space.
// tbh i may just throw it all out and just stick or orbit <-> free
function handleModeTransition(newMode, oldMode) {
	// ORBIT → FREE / TRACK
	if (oldMode === CameraMode.ORBIT && newMode !== CameraMode.ORBIT) {
		const [dx, dy, dz] = anglesToDir(cameraAngleX, cameraAngleY);
		cameraPositionX = cameraTargetX + dx * cameraDistance;
		cameraPositionY = cameraTargetY + dy * cameraDistance;
		cameraPositionZ = cameraTargetZ + dz * cameraDistance;

		cameraAngleX = -cameraAngleX;
		cameraAngleY = ((cameraAngleY + 180 + 180) % 360) - 180;

		if (newMode === CameraMode.TRACK) {
			[cameraTargetX, cameraTargetY, cameraTargetZ] = getCameraPivot();
		}
	}

	// TRACK → FREE
	if (oldMode === CameraMode.TRACK && newMode === CameraMode.FREE) {
		const [cameraTargetX, cameraTargetY, cameraTargetZ] = getCameraPivot();
		const ang = dirToAngles(cameraTargetX - cameraPositionX, cameraTargetY - cameraPositionY, cameraTargetZ - cameraPositionZ);
		if (ang) [cameraAngleX, cameraAngleY] = ang;
	}

	// FREE / TRACK → ORBIT
	if (newMode === CameraMode.ORBIT && oldMode !== CameraMode.ORBIT) {
		[cameraTargetX, cameraTargetY, cameraTargetZ] = getCameraPivot();	
		
		const dx = cameraPositionX - cameraTargetX;
		const dy = cameraPositionY - cameraTargetY;
		const dz = cameraPositionZ - cameraTargetZ;
		
		cameraDistance = Math.hypot(dx, dy, dz);
		const ang = dirToAngles(dx, dy, dz);
		if (ang) [cameraAngleX, cameraAngleY] = ang;
	}
}

// call on module load
main();




// Camera helpers
function getCameraPivot() {
	if (getMode() == CameraMode.ORBIT) return [0, 2, 0];
	return ANTEATER.cameraFocus.getWorldPosition();
}

function setViewMatrix(camX, camY, camZ, targetX, targetY, targetZ) {
	const viewMatrix = new Matrix4();
	viewMatrix.setLookAt(camX, camY, camZ, targetX, targetY, targetZ, 0, 1, 0);
	GL.uniformMatrix4fv(window.u_GlobalRotation, false, viewMatrix.elements);
}

function getMovementVectors(angleY) {
	const radY = angleY * DEG_TO_RAD;
	return {
		forwardX: Math.sin(radY),
		forwardZ: Math.cos(radY),
		rightX: Math.cos(radY),
		rightZ: -Math.sin(radY)
	};
}

function getTrackingVectors(targetX, targetZ) {
	const dx = targetX - cameraPositionX;
	const dz = targetZ - cameraPositionZ;
	const len = Math.sqrt(dx*dx + dz*dz);
	
	if (len > 0.001) {
		return {
			forwardX: dx / len,
			forwardZ: dz / len,
			rightX: dz / len,
			rightZ: -dx / len
		};
	}
	return { forwardX: 0, forwardZ: 1, rightX: 1, rightZ: 0 };
}

function getOrbitPosition(targetX, targetY, targetZ, distance, angleX, angleY) {
	const radX = angleX * DEG_TO_RAD;
	const radY = angleY * DEG_TO_RAD;
	return {
		x: targetX + distance * Math.cos(radX) * Math.sin(radY),
		y: targetY + distance * Math.sin(radX),
		z: targetZ + distance * Math.cos(radX) * Math.cos(radY)
	};
}

function getLookAtPoint(angleX, angleY, distance = 10) {
	const radX = angleX * DEG_TO_RAD;
	const radY = angleY * DEG_TO_RAD;
	return {
		x: cameraPositionX + distance * Math.cos(radX) * Math.sin(radY),
		y: cameraPositionY + distance * Math.sin(radX),
		z: cameraPositionZ + distance * Math.cos(radX) * Math.cos(radY)
	};
}

function anglesToDir(ax, ay) {
	const radX = ax * DEG_TO_RAD, radY = ay * DEG_TO_RAD;
	return [
		Math.cos(radX) * Math.sin(radY),
		Math.sin(radX),
		Math.cos(radX) * Math.cos(radY)
	];
}

function dirToAngles(dx, dy, dz) {
	const len = Math.hypot(dx, dy, dz);
	return len < 1e-3 ? null : [
		Math.asin(dy / len) * RAD_TO_DEG,
		Math.atan2(dx, dz) * RAD_TO_DEG
	];
}

function updateBulkRotation(bone, segment, offsetX = 0, offsetY = 0, offsetZ = 0) {
    const x = parseFloat(document.getElementById(`${segment}X`).value) + offsetX;
    const y = parseFloat(document.getElementById(`${segment}Y`).value) + offsetY;
    const z = parseFloat(document.getElementById(`${segment}Z`).value) + offsetZ;

    ANT_ANIM.setUserRotation(bone, [x, y, z]);
}

function setupAnimationListeners() {
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
		nodeCube.colour = leafNodes.has(node.transform) ? [0, 1, 0, 1] : [1, 0, 0, 1];
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
