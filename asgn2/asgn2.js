// Asgn2.js
import { Cube, Cylinder } from './shapes.js';

/**
 * TODO:
 * Screenshot mode?
 * Basic AA?
 * Basic normal lighting
 */


// Vertex shader program
var VSHADER_SOURCE =
	`attribute vec4 a_Position;
	uniform mat4 u_ModelMatrix;
	uniform mat4 u_GlobalRotation;
	uniform mat4 u_ProjectionMatrix;

	// consider normal stuff for lighting
	void main() {
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * u_ModelMatrix * a_Position;
	}`;

// Fragment shader program
var FSHADER_SOURCE =
	`precision mediump float;
	uniform vec4 u_FragColor;
	void main() {
		gl_FragColor = u_FragColor;
	}`;


var canvas;
var gl;

var W;
var H;
var HW;
var HH;
var TIME;
var START_TIME = performance.now() / 1000.0;

var FOV;
var IS_PAUSED;
var RES_MULT;

// Pitch, Yaw
const CameraMode = {
	TRACK: 0,
	FREE: 1,
	ORBIT: 2,
};

var cameraAngleX = 0;
var cameraAngleY = 0;
var cameraDistance = 3;

var isDragging = false;
var isPanning = false;
var lastMouseX = 0;
var lastMouseY = 0;

var cameraTargetX = 0;
var cameraTargetY = 0;
var cameraTargetZ = 0;

function main() {
	setupWebGL();
	setupListeners();
	connectVariablesToGLSL();

	// clear colour
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	FOV = document.getElementById('FOV').value;
	RES_MULT = document.getElementById('RES_MULT').value;
	IS_PAUSED = document.getElementById('mPause').textContent !== 'Pause';

	resizeCanvas();
	requestAnimationFrame(tick);
}

function setupWebGL() {
	canvas = document.getElementById('webgl');
	if (!canvas) {
		console.log('Failed to retrieve the <canvas> element');
		return;
	}

	// Get the rendering context for 2DCG <- (2)
	// suggested by vid 1.8
	gl = canvas.getContext("webgl", { preserveDrawingBuffer: true});
	if (!gl) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	// Alpha
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST);
	//gl.enable(gl.BLEND);
	//gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	window.gl = gl;
	window.addEventListener('resize', resizeCanvas);
}

function setupListeners() {
	document.getElementById('FOV').addEventListener('input', function() { FOV = this.value; updateProjMatrix(); });
	document.getElementById('RES_MULT').addEventListener('input', function() { RES_MULT = this.value; resizeCanvas(); });
	document.getElementById('mTrack').addEventListener('mouseup', function() {
		// TODO: convert coordinate system from spherical to cartesian
		
		return;
		// wait for next frame to update camera
	});

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
	canvas.addEventListener('mousedown', function(env) {
		isDragging = true;
		isPanning = env.shiftKey;
		lastMouseX = env.clientX;
		lastMouseY = env.clientY;
	});

	canvas.addEventListener('mousemove', function(env) {
		if (!isDragging) return;
		
		const deltaX = env.clientX - lastMouseX;
		const deltaY = env.clientY - lastMouseY;
		
		if (isPanning) {
			const panSpeed = 0.005;
			const radX = cameraAngleX * Math.PI / 180;
			const radY = cameraAngleY * Math.PI / 180;
			
			const rightX = Math.cos(radY);
			const rightZ = -Math.sin(radY);
			const upX = -Math.sin(radX) * Math.sin(radY);
			const upY = Math.cos(radX);
			const upZ = -Math.sin(radX) * Math.cos(radY);
		
			// pan
			cameraTargetX -= (rightX * deltaX - upX * deltaY) * panSpeed * cameraDistance;
			cameraTargetY += upY * deltaY * panSpeed * cameraDistance;
			cameraTargetZ -= (rightZ * deltaX - upZ * deltaY) * panSpeed * cameraDistance;
		} else {
			// Rotate the camera
			cameraAngleY += deltaX * 0.2;
			cameraAngleX -= deltaY * 0.2;
			cameraAngleX = Math.max(-89, Math.min(89, cameraAngleX));
		}
		
		lastMouseX = env.clientX;
		lastMouseY = env.clientY;
	});

    canvas.addEventListener('mouseup', function(env) {
        isDragging = false;
		isPanning  = false;
    });

    canvas.addEventListener('mouseleave', function(env) {
        isDragging = false;
		isPanning  = false;
    });

    // Zoom with mouse wheel
    canvas.addEventListener('wheel', function(env) {
        env.preventDefault();
        cameraDistance += env.deltaY * 0.01;
        cameraDistance = Math.max(1, Math.min(10, cameraDistance)); // Clamp between 1 and 10
    });

    canvas.addEventListener('contextmenu', function(env) {
        env.preventDefault();
    });
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
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to init shaders.');
		return;
	}

	// Get vars we want & store them
	let tPos = gl.getAttribLocation(gl.program, 'a_Position');
	if (tPos < 0) {
		console.log('Failed to get storage location of a_Position');
		return;
	}
	window.a_Position = tPos;

	let tCol = gl.getUniformLocation(gl.program, 'u_FragColor');
	if (!tCol) {
		console.log('Failed to get storage location of u_FragColor');
		return;
	}
	window.u_FragColor = tCol;

	let tMod = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if (!tMod) {
		console.log('Failed to get storage location of u_ModelMatrix');
		return;
	}
	window.u_ModelMatrix = tMod;
	var identityMatrix = new Matrix4();
	gl.uniformMatrix4fv(window.u_ModelMatrix, false, identityMatrix.elements);

	let tGol = gl.getUniformLocation(gl.program, 'u_GlobalRotation');
	if (!tGol) {
		console.log('Failed to get storage location of u_GlobalRotation');
		return;
	}
	window.u_GlobalRotation = tGol;
	var globalRotation = new Matrix4();
	globalRotation.setIdentity();
	gl.uniformMatrix4fv(window.u_GlobalRotation, false, globalRotation.elements);


	let tProj = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
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
	// TODO: separate sim time from fps.

	updateCamera();
	dispatchAnimations();
	renderAllShapes();
	requestAnimationFrame(tick);
}

function dispatchAnimations() {
	if (IS_PAUSED) return;
}

function renderAllShapes() {
	const now = performance.now();
	const nowSeconds = now / 1000;
	TIME = nowSeconds;
	const frameTime = now - START_TIME;

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	var body = new Cube([0, 0].slice(), [1.0, 0.0, 0.0, 1.0].slice(), new Matrix4().setIdentity());
	body.matrix.scale(1, 1, 1);
	body.matrix.translate(0, 0, 0);
	body.matrix.rotate(45, 0, 0, 1);
	body.render();

	var cyl = new Cylinder([0, 0].slice(), [0.0, 1.0, 0.0, 0.5].slice(), new Matrix4().setIdentity());
	cyl.matrix.translate(-1, 0, 0);
	cyl.render();

	writeToHTML(`ms: ${frameTime.toFixed(2)} fps: ${(1000/frameTime).toFixed(2)}`, "profMeasure");

	START_TIME = now;
}

function updateCamera() {
	const MODE = getMode();

	// This sucks currently since cameraAngleX does not cleanly map to cartesian cords.
	// so there needs to be a conversion step to smooth this.
	if (MODE == CameraMode.FREE) {
		var viewMatrix = new Matrix4();
		viewMatrix.setRotate(cameraAngleX, 1, 0, 0);   // Pitch
		viewMatrix.rotate(cameraAngleY, 0, 1, 0);      // Yaw
		viewMatrix.translate(0, 0, -cameraDistance);   // Move back
		gl.uniformMatrix4fv(window.u_GlobalRotation, false, viewMatrix.elements);
		return;

		// TODO: some kind of forward movement options
	};

	// orbital & tracking act the same

	// TODO: for tracking, override cameraTarget to target
	if (MODE == CameraMode.TRACK) {
		const SMOOTH = 0.1;
		cameraTargetX += (0 - cameraTargetX) * SMOOTH;
		cameraTargetY += (0 - cameraTargetY) * SMOOTH;
		cameraTargetZ += (0 - cameraTargetZ) * SMOOTH;
		isPanning = false; // jank but acceptable
	}

	// Orbital camera
    const radX = cameraAngleX * Math.PI / 180;
    const radY = cameraAngleY * Math.PI / 180;
    
    // camera pos relative to target
    const camX = cameraTargetX + cameraDistance * Math.cos(radX) * Math.sin(radY);
    const camY = cameraTargetY + cameraDistance * Math.sin(radX);
    const camZ = cameraTargetZ + cameraDistance * Math.cos(radX) * Math.cos(radY);
    
    // look at the target point
    var viewMatrix = new Matrix4();
    viewMatrix.setLookAt(
        camX, camY, camZ,
        cameraTargetX, cameraTargetY, cameraTargetZ,
        0, 1, 0
    );
    gl.uniformMatrix4fv(window.u_GlobalRotation, false, viewMatrix.elements);
}

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

    gl.viewport(0, 0, W, H);

    updateProjMatrix();
    writeToHTML(`${W}x${H}, DPR: ${dpr}, Multiplier: ${RES_MULT}`, "resMeasure");
}

function updateProjMatrix() {
	var projMatrix = new Matrix4();
	var aspect = W / H;
	projMatrix.setPerspective(FOV, aspect, 0.05, 100);
	gl.uniformMatrix4fv(window.u_ProjectionMatrix, false, projMatrix.elements);
}

function writeToHTML(str, id) {
	const element = document.getElementById(id);
	element.textContent = str;

	if (str === "") {
		element.classList.add('hidden');
		return;
	}

	element.classList.remove('hidden');
}

// call on module load
main();
